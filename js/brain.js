/*
  O "cérebro" do Horácio — HoV 0.1.
  Por enquanto, respostas locais sobre o tempo. Nas próximas versões,
  este módulo passa a conversar com um modelo de IA, mantendo a mesma
  interface: respond(texto, contexto) -> Promise<string>.

  O Horácio tem um único dono: toda resposta o chama pelo nome.
*/
(function (H) {
  const T = H.time;

  function normalize(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // "meu nome é Nathanael", "me chame de Nate"... (no texto original, com acentos)
  const NAME_PATTERN = /(?:meu nome [ée]|(?:eu )?me chamo|me chame de|me chama de|pode me chamar de|eu sou o|eu sou a)\s+([\p{L}][\p{L}' -]{0,40})/iu;

  /** "nathanael e sou seu criador" → "Nathanael" (até 3 palavras, para antes de conectivos). */
  function extractName(raw) {
    const words = [];
    for (const w of raw.trim().split(/\s+/)) {
      if (/^(e|sou|que|mas|aqui|o|a|seu|sua|meu|minha|tudo|bem|prazer)$/i.test(w) || words.length === 3) break;
      words.push(w.replace(/[^\p{L}'-]/gu, ""));
    }
    return titleCase(words.filter(Boolean).join(" "));
  }

  let askedName = false;

  const PLACE_NAMES = { casa: "casa", trabalho: "o trabalho" };
  const MODE_TEXT = { carro: "de carro", bicicleta: "de bicicleta", ape: "a pé" };

  const PLACE_ERRORS = {
    denied: "Preciso de permissão para ver sua localização. Libere o acesso à localização nas configurações do navegador.",
    unsupported: "Este aparelho não me deixa ver a localização.",
    timeout: "Não consegui pegar sua localização a tempo. Tente de novo em um lugar com sinal de GPS.",
    unavailable: "Não consegui descobrir onde você está agora. Verifique se a localização do aparelho está ligada.",
  };

  function formatDistance(m) {
    if (m < 1000) return `${Math.round(m / 10) * 10} metros`;
    return `${(m / 1000).toFixed(1).replace(".", ",")} km`;
  }

  function formatMinutes(seconds) {
    return T.hoursAndMinutes(Math.max(60000, seconds * 1000));
  }

  async function howFar(placeKey, settings) {
    const P = H.places;
    const target = settings.places?.[placeKey];
    const name = PLACE_NAMES[placeKey];
    if (!target) {
      return `Ainda não sei onde fica ${placeKey === "casa" ? "a sua casa" : "o seu trabalho"}. ` +
        "Em Personalização → Lugares, toque em “Estou aqui agora” ou digite o endereço.";
    }

    let pos;
    try {
      pos = await P.here();
    } catch (e) {
      return PLACE_ERRORS[e.code] || PLACE_ERRORS.unavailable;
    }

    const straight = P.haversine(pos, target);
    if (straight < Math.max(120, pos.accuracy || 0)) {
      return placeKey === "casa" ? "Você já está em casa." : "Você já está no trabalho.";
    }

    const mode = settings.travel || "carro";
    const t = await P.travel(pos, target, mode);
    const dest = placeKey === "casa" ? "de casa" : "do trabalho";
    if (t.exact) {
      return `Você está a ${formatMinutes(t.seconds)} ${dest} ${MODE_TEXT[mode]}, ${formatDistance(t.meters)} pelo caminho.`;
    }
    return `Você está a uns ${formatDistance(straight)} ${dest}, em linha reta. ` +
      `${MODE_TEXT[mode].charAt(0).toUpperCase() + MODE_TEXT[mode].slice(1)}, algo em torno de ${formatMinutes(t.seconds)}. ` +
      `Não consegui calcular a rota exata agora.`;
  }

  const intents = [
    {
      // "a quantos minutos estou da minha casa", "quanto tempo até o trabalho"...
      match: /\b(casa|trabalho|servico|escritorio|firma|empresa)\b/,
      also: /\b(minutos?|quanto tempo|quao longe|longe|distancia|falta|faltam|demoro|demora|chego|chegar|km|quilometros|estou de|estou da|estou do|perto)\b/,
      reply: ({ settings, text }) => howFar(/\bcasa\b/.test(text) ? "casa" : "trabalho", settings),
    },
    {
      match: /\b(que horas|horas sao|hora e|hora agora|horario)\b|^horas?$/,
      reply: ({ now, settings }) => `São ${T.formatClock(now, { hour24: settings.hour24 })}.`,
    },
    {
      match: /\b(que dia|data de hoje|dia e hoje|hoje e|qual a data|data)\b/,
      reply: ({ now }) => `Hoje é ${T.formatDate(now).toLowerCase()}.`,
    },
    {
      match: /\b(fim do ano|final do ano)\b/,
      reply: ({ now }) => {
        const days = T.daysUntilNewYear(now);
        return days === 1
          ? "Falta apenas um dia para o Ano Novo."
          : `Faltam ${days} dias para ${now.getFullYear() + 1}.`;
      },
    },
    {
      match: /\b(fim do dia|meia noite|acabar o dia)\b/,
      reply: ({ now }) => `Faltam ${T.hoursAndMinutes(T.untilMidnight(now))} para a meia-noite.`,
    },
    {
      match: /\b(progresso|quanto do ano|porcentagem|ja passou)\b/,
      reply: ({ now }) => {
        const pct = (T.yearProgress(now) * 100).toFixed(1).replace(".", ",");
        return `Já se passaram ${pct}% de ${now.getFullYear()}. O tempo não espera — mas eu ajudo a aproveitá-lo.`;
      },
    },
    {
      match: /\b(quem e voce|quem es|seu nome|o que voce e|se apresente)\b/,
      reply: () => "Sou o Horácio, guardião do seu tempo. Esta é a minha primeira versão, a HoV 0.1.",
    },
    {
      match: /\b(ajuda|o que voce faz|o que sabe|comandos|o que voce pode)\b/,
      reply: () =>
        "Algumas coisas que sei fazer:\n" +
        "· Que horas são?\n· Que dia é hoje?\n· Quanto falta para o fim do ano?\n" +
        "· Quanto falta para a meia-noite?\n· Quanto do ano já passou?\n" +
        "· A quantos minutos estou de casa?\n· Me lembra em 10 minutos de tirar o bolo\n" +
        "· Como está o tempo hoje?\n· Quanto é 15% de 230?\n· Quantos dias faltam para o Natal?\n" +
        "· Cara ou coroa\n· Quantos metros tem 3,5 km? · 10 km² em hectares\n" +
        "· Quanto tempo levo para fazer 120 km a 80 km/h?\n" +
        "· Quanto rende 1000 reais a 1% ao mês por 12 meses? · Parcela de 10 mil em 24 vezes a 2% ao mês\n" +
        "· Quanto está o dólar? · Qual a população do Japão? · Com quem a Bolívia faz fronteira?\n" +
        "· Quais as notícias de hoje? · Principais notícias da Europa\n" +
        "· E se você estiver triste, ansioso ou cansado, pode falar comigo.",
    },
    {
      match: /\b(voz|microfone|falar comigo|ouvir)\b/,
      reply: () =>
        "Toque no microfone ou no orbe e fale comigo. Se ativar “Chamar pelo nome” em Personalização, basta dizer “Horácio” com o site aberto.",
    },
    {
      match: /\b(como vai|tudo bem|como voce esta|como esta)\b/,
      reply: () => "Sempre pontual, obrigado por perguntar. E você?",
    },
    {
      match: /\b(obrigad\w*|valeu|grato|grata)\b/,
      reply: () => "Disponha. Estarei aqui sempre que precisar.",
    },
    {
      match: /\b(ola|oi|opa|e ai|hey|bom dia|boa tarde|boa noite|salve)\b/,
      reply: ({ now, settings, text }) => {
        const { greeting } = T.period(now);
        const said = (text.match(/\b(bom dia|boa tarde|boa noite)\b/) || [])[0];
        const name = settings.name ? `, ${settings.name}` : "";
        if (said && said !== normalize(greeting)) {
          return `${capitalize(said)}? Já são ${T.formatClock(now, { hour24: settings.hour24 })} — ${greeting.toLowerCase()}${name}. Em que posso ajudar?`;
        }
        return `${greeting}${name}. Em que posso ajudar?`;
      },
    },
  ];

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function titleCase(s) {
    return s.trim().replace(/\s+/g, " ").split(" ").map((w) => capitalize(w.toLowerCase())).join(" ");
  }

  /**
   * Chama o dono pelo nome: alterna entre o início ("Nathanael, são 20:10.")
   * e o fim da primeira frase ("São 20:10, Nathanael.").
   */
  // Palavras que podem ir para minúscula depois do nome ("Nathanael, são 20:10").
  // Nomes próprios ("Japão", "Paris") não: nesse caso o nome vai no fim da frase.
  const STARTERS = /^(a|o|as|os|um|uma|com|em|na|no|nas|nos|para|se|sou|são|é|faltam|falta|hoje|agora|amanhã|você|dá|deu|pronto|combinado|anotado|timer|financiando|segundo|não|sinto|que|respira|ainda|minha|meu|essa|esse|isso|meta|mostrei|quando|tudo|disponha|sempre|muito|boa|bom|vejo|algumas|quer|uma|entendo|raiva|cansaço|ansiedade|fico|excelente|ótimo|rolei|já|aqui|está|estou|lembrete|nenhuma|mas|então|de|do|da|seus?|suas?|cerca|uns|umas|em|até)$/i;

  function address(reply, name) {
    if (!name || reply.includes(name)) return reply;
    const first = reply.split(/\s/)[0].replace(/[^\p{L}]/gu, "");
    if (Math.random() < 0.5 && STARTERS.test(first)) {
      return `${name}, ${reply.charAt(0).toLowerCase()}${reply.slice(1)}`;
    }
    const end = reply.search(/[.!?](\s|$)/);
    if (end === -1) return `${reply}, ${name}`;
    return `${reply.slice(0, end)}, ${name}${reply.slice(end)}`;
  }

  const AI_ERRORS = {
    key: "Minha chave da IA foi recusada. Confira em Personalização → Inteligência.",
    permission: "Essa chave da IA não tem permissão para esse modelo. Confira em Personalização → Inteligência.",
    model: "Não encontrei esse modelo de IA. Escolha outro em Personalização → Inteligência.",
    busy: "A IA está sobrecarregada agora. Tente de novo em alguns segundos.",
    network: "Não consegui me conectar à IA. Verifique sua internet.",
    billing: "Os créditos da IA acabaram. Recarregue em console.anthropic.com.",
    refusal: "Prefiro não responder a isso.",
    service: "A IA não respondeu como esperado. Tente de novo.",
  };

  const NO_AI =
    "Não encontrei uma resposta para isso. Tente perguntar de outro jeito, ou diga “o que você sabe fazer” para ver exemplos.";
  const NO_ANSWER = "Não encontrei uma resposta para isso. Tente perguntar de outro jeito, por exemplo “o que é…” ou “quem foi…”.";
  let hintedAI = false;

  /** Sem IA: tenta a Wikipédia; o convite para ativar a IA aparece uma vez por sessão. */
  async function withoutAI(input) {
    const found = await H.knowledge?.lookup(input).catch(() => null);
    if (found) return found;
    if (hintedAI) return { text: NO_ANSWER };
    hintedAI = true;
    return { text: NO_AI };
  }

  /**
   * Responde ao dono. Resolve com { text, sources?, images?, goalsChanged? }.
   * Com `image` (foto enviada), vai direto para a IA.
   */
  async function respond(input, { settings, setName, memory = [], image = null }) {
    const named = !image && input.match(NAME_PATTERN);
    const name = named && extractName(named[1]);
    if (name && setName) {
      setName(name);
      const creator = /\bcriador\b/i.test(input) ? " É uma honra conhecer quem me criou. Estou ao seu dispor." : " A partir de agora, é assim que vou chamar você.";
      return { text: `Muito prazer, ${name}.${creator}` };
    }

    const text = normalize(input);
    const now = new Date();
    let reply = null;
    if (!image) {
      const all = [
        ...intents.slice(0, 1),
        ...(H.news?.intents || []),
        ...(H.smart?.intents || []),
        ...(H.goals?.intents || []),
        ...(H.skills?.intents || []),
        ...intents.slice(1),
      ];
      for (const intent of all) {
        if (!intent.match.test(text) || (intent.also && !intent.also.test(text))) continue;
        const r = await intent.reply({ now, settings, text, input });
        if (r) {
          // Habilidades devolvem texto, ou { text, sources, images }
          reply = typeof r === "string" ? { text: r } : r;
          break;
        }
      }
    }

    if (!reply) {
      if (H.ai?.isReady(settings)) {
        try {
          reply = await H.ai.ask(input, { settings, memory, image });
        } catch (e) {
          // Se a IA falhar (rede, créditos...), a Wikipédia ainda pode responder.
          const backup = !image && e.code !== "refusal" ? await H.knowledge?.lookup(input).catch(() => null) : null;
          reply = backup
            ? { ...backup, text: `${AI_ERRORS[e.code] || AI_ERRORS.service} Enquanto isso: ${backup.text}` }
            : { text: AI_ERRORS[e.code] || AI_ERRORS.service };
        }
      } else if (image) {
        reply = { text: "Para eu ver imagens, ative minha inteligência em Personalização → Inteligência." };
      } else {
        reply = await withoutAI(input);
      }
    }

    if (!settings.name) {
      if (!askedName) {
        askedName = true;
        reply.text = `${reply.text}\nAliás, como devo chamar você? Diga “meu nome é…”.`;
      }
      return reply;
    }
    reply.text = address(reply.text, settings.name);
    return reply;
  }

  H.brain = { respond };
})((window.Horacio = window.Horacio || {}));
