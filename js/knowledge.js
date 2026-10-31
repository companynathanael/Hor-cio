/*
  Conhecimento geral sem chave de IA: resume o verbete mais relevante da
  Wikipédia em português (gratuito), com a fonte e a imagem do artigo.
*/
(function (H) {
  const WIKI = "https://pt.wikipedia.org";

  // Tira o "jeito de pergunta" e deixa o assunto: "o que é um buraco negro?" → "buraco negro"
  const LEADS = [
    /^(?:hor[aá]cio[,!\s]+)/i,
    /^(?:me\s+)?(?:fale|fala|conte|conta|explique|explica|diga|diz)\s+(?:um pouco\s+)?(?:sobre|a respeito de|do|da|de|o que [ée])\s+/i,
    /^(?:pesquis[ae]|procur[ae]|busqu?e)\s+(?:sobre\s+|por\s+)?/i,
    /^(?:voc[eê]\s+)?(?:sabe|conhece)\s+(?:quem|o que)\s+(?:[ée]|foi|s[aã]o|eram?)\s+/i,
    /^o\s+que\s+(?:[ée]|s[aã]o|era|foi|significa|quer dizer)\s+/i,
    /^quem\s+(?:[ée]|foi|era|s[aã]o|foram|inventou|descobriu|criou|escreveu|pintou)\s+/i,
    /^(?:onde\s+fica|onde\s+[ée]|quando\s+foi|quando\s+[ée]|como\s+funciona|para\s+que\s+serve|pra\s+que\s+serve)\s+/i,
    /^qual\s+(?:[ée]\s+)?(?:a|o)?\s*/i,
    /^quais\s+(?:s[aã]o\s+)?(?:as|os)?\s*/i,
  ];

  function topicOf(question) {
    let t = question.trim().replace(/[?!.]+$/, "");
    for (const re of LEADS) t = t.replace(re, "");
    return t.replace(/^(?:o|a|os|as|um|uma)\s+/i, "").trim();
  }

  async function getJSON(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  /** As 2 ou 3 primeiras frases, sem passar muito de 400 caracteres. */
  function brief(text) {
    const sentences = text.replace(/\s*\([^)]*\)/g, "").match(/[^.!?]+[.!?]+/g) || [text];
    let out = "";
    for (const s of sentences) {
      if (out && (out + s).length > 400) break;
      out += s;
      if (out.length > 220) break;
    }
    return out.trim();
  }

  /**
   * Procura a resposta na Wikipédia.
   * Resolve com { text, sources, images } ou null se não achar nada útil.
   */
  async function lookup(question) {
    const topic = topicOf(question);
    if (topic.length < 2) return null;
    let hits;
    try {
      const q = encodeURIComponent(topic);
      const data = await getJSON(`${WIKI}/w/api.php?action=query&list=search&srsearch=${q}&srlimit=3&format=json&origin=*`);
      hits = data.query?.search || [];
    } catch {
      return null;
    }
    for (const hit of hits) {
      let page;
      try {
        page = await getJSON(`${WIKI}/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replace(/ /g, "_"))}`);
      } catch {
        continue;
      }
      if (page.type === "disambiguation" || !page.extract) continue;
      const url = page.content_urls?.mobile?.page || page.content_urls?.desktop?.page || `${WIKI}/wiki/${encodeURIComponent(hit.title)}`;
      const images = page.thumbnail?.source
        ? [{ thumb: page.thumbnail.source, url, title: page.title }]
        : [];
      return {
        text: `Segundo a Wikipédia: ${brief(page.extract)}`,
        sources: [{ url, title: `Wikipédia — ${page.title}` }],
        images,
      };
    }
    return null;
  }

  H.knowledge = { lookup, topicOf };
})((window.Horacio = window.Horacio || {}));
