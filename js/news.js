/*
  Notícias do momento, sem chave: manchetes recentes em português do GDELT
  (projeto público que monitora jornais do mundo todo). O Horácio lê só os
  títulos e mostra o link de cada jornal.
*/
(function (H) {
  const API = "https://api.gdeltproject.org/api/v2/doc/doc";

  // Regiões e temas comuns → termos de busca
  const TOPICS = [
    [/europa|europeu|europeia|uniao europeia/, "europa", "a Europa"],
    [/estados unidos|eua|americano/, "\"estados unidos\"", "os Estados Unidos"],
    [/china|chines/, "china", "a China"],
    [/russia|russo/, "russia", "a Rússia"],
    [/ucrania/, "ucrania", "a Ucrânia"],
    [/israel|gaza|palestin|oriente medio/, "(israel OR gaza OR \"oriente medio\")", "o Oriente Médio"],
    [/america latina|argentina|venezuela/, "(\"america latina\" OR argentina OR venezuela)", "a América Latina"],
    [/africa/, "africa", "a África"],
    [/asia|japao|india|coreia/, "(asia OR japao OR india OR coreia)", "a Ásia"],
    [/economia|mercado|bolsa|dolar|inflacao/, "(economia OR mercado OR inflacao)", "a economia"],
    [/politica|governo|eleic/, "(governo OR politica OR eleicao)", "a política"],
    [/tecnologia|inteligencia artificial|\bia\b/, "(tecnologia OR \"inteligencia artificial\")", "tecnologia"],
    [/esporte|futebol|copa|brasileirao/, "(futebol OR esporte)", "esportes"],
    [/ciencia|espaco|saude/, "(ciencia OR saude OR espaco)", "ciência e saúde"],
    [/brasil|brasileir/, "brasil", "o Brasil"],
    [/mundo|internacional|global/, "(mundo OR internacional)", "o mundo"],
  ];

  function plain(s) {
    return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  /** Assunto da pergunta: tema conhecido ou o que vem depois de "sobre/na/no/em". */
  function topicOf(t) {
    const known = TOPICS.find(([re]) => re.test(t));
    if (known) return { query: known[1], label: known[2] };
    const m = t.match(/\b(?:sobre|na|no|em|da|do|de)\s+([a-z][a-z\s]{2,30})$/);
    if (m && !/^(hoje|agora|momento|semana|dia|mundo)$/.test(m[1].trim())) {
      const word = m[1].trim().split(" ").filter((w) => w.length > 2).slice(0, 3).join(" ");
      if (word) return { query: `"${word}"`, label: word };
    }
    return { query: "(brasil OR mundo OR governo OR economia)", label: "" };
  }

  /** Remove o nome do jornal que costuma vir no fim do título ("... - Jornal X"). */
  function cleanTitle(title) {
    return title.replace(/\s+[-|–]\s+[^-|–]{2,40}$/, "").replace(/\s+/g, " ").trim();
  }

  async function headlines(query) {
    const q = encodeURIComponent(`${query} sourcelang:portuguese`);
    const url = `${API}?query=${q}&mode=artlist&format=json&maxrecords=15&timespan=2d&sort=hybridrel`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const text = await res.text();
    const data = JSON.parse(text || "{}");
    const seen = new Set();
    return (data.articles || [])
      .map((a) => ({ title: cleanTitle(a.title || ""), url: a.url, domain: (a.domain || "").replace(/^www\./, "") }))
      .filter((a) => {
        const key = plain(a.title).slice(0, 50);
        if (a.title.length < 15 || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 3);
  }

  async function newsReply(input) {
    const t = plain(input).replace(/[?!.,]/g, " ").replace(/\s+/g, " ").trim();
    const { query, label } = topicOf(t);
    let list;
    try {
      list = await headlines(query);
    } catch {
      return { text: "Não consegui buscar as notícias agora. Tente de novo em instantes." };
    }
    if (!list.length) {
      return { text: `Não encontrei notícias recentes${label ? ` sobre ${label}` : ""} agora.` };
    }
    const order = ["Primeiro", "Depois", "E também"];
    const lines = list.map((a, i) => `${order[i]}: ${a.title}${/[.!?]$/.test(a.title) ? "" : "."}`);
    return {
      text: `Os destaques mais recentes${label ? ` sobre ${label}` : ""}. ${lines.join(" ")}`,
      sources: list.map((a) => ({ url: a.url, title: a.title })),
    };
  }

  const intents = [
    {
      match: /\b(noticias?|manchetes?|novidades|aconteceu|acontecendo|acontece|ocorre|ocorrendo|ocorreu|o que ha de novo|ultimas)\b/,
      // Evita confundir com "o que aconteceu em 1500" (histórico): só notícias do momento
      reply: ({ text, input }) => (/\b\d{3,4}\b/.test(text) && !/noticia/.test(text) ? null : newsReply(input)),
    },
  ];

  H.news = { intents, newsReply, topicOf };
})((window.Horacio = window.Horacio || {}));
