/* Orquestra a interface do Horácio. */
(function (H) {
  const $ = (sel) => document.querySelector(sel);
  const T = H.time;

  const MEMORY_KEY = "horacio.memory.v1";
  const LAST_SEEN_KEY = "horacio.lastSeen";
  const MEMORY_LIMIT = 60;

  const THEME_COLOR = {
    aurora: "#F5EDE0",
    tarde: "#E9DCC6",
    crepusculo: "#221710",
    meianoite: "#110C09",
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const el = {
    app: $("#app"),
    orb: $("#orb"),
    ticks: $("#ticks"),
    secArc: $("#sec-arc"),
    dotHour: $("#dot-hour"),
    dotMin: $("#dot-min"),
    greeting: $("#greeting"),
    clock: $("#clock"),
    date: $("#date"),
    since: $("#since"),
    log: $("#log"),
    composer: $("#composer"),
    input: $("#input"),
    mic: $("#btn-mic"),
    voiceField: $("#voice-field"),
    voiceHint: $("#voice-hint"),
    voiceSelect: $("#opt-voice"),
    sheet: $("#settings"),
    form: $("#settings-form"),
    themeMeta: document.querySelector('meta[name="theme-color"]'),
  };

  let settings = H.settings.load();
  let memory = loadMemory();
  let busy = false;

  /* ---------- Armazenamento ---------- */

  function loadMemory() {
    try {
      return JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveMemory() {
    try {
      localStorage.setItem(MEMORY_KEY, JSON.stringify(memory.slice(-MEMORY_LIMIT)));
    } catch {}
  }

  function readLastSeen() {
    try {
      return Number(localStorage.getItem(LAST_SEEN_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  function markSeen() {
    try {
      localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    } catch {}
  }

  /* ---------- Orbe ---------- */

  const C = 100, ARC_R = 84, HAND_R = 64;
  const ARC_LEN = 2 * Math.PI * ARC_R;

  function buildTicks() {
    const ns = "http://www.w3.org/2000/svg";
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const a = (i / 60) * Math.PI * 2;
      const r1 = major ? 89 : 92, r2 = 97;
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", C + r1 * Math.sin(a));
      line.setAttribute("y1", C - r1 * Math.cos(a));
      line.setAttribute("x2", C + r2 * Math.sin(a));
      line.setAttribute("y2", C - r2 * Math.cos(a));
      if (major) line.classList.add("major");
      el.ticks.appendChild(line);
    }
    el.secArc.style.strokeDasharray = `${ARC_LEN}`;
  }

  function placeOnDial(node, fraction, r) {
    const a = fraction * Math.PI * 2;
    node.setAttribute("cx", (C + r * Math.sin(a)).toFixed(2));
    node.setAttribute("cy", (C - r * Math.cos(a)).toFixed(2));
  }

  function drawDial(now) {
    const sec = now.getSeconds() + (reducedMotion ? 0 : now.getMilliseconds() / 1000);
    el.secArc.style.strokeDashoffset = ARC_LEN * (1 - sec / 60);
    const min = now.getMinutes() + now.getSeconds() / 60;
    placeOnDial(el.dotMin, min / 60, HAND_R);
    placeOnDial(el.dotHour, ((now.getHours() % 12) + min / 60) / 12, HAND_R);
  }

  /* ---------- Tempo e era ---------- */

  let lastSecond = -1;
  let lastEraKey = "";

  function applyEra(now = new Date()) {
    const era = settings.era === "auto" ? T.period(now).era : settings.era;
    if (era === lastEraKey) return;
    lastEraKey = era;
    document.documentElement.dataset.era = era;
    el.themeMeta.setAttribute("content", THEME_COLOR[era]);
  }

  function renderTime(now) {
    const { greeting } = T.period(now);
    el.greeting.textContent = settings.name ? `${greeting}, ${settings.name}` : greeting;
    el.clock.textContent = T.formatClock(now, settings);
    el.date.textContent = T.formatDate(now);
    applyEra(now);
  }

  function tick() {
    const now = new Date();
    if (now.getSeconds() !== lastSecond) {
      lastSecond = now.getSeconds();
      renderTime(now);
    }
    drawDial(now);
  }

  function startClock() {
    tick();
    if (reducedMotion) {
      setInterval(tick, 1000);
    } else {
      const loop = () => { tick(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }

  function renderSince() {
    const last = readLastSeen();
    if (!last) {
      el.since.textContent = "Muito prazer. Eu sou o Horácio.";
    } else if (Date.now() - last > 5 * 60000) {
      el.since.textContent = `Nossa última conversa foi há ${T.humanize(Date.now() - last)}.`;
    }
    markSeen();
  }

  /* ---------- Conversa ---------- */

  function stamp(t) {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: !settings.hour24 }).format(t);
  }

  function addMessage(role, text, t = Date.now()) {
    const item = document.createElement("article");
    item.className = `msg ${role}`;
    const time = document.createElement("time");
    time.dateTime = new Date(t).toISOString();
    time.textContent = role === "horacio" ? `Horácio · ${stamp(t)}` : stamp(t);
    const p = document.createElement("p");
    p.textContent = text;
    item.append(time, p);
    el.log.appendChild(item);
    el.app.classList.add("is-talking");
    scrollToEnd();
    return p;
  }

  function scrollToEnd() {
    el.log.scrollTop = el.log.scrollHeight;
  }

  function typeInto(node, text) {
    if (reducedMotion) {
      node.textContent = text;
      return Promise.resolve();
    }
    const step = 16 * H.settings.RHYTHM[settings.rhythm];
    node.textContent = "";
    return new Promise((resolve) => {
      let i = 0;
      const timer = setInterval(() => {
        node.textContent = text.slice(0, ++i);
        scrollToEnd();
        if (i >= text.length) { clearInterval(timer); resolve(); }
      }, step);
    });
  }

  function remember(role, text, t) {
    memory.push({ role, text, t });
    memory = memory.slice(-MEMORY_LIMIT);
    saveMemory();
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function setState(state) {
    el.orb.dataset.state = state;
  }

  function shouldSpeak(viaVoice) {
    if (!H.voice.canSpeak) return false;
    return settings.speak === "sempre" || (settings.speak === "voz" && viaVoice);
  }

  async function send(text, { viaVoice = false } = {}) {
    if (busy) return;
    busy = true;
    H.voice.stopSpeaking();
    const t = Date.now();
    addMessage("user", text, t);
    remember("user", text, t);

    setState("thinking");
    const rhythm = H.settings.RHYTHM[settings.rhythm];
    const [reply] = await Promise.all([
      H.brain.respond(text, { settings, memory }),
      wait((450 + Math.random() * 350) * rhythm),
    ]);
    setState("idle");

    const rt = Date.now();
    remember("horacio", reply, rt);
    const node = addMessage("horacio", "", rt);
    const speaking = shouldSpeak(viaVoice);

    if (speaking) {
      await Promise.all([
        typeInto(node, reply),
        H.voice.speak(reply, {
          voiceName: settings.voiceName,
          rhythm: settings.rhythm,
          onStart: () => setState("speaking"),
        }),
      ]);
      if (el.orb.dataset.state === "speaking") setState("idle");
    } else {
      await typeInto(node, reply);
    }
    busy = false;

    if (viaVoice && speaking && settings.continuous) startListening();
  }

  /* ---------- Voz ---------- */

  const VOICE_ERRORS = {
    "not-allowed": "Preciso de permissão para usar o microfone. Libere o acesso nas configurações do navegador.",
    "service-not-allowed": "O navegador bloqueou o reconhecimento de voz nesta página. Abra o Horácio por um endereço https.",
    "audio-capture": "Não encontrei nenhum microfone neste aparelho.",
    network: "Não consegui falar com o serviço de reconhecimento de voz. Verifique sua conexão.",
  };

  function notify(text) {
    // Aviso do sistema: aparece na conversa, mas não entra na memória.
    addMessage("horacio", text);
  }

  async function startListening() {
    if (busy || H.voice.isListening()) return;
    H.voice.unlock();
    setState("listening");
    el.mic.classList.add("is-active");
    el.mic.setAttribute("aria-pressed", "true");
    el.input.placeholder = "Ouvindo…";

    const text = await H.voice.listen({
      onInterim: (t) => { el.input.value = t; },
      onError: (code) => notify(VOICE_ERRORS[code] || "Não consegui ouvir agora. Tente novamente."),
    });

    el.mic.classList.remove("is-active");
    el.mic.setAttribute("aria-pressed", "false");
    el.input.placeholder = "Fale com o Horácio…";
    el.input.value = "";
    if (el.orb.dataset.state === "listening") setState("idle");

    if (text) send(text, { viaVoice: true });
  }

  function toggleListening() {
    if (H.voice.isListening()) H.voice.stopListening();
    else startListening();
  }

  function onOrbActivate() {
    if (H.voice.canListen) toggleListening();
    else H.voice.stopSpeaking();
  }

  function setupVoice() {
    const { canListen, canSpeak } = H.voice;

    if (canListen) {
      el.mic.disabled = false;
      el.mic.addEventListener("click", toggleListening);
      el.orb.classList.add("is-interactive");
      el.orb.setAttribute("role", "button");
      el.orb.setAttribute("tabindex", "0");
      el.orb.setAttribute("aria-label", "Falar com o Horácio");
      el.orb.addEventListener("click", onOrbActivate);
      el.orb.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOrbActivate(); }
      });
    } else {
      el.mic.title = "Este navegador não oferece reconhecimento de voz";
    }

    if (!canListen && !canSpeak) {
      el.voiceField.classList.add("is-unsupported");
      el.voiceHint.textContent = "Este navegador não oferece recursos de voz. Experimente o Chrome ou o Safari.";
    } else if (!canListen) {
      el.voiceHint.textContent = "Este navegador não reconhece fala, mas o Horácio ainda pode responder em voz.";
    }

    H.voice.onVoicesChanged(fillVoiceSelect);
  }

  function fillVoiceSelect() {
    const list = H.voice.voices();
    const options = [new Option("Automática", "")].concat(
      list.map((v) => new Option(`${v.name} (${v.lang})`, v.name))
    );
    el.voiceSelect.replaceChildren(...options);
    el.voiceSelect.value = list.some((v) => v.name === settings.voiceName) ? settings.voiceName : "";
  }

  function restoreMemory() {
    memory.forEach((m) => {
      const node = addMessage(m.role, m.text, m.t);
      node.parentElement.style.animation = "none";
    });
  }

  function forget() {
    memory = [];
    saveMemory();
    el.log.replaceChildren();
    el.app.classList.remove("is-talking");
  }

  /* ---------- Personalização ---------- */

  function fillSettingsForm() {
    const f = el.form;
    f.querySelector("#opt-name").value = settings.name;
    f.querySelector("#opt-hour24").checked = settings.hour24;
    f.querySelector("#opt-seconds").checked = settings.seconds;
    f.querySelector(`input[name="era"][value="${settings.era}"]`).checked = true;
    f.querySelector(`input[name="rhythm"][value="${settings.rhythm}"]`).checked = true;
    f.querySelector(`input[name="speak"][value="${settings.speak}"]`).checked = true;
    f.querySelector("#opt-continuous").checked = settings.continuous;
    fillVoiceSelect();
  }

  function update(patch) {
    settings = { ...settings, ...patch };
    H.settings.save(settings);
    applyRhythm();
    lastEraKey = "";
    renderTime(new Date());
  }

  function applyRhythm() {
    document.documentElement.style.setProperty("--rhythm", H.settings.RHYTHM[settings.rhythm]);
  }

  function bindSettings() {
    $("#btn-settings").addEventListener("click", () => {
      fillSettingsForm();
      el.sheet.showModal();
    });

    // Fecha ao tocar fora do painel
    el.sheet.addEventListener("click", (e) => {
      if (e.target === el.sheet) el.sheet.close();
    });

    el.form.addEventListener("input", (e) => {
      const t = e.target;
      if (t.id === "opt-name") update({ name: t.value.trim() });
      else if (t.id === "opt-hour24") update({ hour24: t.checked });
      else if (t.id === "opt-seconds") update({ seconds: t.checked });
      else if (t.name === "era") update({ era: t.value });
      else if (t.name === "rhythm") update({ rhythm: t.value });
      else if (t.name === "speak") update({ speak: t.value });
      else if (t.id === "opt-voice") update({ voiceName: t.value });
      else if (t.id === "opt-continuous") update({ continuous: t.checked });
    });

    $("#btn-test-voice").addEventListener("click", () => {
      H.voice.unlock();
      const { greeting } = T.period(new Date());
      const name = settings.name ? `, ${settings.name}` : "";
      H.voice.speak(`${greeting}${name}. Eu sou o Horácio, ao seu dispor.`, {
        voiceName: settings.voiceName,
        rhythm: settings.rhythm,
      });
    });

    $("#btn-forget").addEventListener("click", () => {
      forget();
      el.sheet.close();
    });
  }

  /* ---------- Início ---------- */

  function init() {
    applyRhythm();
    buildTicks();
    startClock();
    renderSince();
    restoreMemory();
    bindSettings();
    setupVoice();

    el.composer.addEventListener("submit", (e) => {
      e.preventDefault();
      if (H.voice.isListening()) { H.voice.stopListening(); return; }
      const text = el.input.value.trim();
      if (!text || busy) return;
      H.voice.unlock();
      el.input.value = "";
      send(text);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") markSeen();
    });
  }

  init();
})(window.Horacio);
