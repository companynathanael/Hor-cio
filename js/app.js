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

  // Cor da logo no ícone da aba, por era
  const LOGO_COLOR = {
    aurora: "#A87B2F",
    tarde: "#9A6E25",
    crepusculo: "#D4A64F",
    meianoite: "#C9A04A",
  };

  function faviconFor(era) {
    const logo = document.querySelector("#logo g").innerHTML;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
      `<rect width="512" height="512" rx="112" fill="${THEME_COLOR[era]}"/>` +
      `<g transform="translate(256 256) scale(0.7)" fill="${LOGO_COLOR[era]}" fill-rule="evenodd">${logo}</g></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

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
    voiceTip: $("#voice-tip"),
    sheet: $("#settings"),
    form: $("#settings-form"),
    themeMeta: document.querySelector('meta[name="theme-color"]'),
    favicon: $("#favicon"),
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
    el.favicon.href = faviconFor(era);
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
      H.brain.respond(text, { settings, memory, setName: (name) => update({ name }) }),
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
        H.voice.speak(reply, speakOptions({
          onStart: () => setState("speaking"),
          onError: (code) => elevenFailed(code),
        })),
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

  const ELEVEN_ERRORS = {
    key: "A chave do ElevenLabs foi recusada. Confira em Personalização → Voz.",
    voice: "Não encontrei essa voz no ElevenLabs. Confira o Voice ID em Personalização → Voz.",
    model: "Esse modelo do ElevenLabs não está disponível na sua conta. Confira o campo Modelo.",
    quota: "Os créditos do ElevenLabs acabaram ou o limite da conta foi atingido.",
    busy: "O ElevenLabs está recebendo pedidos demais agora.",
    network: "Não consegui falar com o ElevenLabs. Verifique sua conexão.",
    blocked: "O navegador bloqueou o áudio. Toque na tela e tente de novo.",
    service: "O ElevenLabs não respondeu como esperado.",
  };

  function speakOptions(extra = {}) {
    const eleven = settings.engine === "elevenlabs"
      ? { key: settings.elKey, voiceId: settings.elVoiceId, model: settings.elModel }
      : null;
    return { voiceName: settings.voiceName, rhythm: settings.rhythm, tone: settings.tone, eleven, ...extra };
  }

  // Avisa cada tipo de falha uma vez por sessão, para não poluir a conversa.
  const elevenWarned = new Set();
  function elevenFailed(code) {
    if (elevenWarned.has(code)) return;
    elevenWarned.add(code);
    notify(`${ELEVEN_ERRORS[code] || ELEVEN_ERRORS.service} Por enquanto, uso a voz do aparelho.`);
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

  /* Modo vigília: o Horácio atende quando ouve o próprio nome. */

  function wakeHandlers() {
    return {
      onCommand: (text) => { if (!busy) send(text, { viaVoice: true }); },
      onWake: () => startListening(),
      onStop: (code) => {
        el.mic.classList.remove("is-standby");
        if (code === "not-allowed" || code === "service-not-allowed") update({ wake: false });
        notify(VOICE_ERRORS[code] || "Parei de ouvir meu nome. Toque na tela para eu voltar a ouvir.");
        if (settings.wake) armWake();
      },
    };
  }

  function startWake() {
    if (!settings.wake || H.voice.isWakeOn()) return;
    if (H.voice.startWake(wakeHandlers())) el.mic.classList.add("is-standby");
  }

  function stopWake() {
    H.voice.stopWake();
    el.mic.classList.remove("is-standby");
  }

  /** O navegador só libera o microfone depois de um toque: espera o primeiro. */
  function armWake() {
    const go = () => {
      document.removeEventListener("pointerdown", go, true);
      startWake();
    };
    document.addEventListener("pointerdown", go, true);
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

    if (canListen && settings.wake) armWake();

    // Com o site em segundo plano o navegador desliga o microfone.
    document.addEventListener("visibilitychange", () => {
      if (!settings.wake) return;
      if (document.visibilityState === "hidden") stopWake();
      else armWake();
    });
  }

  function voiceTip() {
    const v = H.voice.pickVoice(settings.voiceName);
    if (!v) return "Nenhuma voz em português foi encontrada neste aparelho.";
    if (H.voice.isMale(v) && H.voice.isNatural(v)) return "";
    const ua = navigator.userAgent;
    if (/iPhone|iPad|Macintosh/.test(ua)) {
      return "Voz mais humana: Ajustes → Acessibilidade → Conteúdo Falado → Vozes → Português (Brasil) → baixe “Felipe (Melhorada)” e escolha-a aqui.";
    }
    if (/Android/.test(ua)) {
      return "Voz masculina: Configurações do Android → Saída de conversão de texto em voz → Mecanismo do Google → Português (Brasil) → escolha uma voz masculina.";
    }
    return "Voz mais humana: no Microsoft Edge, escolha “Antonio Online (Natural)”.";
  }

  function fillVoiceSelect() {
    const list = H.voice.voices();
    const options = [new Option("Automática", "")].concat(
      list.map((v) => new Option(`${v.name} (${v.lang})`, v.name))
    );
    el.voiceSelect.replaceChildren(...options);
    el.voiceSelect.value = list.some((v) => v.name === settings.voiceName) ? settings.voiceName : "";
    el.voiceTip.textContent = voiceTip();
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
    f.querySelector(`input[name="tone"][value="${settings.tone}"]`).checked = true;
    f.querySelector("#opt-wake").checked = settings.wake;
    f.querySelector(`input[name="engine"][value="${settings.engine}"]`).checked = true;
    f.querySelector("#opt-el-voice").value = settings.elVoiceId;
    f.querySelector("#opt-el-key").value = settings.elKey;
    f.querySelector("#opt-el-model").value = settings.elModel;
    el.voiceField.dataset.engine = settings.engine;
    $("#voice-status").textContent = "";
    f.querySelector(`input[name="travel"][value="${settings.travel}"]`).checked = true;
    $("#places-status").textContent = "";
    renderPlaces();
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
      else if (t.id === "opt-voice") { update({ voiceName: t.value }); el.voiceTip.textContent = voiceTip(); }
      else if (t.name === "tone") update({ tone: t.value });
      else if (t.id === "opt-wake") {
        update({ wake: t.checked });
        if (t.checked) startWake();
        else stopWake();
      }
      else if (t.id === "opt-continuous") update({ continuous: t.checked });
      else if (t.name === "engine") {
        update({ engine: t.value });
        el.voiceField.dataset.engine = t.value;
      }
      else if (t.name === "travel") update({ travel: t.value });
      else if (t.id === "opt-el-voice") update({ elVoiceId: t.value.trim() });
      else if (t.id === "opt-el-key") update({ elKey: t.value.trim() });
      else if (t.id === "opt-el-model") update({ elModel: t.value.trim() || H.settings.defaults.elModel });
      if (t.id?.startsWith("opt-el-") || t.name === "engine") elevenWarned.clear();
    });

    $("#btn-test-voice").addEventListener("click", () => {
      H.voice.unlock();
      const status = $("#voice-status");
      const usingEleven = settings.engine === "elevenlabs";
      if (usingEleven && (!settings.elVoiceId || !settings.elKey)) {
        status.textContent = "Preencha o Voice ID e a chave de API para usar a voz do ElevenLabs.";
        return;
      }
      let failed = false;
      status.textContent = usingEleven ? "Gerando a voz no ElevenLabs…" : "";
      const { greeting } = T.period(new Date());
      const name = settings.name ? `, ${settings.name}` : "";
      H.voice.speak(`${greeting}${name}. Eu sou o Horácio, ao seu dispor.`, speakOptions({
        onStart: () => {
          if (usingEleven && !failed) status.textContent = "✓ Voz do ElevenLabs funcionando.";
        },
        onError: (code) => {
          failed = true;
          status.textContent = `${ELEVEN_ERRORS[code] || ELEVEN_ERRORS.service} Tocando a voz do aparelho no lugar.`;
        },
      }));
    });

    bindPlaces();

    $("#btn-forget").addEventListener("click", () => {
      forget();
      el.sheet.close();
    });
  }

  /* ---------- Lugares ---------- */

  const PLACE_ERRORS = {
    denied: "Sem permissão para ver sua localização. Libere o acesso nas configurações do navegador.",
    unsupported: "Este aparelho não oferece localização.",
    timeout: "A localização demorou demais. Tente de novo com o GPS ligado.",
    unavailable: "Não consegui descobrir sua localização agora.",
    notfound: "Não encontrei esse endereço. Tente incluir número, bairro e cidade.",
    network: "Sem conexão para buscar o endereço.",
    service: "O serviço de mapas não respondeu. Tente de novo em instantes.",
  };

  function renderPlaces() {
    document.querySelectorAll(".place").forEach((box) => {
      const p = settings.places[box.dataset.place];
      box.classList.toggle("is-set", Boolean(p));
      box.querySelector('[data-role="label"]').textContent = p ? p.label || "Localização salva" : "Não definido";
      box.querySelector('[data-role="address"]').value = "";
    });
  }

  function savePlace(key, place) {
    update({ places: { ...settings.places, [key]: place } });
    renderPlaces();
  }

  async function placeAction(box, action) {
    const key = box.dataset.place;
    const status = $("#places-status");
    const [name, saved, removed] = key === "casa" ? ["Casa", "salva", "removida"] : ["Trabalho", "salvo", "removido"];
    try {
      if (action === "clear") {
        savePlace(key, null);
        status.textContent = `${name} ${removed}.`;
      } else if (action === "here") {
        status.textContent = "Pegando sua localização…";
        const pos = await H.places.here();
        const label = await H.places.reverse(pos);
        savePlace(key, { lat: pos.lat, lon: pos.lon, label });
        status.textContent = `✓ ${name} ${saved} na sua localização atual.`;
      } else if (action === "search") {
        const address = box.querySelector('[data-role="address"]').value.trim();
        if (!address) {
          status.textContent = "Digite o endereço primeiro.";
          return;
        }
        status.textContent = "Buscando o endereço…";
        savePlace(key, await H.places.geocode(address));
        status.textContent = `✓ ${name} ${saved}.`;
      }
    } catch (e) {
      status.textContent = PLACE_ERRORS[e.code] || PLACE_ERRORS.service;
    }
  }

  function bindPlaces() {
    document.querySelectorAll(".place").forEach((box) => {
      box.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (btn) placeAction(box, btn.dataset.action);
      });
      // Enter no endereço busca, em vez de fechar o painel
      box.querySelector('[data-role="address"]').addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          placeAction(box, "search");
        }
      });
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
