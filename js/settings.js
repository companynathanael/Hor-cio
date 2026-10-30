/* Preferências do usuário, guardadas no navegador. */
(function (H) {
  const KEY = "horacio.settings.v1";

  const defaults = {
    name: "",
    era: "auto",        // auto | aurora | tarde | crepusculo | meianoite
    hour24: true,
    seconds: false,
    rhythm: "sereno",   // calmo | sereno | vivo
  };

  const RHYTHM = { calmo: 1.6, sereno: 1, vivo: 0.6 };

  function load() {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    } catch {
      return { ...defaults };
    }
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
