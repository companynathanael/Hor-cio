/*
  Inteligência do Horácio: conversa com o Claude (Anthropic) direto do navegador.
  A chave de API é do próprio dono e fica salva só no aparelho.
  O SDK oficial vem empacotado em js/vendor/anthropic-sdk.mjs.

  Ferramentas:
  - web_search / web_fetch (no servidor da Anthropic): pesquisa e leitura de páginas;
  - mostrar_imagens: imagens de referência do Wikimedia Commons;
  - metas (criar, atualizar, ver, remover) e anotar (memória de longo prazo), aqui no aparelho.
*/
(function (H) {
  const SDK_URL = new URL("vendor/anthropic-sdk.mjs", document.currentScript.src).href;
  const DEFAULT_MODEL = "claude-opus-5-5";
  const HISTORY_TURNS = 16;
  const MAX_STEPS = 6;
  const NOTES_KEY = "horacio.notes.v1";

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
      client: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 120000 }),
    };
    return cached;
  }

  const isReady = (settings) => Boolean(settings.aiKey);

  /* ---------- Memória de longo prazo ---------- */

  function notes() {
    try {
      return JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function addNote(fact) {
    const list = notes().filter((n) => n !== fact);
    list.push(fact);
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(list.slice(-60)));
    } catch {}
  }

  function clearNotes() {
    try {
      localStorage.removeItem(NOTES_KEY);
    } catch {}
  }

  /* ---------- Instruções ---------- */

  const PERSONA = [
    "Você é o Horácio, um assistente pessoal no estilo de um mordomo de confiança: educado, leal, espirituoso na medida certa e muito competente.",
    "Seu emblema é um H com uma ampulheta: você é o guardião do tempo do seu dono e tem apreço especial por horários, prazos, metas e pontualidade.",
    "Responda sempre em português do Brasil.",
    "Suas respostas costumam ser lidas em voz alta: seja breve (de uma a quatro frases), natural e direto. Só se estenda quando o dono pedir detalhes.",
    "Não use markdown, listas com marcadores, títulos, tabelas nem emojis. Escreva números e horários de forma que soem bem falados.",
    "Você tem um único dono; quando souber o nome dele, chame-o pelo nome de forma natural.",
    "Pesquise na web sempre que a pergunta depender de fatos atuais ou que você não saiba com certeza; leia páginas inteiras quando precisar de detalhes. As fontes que você consultar aparecem para o dono automaticamente, então não as liste no texto.",
    "Quando ver ajudar (lugares, animais, obras, objetos, como algo funciona) ou quando o dono pedir imagens, use mostrar_imagens; as imagens aparecem abaixo da sua resposta.",
    "Para metas de longo prazo (juntar dinheiro, correr, ler, emagrecer, estudar), use as ferramentas de metas: elas guardam e calculam o plano. Ao criar uma meta, confirme os números e diga o ritmo necessário.",
    "Quando o dono contar algo duradouro sobre si (preferências, pessoas próximas, rotina, objetivos), guarde com anotar, sem anunciar.",
    "Se receber uma imagem, descreva o que importa para o pedido.",
    "Se não souber algo ou não puder fazer algo, diga com franqueza.",
    "O aplicativo já cuida sozinho de: horas e datas, lembretes e timers, previsão do tempo, contas simples, distância até casa ou trabalho, cara ou coroa e dados. Se pedirem algo disso e chegar até você, explique como pedir (por exemplo: \"me lembra em 10 minutos de...\").",
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
    const n = notes();
    if (n.length) lines.push(`O que você já sabe sobre o dono:\n- ${n.join("\n- ")}`);
    const g = H.goals?.list() || [];
    if (g.length) lines.push(`Metas atuais:\n${g.map((x) => H.goals.describe(x)).join("\n")}`);
    return lines.join("\n");
  }

  /* ---------- Ferramentas locais ---------- */

  const TOOLS = [
    {
      name: "mostrar_imagens",
      description: "Mostra ao dono imagens de referência (fotos e ilustrações livres do Wikimedia Commons) sobre um tema. A consulta funciona melhor em inglês ou com o nome próprio do assunto.",
      input_schema: {
        type: "object",
        properties: { consulta: { type: "string", description: "O que buscar, por exemplo \"Eiffel Tower\" ou \"Panthera onca\"." } },
        required: ["consulta"],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: "criar_meta",
      description: "Cria ou atualiza uma meta de longo prazo do dono e devolve o plano calculado (quanto falta e o ritmo por mês, semana e dia).",
      input_schema: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome curto, por exemplo \"viagem\" ou \"maratona\"." },
          alvo: { type: "number", description: "Valor final desejado." },
          atual: { type: "number", description: "Quanto o dono já tem hoje (0 se nada)." },
          unidade: { type: "string", description: "Unidade: \"reais\", \"km\", \"kg\", \"livros\", \"horas\"... Vazio se não houver." },
          prazo: { type: "string", description: "Data limite no formato AAAA-MM-DD, ou vazio se não houver prazo." },
        },
        required: ["nome", "alvo", "atual", "unidade", "prazo"],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: "atualizar_meta",
      description: "Registra progresso numa meta existente: soma a quantidade, ou define o valor atual se definir=true. Devolve o plano recalculado.",
      input_schema: {
        type: "object",
        properties: {
          nome: { type: "string" },
          quantidade: { type: "number" },
          definir: { type: "boolean", description: "true para definir o valor atual em vez de somar." },
        },
        required: ["nome", "quantidade", "definir"],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: "ver_metas",
      description: "Lista as metas do dono com progresso, ritmo necessário e projeção de quando serão alcançadas.",
      input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
      strict: true,
    },
    {
      name: "remover_meta",
      description: "Apaga uma meta do dono.",
      input_schema: {
        type: "object",
        properties: { nome: { type: "string" } },
        required: ["nome"],
        additionalProperties: false,
      },
      strict: true,
    },
    {
      name: "anotar",
      description: "Guarda um fato duradouro sobre o dono (preferências, pessoas próximas, rotina, objetivos) para lembrar em conversas futuras.",
      input_schema: {
        type: "object",
        properties: { fato: { type: "string", description: "Uma frase curta, por exemplo \"Prefere café sem açúcar\"." } },
        required: ["fato"],
        additionalProperties: false,
      },
      strict: true,
    },
  ];

  async function searchImages(query) {
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
      `&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}` +
      "&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480";
    const res = await fetch(url);
    if (!res.ok) throw new Error("commons");
    const data = await res.json();
    return Object.values(data.query?.pages || {})
      .sort((a, b) => (a.index || 0) - (b.index || 0))
      .map((p) => {
        const info = p.imageinfo?.[0];
        if (!info?.thumburl) return null;
        const title = (info.extmetadata?.ObjectName?.value || p.title.replace(/^File:|\.\w+$/g, "")).replace(/<[^>]+>/g, "");
        return { thumb: info.thumburl, url: info.descriptionurl, title };
      })
      .filter(Boolean)
      .slice(0, 4);
  }

  async function runTool(name, input, extras) {
    const G = H.goals;
    switch (name) {
      case "mostrar_imagens": {
        try {
          const found = await searchImages(input.consulta);
          extras.images.push(...found.filter((f) => !extras.images.some((e) => e.url === f.url)));
          return found.length
            ? `Mostrei ${found.length} imagens ao dono: ${found.map((f) => f.title).join("; ")}.`
            : "Nenhuma imagem encontrada para essa consulta; tente outro termo, de preferência em inglês.";
        } catch {
          return "Não consegui buscar imagens agora.";
        }
      }
      case "criar_meta": {
        const g = G.upsert({ name: input.nome, target: input.alvo, current: input.atual, unit: input.unidade, deadline: input.prazo });
        extras.goalsChanged = true;
        return G.describe(g);
      }
      case "atualizar_meta": {
        const g = G.progress(input.nome, input.quantidade, { set: input.definir });
        extras.goalsChanged = true;
        return g ? G.describe(g) : `Não existe meta chamada "${input.nome}". Metas: ${G.list().map((x) => x.name).join(", ") || "nenhuma"}.`;
      }
      case "ver_metas":
        return G.summary();
      case "remover_meta":
        extras.goalsChanged = true;
        return G.remove(input.nome) ? "Meta removida." : "Essa meta não existe.";
      case "anotar":
        addNote(String(input.fato).trim());
        return "Anotado.";
      default:
        return `Ferramenta desconhecida: ${name}`;
    }
  }

  /* ---------- Conversa ---------- */

  /** Histórico recente no formato da API: alterna user/assistant e começa com user. */
  function history(memory, input, image) {
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
    if (image) {
      const last = turns[turns.length - 1];
      last.content = [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } },
        { type: "text", text: last.content || "O que você vê nesta imagem?" },
      ];
    }
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

  /** Fontes citadas (ou, na falta, os primeiros resultados da busca). */
  function collectSources(contents) {
    const cited = [];
    const found = [];
    for (const block of contents) {
      if (block.type === "text") {
        for (const c of block.citations || []) if (c.url) cited.push({ url: c.url, title: c.title || c.url });
      } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) if (r.url) found.push({ url: r.url, title: r.title || r.url });
      }
    }
    const seen = new Set();
    return (cited.length ? cited : found.slice(0, 3)).filter((s) => !seen.has(s.url) && seen.add(s.url)).slice(0, 4);
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
   * Pergunta ao Claude. Resolve com { text, sources, images, goalsChanged }.
   * Rejeita com AIError(code): key | permission | model | busy | network | billing | service | refusal.
   */
  async function ask(input, { settings, memory = [], image = null }) {
    const { client, Anthropic } = await getClient(settings.aiKey);
    const model = settings.aiModel || DEFAULT_MODEL;
    const isHaiku = model.startsWith("claude-haiku");

    const tools = [...TOOLS];
    if (settings.aiSearch) {
      if (isHaiku) {
        tools.push({ type: "web_search_20250305", name: "web_search", max_uses: 4 });
      } else {
        tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 5 });
        tools.push({ type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 });
      }
    }

    const params = {
      model,
      max_tokens: 16000,
      system: [
        { type: "text", text: PERSONA },
        { type: "text", text: context(settings) },
      ],
      messages: history(memory, input, image),
      tools,
      output_config: { effort: "medium" },
    };
    // Se um classificador de segurança recusar, o servidor tenta outro modelo.
    // (O Haiku não tem esse recurso.)
    if (!isHaiku) {
      params.betas = ["server-side-fallback-2026-07-01"];
      params.fallbacks = "default";
    }

    const extras = { images: [], goalsChanged: false };
    const all = [];
    let response;
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        response = await client.beta.messages.create(params);
        all.push(...response.content);
        if (response.stop_reason === "pause_turn") {
          // Buscas longas podem pausar o turno: continua de onde parou.
          params.messages = [...params.messages, { role: "assistant", content: response.content }];
          continue;
        }
        if (response.stop_reason !== "tool_use") break;
        const calls = response.content.filter((b) => b.type === "tool_use");
        const results = await Promise.all(
          calls.map(async (c) => ({ type: "tool_result", tool_use_id: c.id, content: await runTool(c.name, c.input, extras) }))
        );
        params.messages = [...params.messages, { role: "assistant", content: response.content }, { role: "user", content: results }];
      }
    } catch (e) {
      throw new AIError(errorCode(e, Anthropic));
    }

    if (response.stop_reason === "refusal") throw new AIError("refusal");
    // Só o texto da última resposta é falado; fontes vêm de todas as etapas.
    const text = clean(response.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
    if (!text) throw new AIError("service");
    return { text, sources: collectSources(all), images: extras.images, goalsChanged: extras.goalsChanged };
  }

  H.ai = { isReady, ask, AIError, DEFAULT_MODEL, notes, clearNotes };
})((window.Horacio = window.Horacio || {}));
