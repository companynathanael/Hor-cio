/* Preferências do usuário, guardadas no navegador. */
(function (H) {
  const KEY = "horacio.settings.v1";

  const defaults = {
    name: "",
    era: "auto",        // auto | aurora | tarde | crepusculo | meianoite
    hour24: true,
    seconds: false,
    rhythm: "sereno",   // calmo | sereno | vivo
    speak: "voz",       // sempre | voz (quando eu falar) | nunca
    voiceName: "",      // "" = escolha automática
    continuous: false,  // volta a ouvir depois de responder
    tone: "profundo",   // profundo | grave | medio
    wake: false,        // modo vigília: chamar pelo nome
    engine: "navegador",              // navegador | elevenlabs
    elVoiceId: "",
    elKey: "",                        // fica apenas neste aparelho
    elModel: "eleven_multilingual_v2",
    places: { casa: null, trabalho: null }, // { lat, lon, label }
    travel: "carro",    // carro | bicicleta | ape
    aiKey: "",          // chave da Anthropic; fica apenas neste aparelho
    aiModel: "claude-opus-5-5",
    aiSearch: true,     // a IA pode buscar na web
  };

  const RHYTHM = { calmo: 1.6, sereno: 1, vivo: 0.6 };

  const TONES = ["profundo", "grave", "medio"];

  function load() {
    let s;
    try {
      s = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    } catch {
      return { ...defaults };
    }
    // v2: a voz ficou mais grave; quem já usava passa para "Profundo".
    if (!s.v) {
      s.v = 2;
      s.tone = "profundo";
    }
    if (!TONES.includes(s.tone)) s.tone = defaults.tone;
    s.places = { ...defaults.places, ...(s.places || {}) };
    return s;
  }

  function save(settings) {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* armazenamento indisponível: segue apenas em memória */
    }
  }

  H.settings = { defaults, load, save, RHYTHM };
})((window.Horacio = window.Horacio || {}));
