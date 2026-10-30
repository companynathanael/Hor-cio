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

  async function send(text) {
    if (busy) return;
    busy = true;
    const t = Date.now();
    addMessage("user", text, t);
    remember("user", text, t);

    el.orb.dataset.state = "thinking";
    const rhythm = H.settings.RHYTHM[settings.rhythm];
    const [reply] = await Promise.all([
      H.brain.respond(text, { settings, memory }),
      wait((450 + Math.random() * 350) * rhythm),
    ]);
    el.orb.dataset.state = "idle";

    const rt = Date.now();
    remember("horacio", reply, rt);
    await typeInto(addMessage("horacio", "", rt), reply);
    busy = false;
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

    el.composer.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = el.input.value.trim();
      if (!text || busy) return;
      el.input.value = "";
      send(text);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") markSeen();
    });
  }

  init();
})(window.Horacio);
