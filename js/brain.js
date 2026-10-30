/*
  O "cérebro" do Horácio — HoV 0.1.
  Por enquanto, respostas locais sobre o tempo. Nas próximas versões,
  este módulo passa a conversar com um modelo de IA, mantendo a mesma
  interface: respond(texto, contexto) -> Promise<string>.
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

  const intents = [
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
        "· Quanto falta para a meia-noite?\n· Quanto do ano já passou?",
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

  async function respond(input, { settings }) {
    const text = normalize(input);
    const now = new Date();
    const intent = intents.find((i) => i.match.test(text));
    if (intent) return intent.reply({ now, settings, text });
    return "Ainda estou aprendendo. Nesta versão eu entendo de tempo — pergunte as horas, a data ou quanto falta para o fim do ano.";
  }

  H.brain = { respond };
})((window.Horacio = window.Horacio || {}));
