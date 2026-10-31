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
  const NAME_PATTERN = /(?:meu nome [ée]|me chame de|me chama de|pode me chamar de|eu sou o|eu sou a)\s+([\p{L}][\p{L}' -]{0,31})/iu;

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
      match: /\b(fim do ano|final do ano|ano novo|reveillon|natal)\b/,
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
        "Por enquanto, sou especialista em tempo. Experimente:\n" +
        "· Que horas são?\n· Que dia é hoje?\n· Quanto falta para o fim do ano?\n" +
        "· Quanto falta para a meia-noite?\n· Quanto do ano já passou?\n" +
        "· A quantos minutos estou de casa?",
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
  function address(reply, name) {
    if (!name || reply.includes(name)) return reply;
    if (Math.random() < 0.5) {
      return `${name}, ${reply.charAt(0).toLowerCase()}${reply.slice(1)}`;
    }
    const end = reply.search(/[.!?](\s|$)/);
    if (end === -1) return `${reply}, ${name}`;
    return `${reply.slice(0, end)}, ${name}${reply.slice(end)}`;
  }

  async function respond(input, { settings, setName }) {
    const named = input.match(NAME_PATTERN);
    if (named && setName) {
      const name = titleCase(named[1]);
      setName(name);
      return `Muito prazer, ${name}. A partir de agora, é assim que vou chamar você.`;
    }

    const text = normalize(input);
    const now = new Date();
    const intent = intents.find((i) => i.match.test(text) && (!i.also || i.also.test(text)));
    const reply = intent
      ? await intent.reply({ now, settings, text })
      : "Ainda estou aprendendo. Nesta versão eu entendo de tempo — pergunte as horas, a data ou quanto falta para o fim do ano.";

    if (!settings.name) {
      if (askedName) return reply;
      askedName = true;
      return `${reply}\nAliás, como devo chamar você? Diga “meu nome é…”.`;
    }
    return address(reply, settings.name);
  }

  H.brain = { respond };
})((window.Horacio = window.Horacio || {}));
