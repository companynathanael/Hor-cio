/*
  Voz do Horácio: ouvir (reconhecimento de fala) e falar (síntese de voz).
  Usa a Web Speech API do navegador — sem servidores próprios.

  Dois modos de ouvir:
  - listen(): escuta uma frase (ao tocar no microfone ou no orbe);
  - modo vigília (startWake): escuta o tempo todo, esperando ouvir "Horácio".
*/
(function (H) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;

  const canListen = Boolean(Recognition);
  const canSpeak = Boolean(synth) && "SpeechSynthesisUtterance" in window;

  // Mais lento e mais grave que o padrão: dá peso e corpo à fala.
  const RATE = { calmo: 0.8, sereno: 0.88, vivo: 0.98 };
  const PITCH = { profundo: 0.3, grave: 0.5, medio: 0.75 };

  const MALE = /antonio|ant[oô]nio|donato|f[aá]bio|humberto|j[uú]lio|nicolau|val[eé]rio|felipe|daniel|ricardo|thiago|cristiano|duarte|male|masculin|homem/i;
  const FEMALE = /francisca|luciana|maria|joana|brenda|elza|giovanna|leila|let[ií]cia|manuela|thalita|yara|camila|vit[oó]ria|raquel|fernanda|catarina|female|feminin|mulher/i;
  const NATURAL = /natural|neural|online|premium|enhanced|aprimorad|melhorad/i;

  // Como o reconhecedor costuma escrever "Horácio".
  const WAKE_WORD = /\b(h?or[aá]cio|o r[aá]cio|ho racio|horas cio)\b/i;

  let rec = null;
  let unlocked = false;

  /* ---------- Ouvir uma frase ---------- */

  /**
   * Começa a ouvir. Resolve com o texto falado ("" se nada foi entendido).
   * onInterim recebe a transcrição parcial enquanto a pessoa fala.
   */
  async function listen({ onInterim, onError } = {}) {
    if (!canListen) return "";
    stopSpeaking();
    abortListening();
    await pauseWake();

    const text = await new Promise((resolve) => {
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

    resumeWake();
    return text;
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

  /* ---------- Modo vigília: chamar pelo nome ---------- */

  const wake = {
    enabled: false,
    rec: null,
    ended: null,       // promessa resolvida quando o reconhecedor encerra
    timer: 0,
    handlers: {},
    failures: 0,
  };

  /**
   * Passa a ouvir continuamente, esperando "Horácio".
   * onCommand(texto): a pessoa disse "Horácio, <pedido>".
   * onWake(): a pessoa disse só "Horácio" e espera ser atendida.
   * onStop(motivo): o navegador encerrou o modo vigília (ex.: sem permissão).
   */
  function startWake(handlers) {
    if (!canListen) return false;
    wake.handlers = handlers;
    wake.enabled = true;
    wake.failures = 0;
    runWake();
    return true;
  }

  function stopWake() {
    wake.enabled = false;
    clearTimeout(wake.timer);
    wake.rec?.abort();
  }

  const isWakeOn = () => wake.enabled;

  function runWake() {
    clearTimeout(wake.timer);
    if (!wake.enabled || wake.rec || rec || isSpeaking()) return;

    const r = new Recognition();
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 3;
    wake.rec = r;

    let finish;
    wake.ended = new Promise((res) => (finish = res));

    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result.isFinal) continue;
        const alts = Array.from(result, (a) => a.transcript);
        const said = alts.find((t) => WAKE_WORD.test(t));
        if (!said) continue;
        wake.failures = 0;
        const command = said.slice(said.search(WAKE_WORD)).replace(WAKE_WORD, "").replace(/^[\s,.!?]+/, "").trim();
        r.abort();
        if (command) wake.handlers.onCommand?.(command);
        else wake.handlers.onWake?.();
        return;
      }
    };

    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
        wake.enabled = false;
        wake.handlers.onStop?.(e.error);
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        wake.failures++;
      }
    };

    r.onend = () => {
      wake.rec = null;
      finish();
      if (wake.failures > 5) {
        wake.enabled = false;
        wake.handlers.onStop?.("network");
        return;
      }
      // O navegador encerra a escuta após um silêncio; recomeçamos.
      scheduleWake(wake.failures ? 1500 : 250);
    };

    try {
      r.start();
    } catch {
      wake.rec = null;
      finish();
      scheduleWake(1000);
    }
  }

  function scheduleWake(ms) {
    clearTimeout(wake.timer);
    if (wake.enabled) wake.timer = setTimeout(runWake, ms);
  }

  /** Suspende a vigília (enquanto o Horácio fala ou ouve uma frase). */
  async function pauseWake() {
    clearTimeout(wake.timer);
    if (!wake.rec) return;
    const ended = wake.ended;
    wake.rec.abort();
    await Promise.race([ended, new Promise((r) => setTimeout(r, 700))]);
  }

  function resumeWake() {
    scheduleWake(400);
  }

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
    return (
      (lang === "pt-br" ? 8 : 0) +
      (MALE.test(v.name) ? 6 : 0) +
      (NATURAL.test(v.name) ? 4 : 0) -
      (FEMALE.test(v.name) ? 6 : 0) +
      (v.localService ? 1 : 0)
    );
  }

  const isMale = (v) => MALE.test(v.name) && !FEMALE.test(v.name);
  const isNatural = (v) => NATURAL.test(v.name);

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
  async function speak(text, { voiceName = "", rhythm = "sereno", tone = "profundo", onStart } = {}) {
    if (!canSpeak || !text) return;
    synth.cancel();
    await pauseWake(); // não ouvir a si mesmo

    await new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(speakable(text));
      const voice = pickVoice(voiceName);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || "pt-BR";
      u.rate = RATE[rhythm] || 1;
      u.pitch = PITCH[tone] ?? PITCH.profundo;
      u.onstart = () => onStart?.();
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });

    resumeWake();
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
    startWake,
    stopWake,
    isWakeOn,
    speak,
    stopSpeaking,
    isSpeaking,
    voices,
    pickVoice,
    isMale,
    isNatural,
    unlock,
    onVoicesChanged,
  };
})((window.Horacio = window.Horacio || {}));
