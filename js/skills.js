/*
  Habilidades locais do Horácio — funcionam sem IA e sem chave.
  - Lembretes e timers ("me lembra em 10 minutos de...", "timer de 5 minutos")
  - Previsão do tempo (Open-Meteo, gratuito)
  - Contas ("quanto é 15% de 230")
  - Dias até uma data ("quantos dias faltam para o Natal")
  - Cara ou coroa e dados
*/
(function (H) {
  const T = H.time;
  const REMINDERS_KEY = "horacio.reminders.v1";

  /* ---------- Números por extenso ---------- */

  const WORDS = {
    um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
    dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16,
    dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, quarenta_e_cinco: 45,
    cinquenta: 50, sessenta: 60, noventa: 90, cem: 100, meia: 0.5,
  };

  /** Converte "vinte e cinco" → "25" dentro do texto (já normalizado). */
  function wordsToDigits(text) {
    return text
      .replace(/\b(vinte|trinta|quarenta|cinquenta) e (um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove)\b/g,
        (_, t, u) => String(WORDS[t] + WORDS[u]))
      .replace(/\b(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|noventa|cem)\b(?=\s+(segundos?|minutos?|horas?|dias?|vezes|mais|menos|dividido|elevado|por))/g,
        (w) => String(WORDS[w]));
  }

  /* ---------- Lembretes e timers ---------- */

  let reminders = load();
  const timers = new Map();
  let onFire = () => {};

  function load() {
    try {
      return JSON.parse(localStorage.getItem(REMINDERS_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
    } catch {}
  }

  function arm(r) {
    clearTimeout(timers.get(r.id));
    const ms = r.at - Date.now();
    // setTimeout aceita no máximo ~24 dias
    if (ms > 2 ** 31 - 1) return;
    timers.set(r.id, setTimeout(() => fire(r.id), Math.max(0, ms)));
  }

  function fire(id) {
    const r = reminders.find((x) => x.id === id);
    if (!r) return;
    reminders = reminders.filter((x) => x.id !== id);
    timers.delete(id);
    save();
    onFire(r, Date.now() - r.at > 60000);
  }

  function addReminder(at, text, kind) {
    const r = { id: `${at}-${Math.random().toString(36).slice(2, 7)}`, at, text, kind };
    reminders.push(r);
    reminders.sort((a, b) => a.at - b.at);
    save();
    arm(r);
    return r;
  }

  /** Começa a vigiar os lembretes salvos (inclusive os que venceram com o app fechado). */
  function startReminders(callback) {
    onFire = callback;
    reminders.forEach(arm);
  }

  const UNIT_MS = { segundo: 1000, minuto: 60000, hora: 3600000, dia: 86400000 };

  function parseDuration(text) {
    const t = text.replace(/\bmeia hora\b/, "30 minutos").replace(/\buma hora e meia\b/, "90 minutos");
    let total = 0;
    for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(segundo|minuto|hora|dia)s?\b/g)) {
      total += parseFloat(m[1].replace(",", ".")) * UNIT_MS[m[2]];
    }
    return total;
  }

  /** "as 18h", "às 7 e meia", "as 18:30", "meio dia" → Date futura */
  function parseClock(text) {
    let m = text.match(/\b(?:as|a|para as|pras)\s+(\d{1,2})(?:(?:h|:| horas?)(\d{2})?)?(?:\s*(?:e meia))?/);
    let h, min = 0;
    if (/\bmeio dia\b/.test(text)) { h = 12; }
    else if (/\bmeia noite\b/.test(text)) { h = 0; }
    else if (m) {
      h = Number(m[1]);
      min = m[2] ? Number(m[2]) : /e meia/.test(m[0]) ? 30 : 0;
      if (/\b(da tarde|da noite)\b/.test(text) && h < 12) h += 12;
    } else return null;
    if (h > 23 || min > 59) return null;
    const d = new Date();
    d.setHours(h, min, 0, 0);
    if (/\bamanha\b/.test(text) || d <= new Date()) d.setDate(d.getDate() + 1);
    return d;
  }

  /** Extrai o "do quê" do lembrete: "...de tirar o bolo" → "tirar o bolo" (do texto original). */
  function reminderText(original) {
    const m = original.match(/\b(?:de|pra|para|que)\s+(?!\d)(.+)$/i);
    if (!m) return "";
    return m[1]
      .replace(/(?:^|\s)(?:em|daqui|dentro de|às|as|amanhã|amanha|hoje)(?:\s.*)?$/i, "")
      .replace(/[.!?]+$/, "")
      .trim();
  }

  function durationText(ms) {
    if (ms < 60000) return `${Math.round(ms / 1000)} segundos`;
    return T.hoursAndMinutes(ms);
  }

  function whenText(at) {
    const d = new Date(at);
    const today = new Date();
    const clock = T.formatClock(d, { hour24: true });
    if (d.toDateString() === today.toDateString()) return `às ${clock}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return `amanhã às ${clock}`;
    return `em ${T.formatDate(d).toLowerCase()}, às ${clock}`;
  }

  function reminderReply(text, original) {
    if (/\b(cancel\w*|apag\w*|limp\w*|remov\w*)\b/.test(text)) {
      const n = reminders.length;
      reminders.forEach((r) => clearTimeout(timers.get(r.id)));
      reminders = [];
      timers.clear();
      save();
      return n ? `Pronto, cancelei ${n === 1 ? "o lembrete" : `os ${n} lembretes`}.` : "Não há lembretes para cancelar.";
    }
    if (/\b(quais|meus|lista\w*|tenho)\b/.test(text) && !/\b(em|daqui|as)\s+\d/.test(text)) {
      if (!reminders.length) return "Você não tem lembretes pendentes.";
      const items = reminders.slice(0, 5).map((r) => `${r.text || (r.kind === "timer" ? "timer" : "lembrete")} ${whenText(r.at)}`);
      return `Você tem ${reminders.length === 1 ? "um lembrete" : `${reminders.length} lembretes`}: ${items.join("; ")}.`;
    }

    const isTimer = /\b(timer|temporizador|cronometro|alarme de)\b/.test(text);
    const ms = parseDuration(text);
    const at = ms > 0 ? Date.now() + ms : parseClock(text)?.getTime();
    if (!at) return "Quando devo avisar? Diga, por exemplo, “me lembra em 10 minutos” ou “me lembra às 18h”.";

    const what = isTimer ? "" : reminderText(original);
    addReminder(at, what, isTimer ? "timer" : "lembrete");
    const span = ms > 0 ? `em ${durationText(ms)}` : whenText(at);
    if (isTimer) return `Timer iniciado. Aviso você ${span}.`;
    return what ? `Combinado. ${capitalize(span)} eu lembro você de ${what}.` : `Combinado. Aviso você ${span}.`;
  }

  /* ---------- Previsão do tempo (Open-Meteo) ---------- */

  const WMO = {
    0: "céu limpo", 1: "predominantemente limpo", 2: "parcialmente nublado", 3: "nublado",
    45: "neblina", 48: "neblina com geada", 51: "garoa fraca", 53: "garoa", 55: "garoa forte",
    56: "garoa congelante", 57: "garoa congelante", 61: "chuva fraca", 63: "chuva", 65: "chuva forte",
    66: "chuva congelante", 67: "chuva congelante", 71: "neve fraca", 73: "neve", 75: "neve forte",
    77: "granizo fino", 80: "pancadas de chuva", 81: "pancadas de chuva", 82: "pancadas fortes de chuva",
    85: "pancadas de neve", 86: "pancadas de neve", 95: "trovoadas", 96: "trovoadas com granizo", 99: "trovoadas com granizo",
  };

  async function weatherReply(text, settings) {
    let pos;
    try {
      pos = await H.places.here();
    } catch {
      pos = settings.places?.casa;
      if (!pos) return "Preciso da sua localização para ver o tempo. Libere o acesso à localização ou defina sua casa em Personalização → Lugares.";
    }
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}` +
      "&current=temperature_2m,apparent_temperature,weather_code" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
      "&timezone=auto&forecast_days=2";
    let data;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      data = await res.json();
    } catch {
      return "Não consegui consultar a previsão do tempo agora. Tente de novo em instantes.";
    }
    const d = data.daily;
    const deg = (v) => `${Math.round(v)} graus`;
    if (/\bamanha\b/.test(text)) {
      return `Amanhã: ${WMO[d.weather_code[1]] || "tempo variável"}, mínima de ${deg(d.temperature_2m_min[1])} e máxima de ${deg(d.temperature_2m_max[1])}, ` +
        `com ${d.precipitation_probability_max[1] ?? 0}% de chance de chuva.`;
    }
    const c = data.current;
    const rain = d.precipitation_probability_max[0] ?? 0;
    const feels = Math.abs(c.apparent_temperature - c.temperature_2m) >= 2 ? `, com sensação de ${deg(c.apparent_temperature)}` : "";
    const advice = rain >= 60 ? " Leve um guarda-chuva." : "";
    return `Agora faz ${deg(c.temperature_2m)}${feels}, ${WMO[c.weather_code] || "tempo variável"}. ` +
      `Hoje a máxima é de ${deg(d.temperature_2m_max[0])} e a mínima de ${deg(d.temperature_2m_min[0])}, ` +
      `com ${rain}% de chance de chuva.${advice}`;
  }

  /* ---------- Contas ---------- */

  /** Avalia + - * / ^ e parênteses, sem eval. */
  function evaluate(expr) {
    const tokens = expr.match(/\d+(?:\.\d+)?|[-+*/^()]/g);
    if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) return null;
    let i = 0;
    const peek = () => tokens[i];
    const next = () => tokens[i++];
    function primary() {
      const t = next();
      if (t === "(") { const v = sum(); if (next() !== ")") throw 0; return v; }
      if (t === "-") return -primary();
      if (t === "+") return primary();
      const v = Number(t);
      if (Number.isNaN(v)) throw 0;
      return v;
    }
    function power() { const b = primary(); return peek() === "^" ? (next(), b ** power()) : b; }
    function product() {
      let v = power();
      while (peek() === "*" || peek() === "/") v = next() === "*" ? v * power() : v / power();
      return v;
    }
    function sum() {
      let v = product();
      while (peek() === "+" || peek() === "-") v = next() === "+" ? v + product() : v - product();
      return v;
    }
    try {
      const v = sum();
      return i === tokens.length && Number.isFinite(v) ? v : null;
    } catch {
      return null;
    }
  }

  function formatNumber(n) {
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(n);
  }

  function mathReply(input) {
    // Usa o texto original: a normalização do cérebro apaga "%", vírgulas e sinais.
    const plain = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let t = wordsToDigits(plain)
      .replace(/^.*?\b(quanto e|quanto da|calcule|calcula|qual e|qual o resultado de)\b/, "")
      .replace(/(\d+(?:[.,]\d+)?)\s*(?:por cento|%)\s*de\s*(\d+(?:[.,]\d+)?)/g, "($1/100*$2)")
      .replace(/raiz (?:quadrada )?de\s*(\d+(?:[.,]\d+)?)/g, "($1^0.5)")
      .replace(/(\d),(\d)/g, "$1.$2")
      .replace(/\b(vezes|x|multiplicado por)\b/g, "*")
      .replace(/\b(dividido por|divido por|sobre)\b/g, "/")
      .replace(/\bmais\b/g, "+")
      .replace(/\bmenos\b/g, "-")
      .replace(/\b(elevado a|elevado ao|na potencia)\b/g, "^")
      .replace(/\bao quadrado\b/g, "^2")
      .replace(/\bao cubo\b/g, "^3")
      .replace(/(\d)\s*x\s*(\d)/g, "$1*$2")
      .replace(/[?=!]/g, "")
      .trim();
    const v = evaluate(t);
    return v === null ? null : `Dá ${formatNumber(v)}.`;
  }

  /* ---------- Dias até uma data ---------- */

  const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const HOLIDAYS = {
    natal: [12, 25, "o Natal"],
    "ano novo": [1, 1, "o Ano Novo"],
    reveillon: [1, 1, "o Ano Novo"],
    "dia das criancas": [10, 12, "o Dia das Crianças"],
    "dia dos namorados": [6, 12, "o Dia dos Namorados"],
    tiradentes: [4, 21, "Tiradentes"],
    independencia: [9, 7, "o Dia da Independência"],
    "sete de setembro": [9, 7, "o Sete de Setembro"],
    finados: [11, 2, "Finados"],
    halloween: [10, 31, "o Halloween"],
  };

  function daysUntilReply(text) {
    let month, day, label;
    const holiday = Object.keys(HOLIDAYS).find((h) => text.includes(h));
    if (holiday) {
      [month, day, label] = HOLIDAYS[holiday];
    } else {
      const m = text.match(/\b(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/) ||
        text.match(/\b(\d{1,2})\/(\d{1,2})\b/);
      if (!m) return null;
      day = Number(m[1]);
      month = isNaN(m[2]) ? MONTHS.indexOf(m[2]) + 1 : Number(m[2]);
      if (!month || day < 1 || day > 31) return null;
      label = `${day} de ${["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][month - 1]}`;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let target = new Date(today.getFullYear(), month - 1, day);
    if (target < today) target = new Date(today.getFullYear() + 1, month - 1, day);
    const days = Math.round((target - today) / 86400000);
    if (days === 0) return `É hoje! Hoje é ${label}.`;
    if (days === 1) return `Falta só um dia para ${label}: é amanhã.`;
    const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(target);
    return `Faltam ${days} dias para ${label}, que cai numa ${weekday}.`;
  }

  /* ---------- Sorte ---------- */

  function luckReply(text) {
    if (/\b(moeda|cara ou coroa)\b/.test(text)) {
      return `Deu ${Math.random() < 0.5 ? "cara" : "coroa"}.`;
    }
    const sides = Number((text.match(/\bd(\d+)\b|\bdado de (\d+)/) || []).slice(1).find(Boolean)) || 6;
    return `Rolei o dado de ${sides} lados: deu ${1 + Math.floor(Math.random() * sides)}.`;
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* ---------- Intenções ---------- */

  // Avaliadas pelo cérebro antes das demais. Cada reply pode devolver null para "não era isso".
  const intents = [
    {
      match: /\b(me lembr\w*|lembr\w* me|me avis\w*|me acord\w*|lembrete\w*|timer|temporizador|cronometro|alarme)\b/,
      reply: ({ text, input }) => reminderReply(wordsToDigits(text), input),
    },
    {
      match: /\b(clima|previsao|vai chover|chovendo|chuva|temperatura|guarda chuva|esta quente|esta frio|faz frio|faz calor|quantos graus)\b|\b(como (esta|ta|vai estar) o tempo|tempo (hoje|amanha|la fora))\b/,
      reply: ({ text, settings }) => weatherReply(text, settings),
    },
    {
      match: /\b(quantos dias|quanto falta|falta quanto|faltam quantos)\b.*\b(para|pro|pra|ate)\b/,
      reply: ({ text }) => daysUntilReply(text),
    },
    {
      match: /\b(quanto e|quanto da|calcule|calcula|qual o resultado de|raiz)\b.*\d|\d\s*(vezes|mais|menos|dividido|elevado|x|por cento|%)/,
      reply: ({ input }) => mathReply(input),
    },
    {
      match: /\b(cara ou coroa|joga\w* (uma )?moeda|rola\w* (um )?dado|joga\w* (um )?dado|d6|d20)\b/,
      reply: ({ text }) => luckReply(text),
    },
  ];

  H.skills = { intents, startReminders, evaluate, parseDuration, parseClock, wordsToDigits };
})((window.Horacio = window.Horacio || {}));
