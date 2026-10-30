/*
  Voz do Horácio: ouvir (reconhecimento de fala) e falar (síntese de voz).
  Usa a Web Speech API do navegador — sem servidores próprios — e,
  opcionalmente, uma voz criada no ElevenLabs.

  Dois modos de ouvir:
  - listen(): escuta uma frase (ao tocar no microfone ou no orbe);
  - modo vigília (startWake): escuta o tempo todo, esperando ouvir "Horácio".
*/
(function (H) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;

  const hasSynth = Boolean(synth) && "SpeechSynthesisUtterance" in window;
  const audio = typeof Audio === "function" ? new Audio() : null;

  const canListen = Boolean(Recognition);
  const canSpeak = hasSynth || Boolean(audio);

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
    if (!hasSynth) return [];
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

  /* ---------- ElevenLabs ---------- */

  const EL_API = "https://api.elevenlabs.io/v1/text-to-speech/";
  const EL_DEFAULT_MODEL = "eleven_multilingual_v2";
  const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

  const cache = new Map(); // frase → áudio já gerado (economiza créditos)
  let fetchCtl = null;

  class VoiceError extends Error {
    constructor(code) {
      super(code);
      this.code = code;
    }
  }

  function errorCode(status, detail) {
    const d = String(detail?.status || detail?.code || detail || "").toLowerCase();
    if (d.includes("quota") || d.includes("credit") || status === 402) return "quota";
    if (d.includes("voice") || status === 404) return "voice";
    if (d.includes("model")) return "model";
    if (status === 401 || status === 403 || d.includes("key")) return "key";
    if (status === 429) return "busy";
    return "service";
  }

  async function elevenAudio(text, { key, voiceId, model }) {
    const modelId = model || EL_DEFAULT_MODEL;
    const id = `${voiceId}|${modelId}|${text}`;
    if (cache.has(id)) return cache.get(id);

    fetchCtl = new AbortController();
    let res;
    try {
      res = await fetch(`${EL_API}${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text, model_id: modelId }),
        signal: fetchCtl.signal,
      });
    } catch (e) {
      throw new VoiceError(e.name === "AbortError" ? "aborted" : "network");
    } finally {
      fetchCtl = null;
    }

    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.json()).detail;
      } catch {}
      throw new VoiceError(errorCode(res.status, detail));
    }

    const url = URL.createObjectURL(await res.blob());
    cache.set(id, url);
    if (cache.size > 30) {
      const [oldest, oldUrl] = cache.entries().next().value;
      URL.revokeObjectURL(oldUrl);
      cache.delete(oldest);
    }
    return url;
  }

  function play(url, onStart) {
    return new Promise((resolve, reject) => {
      audio.onplaying = () => onStart?.();
      audio.onended = audio.onpause = audio.onerror = () => resolve();
      audio.src = url;
      audio.play().catch(() => reject(new VoiceError("blocked")));
    });
  }

  function speakBrowser(text, { voiceName = "", rhythm = "sereno", tone = "profundo", onStart } = {}) {
    return new Promise((resolve) => {
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
  }

  /**
   * Fala o texto. Resolve quando termina (ou é interrompido).
   * Com `eleven` ({ key, voiceId, model }) usa a voz do ElevenLabs; se ela
   * falhar, avisa por onError(código) e fala com a voz do aparelho.
   */
  async function speak(text, opts = {}) {
    if (!canSpeak || !text) return;
    stopSpeaking();
    await pauseWake(); // não ouvir a si mesmo

    try {
      const el = opts.eleven;
      if (el?.key && el?.voiceId && audio) {
        try {
          await play(await elevenAudio(speakable(text), el), opts.onStart);
          return;
        } catch (e) {
          if (e.code === "aborted") return;
          opts.onError?.(e.code || "service");
        }
      }
      if (hasSynth) await speakBrowser(text, opts);
    } finally {
      resumeWake();
    }
  }

  function stopSpeaking() {
    fetchCtl?.abort();
    if (audio && !audio.paused) audio.pause();
    if (hasSynth && (synth.speaking || synth.pending)) synth.cancel();
  }

  const isSpeaking = () =>
    Boolean(fetchCtl) || Boolean(audio && !audio.paused) || (hasSynth && synth.speaking);

  /**
   * Alguns navegadores (iOS) só liberam o som após um toque do usuário.
   * Chamado nos primeiros toques para destravar a fala e o áudio.
   */
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (hasSynth) {
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      synth.speak(u);
    }
    if (audio) {
      audio.src = SILENCE;
      audio.play().catch(() => {});
    }
  }

  function onVoicesChanged(fn) {
    if (hasSynth) synth.addEventListener?.("voiceschanged", fn);
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
