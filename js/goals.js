/*
  Metas de longo prazo do dono.
  Guarda cada meta (alvo, quanto já tem, prazo) e calcula o plano:
  quanto falta, quanto por mês/semana/dia e, pelo ritmo até agora, quando chega lá.
  Fica salvo só no aparelho.
*/
(function (H) {
  const KEY = "horacio.goals.v1";
  const DAY = 86400000;

  let goals = load();

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(goals));
    } catch {}
  }

  const list = () => goals.slice();

  function find(name) {
    const n = normalize(name);
    return goals.find((g) => normalize(g.name) === n) || goals.find((g) => normalize(g.name).includes(n) || n.includes(normalize(g.name)));
  }

  function normalize(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  }

  /** Cria ou atualiza uma meta. deadline: "AAAA-MM-DD" ou vazio. */
  function upsert({ name, target, current = 0, unit = "", deadline = "" }) {
    const existing = find(name);
    const now = Date.now();
    if (existing) {
      Object.assign(existing, {
        target: Number(target) || existing.target,
        unit: unit || existing.unit,
        deadline: deadline || existing.deadline,
      });
      if (current !== undefined && current !== null && Number(current) !== existing.current) {
        existing.current = Number(current);
        existing.history.push({ t: now, value: existing.current });
      }
      save();
      return existing;
    }
    const g = {
      id: `${now}-${Math.random().toString(36).slice(2, 6)}`,
      name: String(name).trim(),
      target: Number(target),
      current: Number(current) || 0,
      unit: String(unit || "").trim(),
      deadline: deadline || "",
      created: now,
      history: [{ t: now, value: Number(current) || 0 }],
    };
    goals.push(g);
    save();
    return g;
  }

  /** Soma (ou define) o progresso. */
  function progress(name, amount, { set = false } = {}) {
    const g = find(name);
    if (!g) return null;
    g.current = set ? Number(amount) : g.current + Number(amount);
    g.history.push({ t: Date.now(), value: g.current });
    save();
    return g;
  }

  function remove(name) {
    const g = find(name);
    if (!g) return false;
    goals = goals.filter((x) => x !== g);
    save();
    return true;
  }

  /* ---------- Cálculo do plano ---------- */

  function fmt(n, unit) {
    const money = /^(r\$|reais|real)$/i.test(unit);
    const v = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n);
    if (money) return `${v} reais`;
    return unit ? `${v} ${unit}` : v;
  }

  function monthYear(t) {
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(t));
  }

  function plan(g, now = Date.now()) {
    const remaining = Math.max(0, g.target - g.current);
    const pct = g.target ? Math.min(100, (g.current / g.target) * 100) : 0;
    const out = { remaining, pct, done: remaining === 0 };

    if (g.deadline) {
      const end = new Date(`${g.deadline}T23:59:59`).getTime();
      const days = Math.max(0, (end - now) / DAY);
      out.daysLeft = Math.ceil(days);
      if (days > 0) {
        out.perDay = remaining / days;
        out.perWeek = remaining / (days / 7);
        out.perMonth = remaining / (days / 30.44);
      }
      out.overdue = days <= 0 && !out.done;
    }

    // Ritmo real: do primeiro registro até agora
    const first = g.history[0];
    const elapsed = (now - first.t) / DAY;
    const gained = g.current - first.value;
    if (elapsed >= 1 && gained > 0 && !out.done) {
      out.ratePerDay = gained / elapsed;
      out.projected = now + (remaining / out.ratePerDay) * DAY;
      if (g.deadline) out.onTrack = out.projected <= new Date(`${g.deadline}T23:59:59`).getTime();
    }
    return out;
  }

  /** Resumo falado de uma meta. */
  function describe(g) {
    const p = plan(g);
    const title = g.name.charAt(0).toUpperCase() + g.name.slice(1);
    const head = `${title}: ${fmt(g.current, g.unit)} de ${fmt(g.target, g.unit)}, ${Math.round(p.pct)}%.`;
    if (p.done) return `${head} Meta cumprida! Parabéns.`;
    const parts = [head];
    if (p.overdue) {
      parts.push(`O prazo já passou e ainda faltam ${fmt(p.remaining, g.unit)}.`);
    } else if (p.perMonth !== undefined) {
      const span = p.daysLeft > 60 ? `${Math.round(p.daysLeft / 30.44)} meses` : `${p.daysLeft} dias`;
      const rhythm = p.daysLeft > 60
        ? `cerca de ${fmt(p.perMonth, g.unit)} por mês, ou ${fmt(p.perWeek, g.unit)} por semana`
        : `cerca de ${fmt(p.perWeek, g.unit)} por semana, ou ${fmt(p.perDay, g.unit)} por dia`;
      parts.push(`Faltam ${fmt(p.remaining, g.unit)} em ${span}: ${rhythm}.`);
    } else {
      parts.push(`Faltam ${fmt(p.remaining, g.unit)}.`);
    }
    if (p.projected) {
      const when = monthYear(p.projected);
      if (p.onTrack === true) parts.push(`No ritmo atual, você chega lá em ${when}, dentro do prazo.`);
      else if (p.onTrack === false) parts.push(`No ritmo atual, só em ${when}: é preciso acelerar.`);
      else parts.push(`No ritmo atual, você chega lá em ${when}.`);
    }
    return parts.join(" ");
  }

  function summary() {
    if (!goals.length) return "Você ainda não tem metas. Diga, por exemplo, “quero juntar 10 mil reais até dezembro de 2027 para a viagem”, ou crie em Personalização → Metas.";
    return goals.map(describe).join("\n");
  }

  /* ---------- Intenções locais (sem IA) ---------- */

  const NUMBER = /(\d+(?:[.,]\d+)*)\s*(mil)?/;

  function parseAmount(text) {
    const m = text.match(NUMBER);
    if (!m) return null;
    let v = m[1];
    // "10.000" ou "10.000,50" → 10000 / 10000.5
    v = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : /\.\d{3}\b/.test(v) ? v.replace(/\./g, "") : v;
    return parseFloat(v) * (m[2] ? 1000 : 1);
  }

  const intents = [
    {
      // "como estão minhas metas", "minhas metas", "meta da viagem"
      match: /\b(minhas metas|como (estao|esta|vai|vao) (as |a )?(minhas? )?metas?|metas?\b.*\b(como|status|progresso|plano)|plano da meta)\b/,
      reply: ({ text }) => {
        const named = goals.find((g) => text.includes(normalize(g.name)));
        return named ? describe(named) : summary();
      },
    },
    {
      // "adicionei 500 na meta viagem", "guardei 200 reais para a viagem"
      match: /\b(adiciona\w*|coloquei|guardei|juntei|depositei|soma\w*|economizei|corri|li|perdi|ganhei)\b.*\d/,
      reply: ({ text }) => {
        const g = goals.find((x) => text.includes(normalize(x.name)));
        if (!g) return null;
        const amount = parseAmount(text);
        if (!amount) return null;
        progress(g.name, amount);
        return `Anotado. ${describe(g)}`;
      },
    },
  ];

  H.goals = { list, find, upsert, progress, remove, plan, describe, summary, fmt, intents };
})((window.Horacio = window.Horacio || {}));
