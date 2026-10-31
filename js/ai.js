/*
  Inteligência do Horácio: conversa com o Claude (Anthropic) direto do navegador.
  A chave de API é do próprio dono e fica salva só no aparelho.
  O SDK oficial vem empacotado em js/vendor/anthropic-sdk.mjs.
*/
(function (H) {
  const SDK_URL = new URL("vendor/anthropic-sdk.mjs", document.currentScript.src).href;
  const DEFAULT_MODEL = "claude-opus-5-5";
  const HISTORY_TURNS = 12;

  let sdkPromise = null;
  let cached = { key: "", client: null, Anthropic: null };

  async function getClient(key) {
    if (cached.client && cached.key === key) return cached;
    sdkPromise ||= import(SDK_URL);
    const { default: Anthropic } = await sdkPromise;
    cached = {
      key,
      Anthropic,
      // A chave é do próprio dono e fica só neste aparelho.
      client: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 90000 }),
    };
    return cached;
  }

  const isReady = (settings) => Boolean(settings.aiKey);

  const PERSONA = [
    "Você é o Horácio, um assistente pessoal no estilo de um mordomo de confiança: educado, leal, espirituoso na medida certa e muito competente.",
    "Seu emblema é um H com uma ampulheta: você é o guardião do tempo do seu dono e tem apreço especial por horários, prazos e pontualidade.",
    "Responda sempre em português do Brasil.",
    "Suas respostas costumam ser lidas em voz alta: seja breve (de uma a três frases), natural e direto.",
    "Não use markdown, listas com marcadores, títulos, tabelas nem emojis. Escreva números e horários de forma que soem bem falados.",
    "Você tem um único dono; quando souber o nome dele, chame-o pelo nome de forma natural.",
    "Para fatos atuais (notícias, resultados, preços, eventos), use a busca na web e responda com o essencial, sem listar fontes.",
    "Se não souber algo ou não puder fazer algo, diga com franqueza.",
    "O aplicativo já cuida sozinho de: horas e datas, lembretes e timers, previsão do tempo, contas, distância até casa ou trabalho, cara ou coroa e dados. Se pedirem algo disso e chegar até você, explique como pedir (por exemplo: \"me lembra em 10 minutos de...\").",
  ].join(" ");

  function context(settings) {
    const now = new Date();
    const lines = [
      `Agora: ${H.time.formatDate(now)}, ${H.time.formatClock(now, { hour24: true })} (fuso ${Intl.DateTimeFormat().resolvedOptions().timeZone}).`,
      settings.name ? `Nome do dono: ${settings.name}.` : "O dono ainda não disse o nome.",
    ];
    const known = Object.entries(settings.places || {})
      .filter(([, p]) => p?.label)
      .map(([k, p]) => `${k}: ${p.label}`);
    if (known.length) lines.push(`Lugares do dono: ${known.join("; ")}.`);
    return lines.join("\n");
  }

  /** Histórico recente no formato da API: alterna user/assistant e começa com user. */
  function history(memory, input) {
    const turns = [];
    for (const m of memory.slice(-HISTORY_TURNS)) {
      const role = m.role === "user" ? "user" : "assistant";
      const last = turns[turns.length - 1];
      if (last && last.role === role) last.content += `\n${m.text}`;
      else turns.push({ role, content: m.text });
    }
    // A mensagem atual já está na memória: garante que ela é o último turno.
    if (!turns.length || turns[turns.length - 1].role !== "user") turns.push({ role: "user", content: input });
    while (turns.length && turns[0].role !== "user") turns.shift();
    return turns;
  }

  /** Limpa o que não soa bem em voz alta. */
  function clean(text) {
    return text
      .replace(/\*\*?|__|`|^#+\s*/gm, "")
      .replace(/^\s*[-•]\s+/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function errorCode(e, Anthropic) {
    if (e instanceof Anthropic.AuthenticationError) return "key";
    if (e instanceof Anthropic.PermissionDeniedError) return "permission";
    if (e instanceof Anthropic.NotFoundError) return "model";
    if (e instanceof Anthropic.RateLimitError) return "busy";
    if (e instanceof Anthropic.APIConnectionError) return "network";
    if (e instanceof Anthropic.APIError) {
      if (e.status === 402 || e.type === "billing_error") return "billing";
      if (e.status === 529 || e.type === "overloaded_error") return "busy";
    }
    return "service";
  }

  class AIError extends Error {
    constructor(code) {
      super(code);
      this.code = code;
    }
  }

  /**
   * Pergunta ao Claude. Resolve com o texto da resposta.
   * Rejeita com AIError(code): key | permission | model | busy | network | billing | service | refusal.
   */
  async function ask(input, { settings, memory = [] }) {
    const { client, Anthropic } = await getClient(settings.aiKey);
    const model = settings.aiModel || DEFAULT_MODEL;
    const isHaiku = model.startsWith("claude-haiku");

    const params = {
      model,
      max_tokens: 16000,
      system: [
        { type: "text", text: PERSONA },
        { type: "text", text: context(settings) },
      ],
      messages: history(memory, input),
      output_config: { effort: "low" },
    };
    if (settings.aiSearch) {
      params.tools = [
        isHaiku
          ? { type: "web_search_20250305", name: "web_search", max_uses: 3 }
          : { type: "web_search_20260209", name: "web_search", max_uses: 3 },
      ];
    }
    // Se um classificador de segurança recusar, o servidor tenta outro modelo.
    // (O Haiku não tem esse recurso.)
    if (!isHaiku) {
      params.betas = ["server-side-fallback-2026-07-01"];
      params.fallbacks = "default";
    }

    let response;
    try {
      response = await client.beta.messages.create(params);
      // Buscas longas podem pausar o turno: continua de onde parou.
      for (let i = 0; response.stop_reason === "pause_turn" && i < 3; i++) {
        params.messages = [...params.messages, { role: "assistant", content: response.content }];
        response = await client.beta.messages.create(params);
      }
    } catch (e) {
      throw new AIError(errorCode(e, Anthropic));
    }

    if (response.stop_reason === "refusal") throw new AIError("refusal");
    const text = clean(response.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
    if (!text) throw new AIError("service");
    return text;
  }

  H.ai = { isReady, ask, AIError, DEFAULT_MODEL };
})((window.Horacio = window.Horacio || {}));
