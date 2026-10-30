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
