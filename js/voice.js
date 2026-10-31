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
  // No Android o começo da palavra pode se perder enquanto o reconhecedor liga: aceita pedaços.
  const WAKE_FRAGMENT = /^\s*(h?o?r[aá]cio|r[aá]cio|ac[ií]o|oraci[oa]|o r[aá]cio)\b/i;

  // No Android, o próprio sistema toca um bipe toda vez que o reconhecedor liga ou desliga.
  // Para não bipar sem parar, lá o Horácio só mede o volume do microfone (sem bipe)
  // e liga o reconhecedor apenas quando alguém fala.
  const ANDROID = /Android/i.test(navigator.userAgent);

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
    stopVad();
    wake.rec?.abort();
  }

  /* Detector de voz silencioso (Android) */

  const vad = { stream: null, ctx: null, timer: 0 };

  async function startVad() {
    if (vad.stream || !navigator.mediaDevices?.getUserMedia) return;
    try {
      vad.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      // Sem acesso ao microfone por esse caminho: volta ao modo comum.
      wake.triggered = true;
      return runWake();
    }
    if (!wake.enabled || wake.rec || rec) return stopVad();
    vad.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    vad.ctx.resume?.().catch(() => {});
    const analyser = vad.ctx.createAnalyser();
    analyser.fftSize = 1024;
    vad.ctx.createMediaStreamSource(vad.stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let noise = 0.01;
    let loud = 0;
    vad.timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      // O nível de ruído do ambiente se ajusta sozinho.
      if (rms < noise * 2) noise = noise * 0.95 + rms * 0.05;
      loud = rms > Math.max(0.02, noise * 3.5) ? loud + 1 : 0;
      if (loud >= 2) {
        stopVad();
        wake.triggered = true;
        runWake();
      }
    }, 60);
  }

  function stopVad() {
    clearInterval(vad.timer);
    vad.stream?.getTracks().forEach((t) => t.stop());
    vad.stream = null;
  }

  const isWakeOn = () => wake.enabled;

  function runWake() {
    clearTimeout(wake.timer);
    if (!wake.enabled || wake.rec || rec || isSpeaking()) return;
    if (ANDROID && !wake.triggered) return startVad();
    const fromVad = wake.triggered;
    wake.triggered = false;

    const r = new Recognition();
    r.lang = "pt-BR";
    // Acionado pelo detector de voz: escuta uma frase só (menos bipes).
    r.continuous = !fromVad;
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
        const pattern = fromVad && !alts.some((t) => WAKE_WORD.test(t)) ? WAKE_FRAGMENT : WAKE_WORD;
        const said = alts.find((t) => pattern.test(t));
        if (!said) continue;
        wake.failures = 0;
        const command = said.slice(said.search(pattern)).replace(pattern, "").replace(/^[\s,.!?]+/, "").trim();
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
    stopVad();
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

  /* ---------- Efeitos de voz (só para o áudio do ElevenLabs) ---------- */

  // Timbre sintético: graves encorpados, brilho nos agudos, um leve "pente" metálico
  // (atraso curto com realimentação) e uma modulação em anel bem sutil.
  const FX = {
    assistente: { low: 3, high: 3, delay: 0.006, feedback: 0.2, wet: 0.25, ring: 0.08, ringHz: 60 },
    robo: { low: 4, high: 2, delay: 0.011, feedback: 0.45, wet: 0.45, ring: 0.3, ringHz: 45 },
  };
  const fx = { ctx: null, source: null, preset: "natural", nodes: [] };

  function ensureFx() {
    if (fx.ctx || !audio) return fx.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    fx.ctx = new Ctx();
    fx.source = fx.ctx.createMediaElementSource(audio);
    buildFx();
    return fx.ctx;
  }

  function buildFx() {
    const c = fx.ctx;
    fx.source.disconnect();
    fx.nodes.forEach((n) => {
      try { n.disconnect(); n.stop?.(); } catch {}
    });
    fx.nodes = [];
    const P = FX[fx.preset];
    if (!P) {
      fx.source.connect(c.destination);
      return;
    }
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 80;
    const low = c.createBiquadFilter();
    low.type = "lowshelf";
    low.frequency.value = 180;
    low.gain.value = P.low;
    const high = c.createBiquadFilter();
    high.type = "highshelf";
    high.frequency.value = 5000;
    high.gain.value = P.high;
    const dry = c.createGain();
    dry.gain.value = 1 - P.wet * 0.5;
    const delay = c.createDelay(0.05);
    delay.delayTime.value = P.delay;
    const feedback = c.createGain();
    feedback.gain.value = P.feedback;
    const wet = c.createGain();
    wet.gain.value = P.wet;
    const mix = c.createGain();
    const ring = c.createGain();
    ring.gain.value = 1 - P.ring;
    const osc = c.createOscillator();
    osc.frequency.value = P.ringHz;
    const depth = c.createGain();
    depth.gain.value = P.ring;
    osc.connect(depth).connect(ring.gain);
    osc.start();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;

    fx.source.connect(hp).connect(low).connect(high);
    high.connect(dry).connect(mix);
    high.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(mix);
    mix.connect(ring).connect(comp).connect(c.destination);
    fx.nodes = [hp, low, high, dry, delay, feedback, wet, mix, ring, osc, depth, comp];
  }

  function setEffect(preset) {
    const next = FX[preset] ? preset : "natural";
    if (next === fx.preset) return;
    fx.preset = next;
    if (fx.ctx) buildFx();
  }

  function play(url, onStart, effect) {
    setEffect(effect);
    if (fx.preset !== "natural" || fx.ctx) {
      ensureFx();
      fx.ctx?.resume?.().catch(() => {});
    }
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
          await play(await elevenAudio(speakable(text), el), opts.onStart, opts.effect);
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
      // O contexto de áudio dos efeitos precisa nascer de um toque (iOS).
      ensureFx()?.resume?.().catch(() => {});
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
