/*
  Voz do Horácio: ouvir (reconhecimento de fala) e falar (síntese de voz).
  Usa a Web Speech API do navegador — sem servidores próprios.
*/
(function (H) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;

  const canListen = Boolean(Recognition);
  const canSpeak = Boolean(synth) && "SpeechSynthesisUtterance" in window;

  const RATE = { calmo: 0.9, sereno: 1, vivo: 1.12 };

  // Vozes masculinas conhecidas em pt-BR, preferidas para o Horácio.
  const PREFERRED = /felipe|daniel|antonio|ant[oô]nio|fabio|f[aá]bio|humberto|ricardo|male|masculin/i;

  let rec = null;
  let unlocked = false;

  /* ---------- Ouvir ---------- */

  /**
   * Começa a ouvir. Resolve com o texto falado ("" se nada foi entendido).
   * onInterim recebe a transcrição parcial enquanto a pessoa fala.
   */
  function listen({ onInterim, onError } = {}) {
    if (!canListen) return Promise.resolve("");
    stopSpeaking();
    abortListening();

    return new Promise((resolve) => {
      let finalText = "";
      rec = new Recognition();
      rec.lang = "pt-BR";
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;

      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else interim += r[0].transcript;
        }
        onInterim?.((finalText + interim).trim());
      };
      rec.onerror = (e) => {
        if (e.error !== "aborted" && e.error !== "no-speech") onError?.(e.error);
      };
      rec.onend = () => {
        rec = null;
        resolve(finalText.trim());
      };

      try {
        rec.start();
      } catch {
        rec = null;
        resolve("");
      }
    });
  }

  /** Para de ouvir e entrega o que já foi dito. */
  function stopListening() {
    rec?.stop();
  }

  /** Para de ouvir e descarta. */
  function abortListening() {
    rec?.abort();
  }

  const isListening = () => rec !== null;

  /* ---------- Falar ---------- */

  function voices() {
    if (!canSpeak) return [];
    return synth
      .getVoices()
      .filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("pt"))
      .sort((a, b) => rank(b) - rank(a));
  }

  function rank(v) {
    const lang = v.lang.toLowerCase().replace("_", "-");
    return (lang === "pt-br" ? 4 : 0) + (PREFERRED.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
  }

  function pickVoice(name) {
    const list = voices();
    return list.find((v) => v.name === name) || list[0] || null;
  }

  /** Ajusta o texto para soar natural em voz alta. */
  function speakable(text) {
    return text
      .replace(/(\d{1,2}):(\d{2})(?::\d{2})?(\s?[AP]M)?/gi, (_, h, m) => {
        const hours = Number(h);
        const mins = Number(m);
        const hh = `${hours} ${hours === 1 ? "hora" : "horas"}`;
        return mins ? `${hh} e ${mins} ${mins === 1 ? "minuto" : "minutos"}` : `${hh} em ponto`;
      })
      .replace(/(\d+),(\d+)%/g, "$1 vírgula $2 por cento")
      .replace(/·/g, "")
      .replace(/\n+/g, ". ")
      .replace(/—/g, ",");
  }

  /** Fala o texto. Resolve quando termina (ou é interrompido). */
  function speak(text, { voiceName = "", rhythm = "sereno", onStart } = {}) {
    if (!canSpeak || !text) return Promise.resolve();
    synth.cancel();

    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(speakable(text));
      const voice = pickVoice(voiceName);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || "pt-BR";
      u.rate = RATE[rhythm] || 1;
      u.pitch = 0.92;
      u.onstart = () => onStart?.();
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  }

  function stopSpeaking() {
    if (canSpeak && (synth.speaking || synth.pending)) synth.cancel();
  }

  const isSpeaking = () => canSpeak && synth.speaking;

  /**
   * Alguns navegadores (iOS) só liberam a fala após um toque do usuário.
   * Chamado nos primeiros toques para destravar a síntese.
   */
  function unlock() {
    if (unlocked || !canSpeak) return;
    unlocked = true;
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    synth.speak(u);
  }

  function onVoicesChanged(fn) {
    if (canSpeak) synth.addEventListener?.("voiceschanged", fn);
  }

  H.voice = {
    canListen,
    canSpeak,
    listen,
    stopListening,
    abortListening,
    isListening,
    speak,
    stopSpeaking,
    isSpeaking,
    voices,
    unlock,
    onVoicesChanged,
  };
})((window.Horacio = window.Horacio || {}));
