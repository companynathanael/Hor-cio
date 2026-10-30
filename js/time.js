/* Tudo que o Horácio sabe sobre o tempo. */
(function (H) {
  const LOCALE = "pt-BR";

  /** Período do dia: saudação e era correspondente. */
  function period(date = new Date()) {
    const h = date.getHours();
    if (h >= 5 && h < 12) return { greeting: "Bom dia", era: "aurora" };
    if (h >= 12 && h < 18) return { greeting: "Boa tarde", era: "tarde" };
    if (h >= 18) return { greeting: "Boa noite", era: "crepusculo" };
    return { greeting: "Boa noite", era: "meianoite" };
  }

  function formatClock(date, { hour24 = true, seconds = false } = {}) {
    return new Intl.DateTimeFormat(LOCALE, {
      hour: "2-digit",
      minute: "2-digit",
      second: seconds ? "2-digit" : undefined,
      hour12: !hour24,
    }).format(date);
  }

  function formatDate(date) {
    const text = new Intl.DateTimeFormat(LOCALE, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
  }

  /** Duração por extenso: "3 horas", "2 dias", "12 minutos". */
  function humanize(ms) {
    const min = Math.floor(ms / 60000);
    if (min < 60) return plural(Math.max(min, 1), "minuto", "minutos");
    const hours = Math.floor(min / 60);
    if (hours < 24) return plural(hours, "hora", "horas");
    const days = Math.floor(hours / 24);
    if (days < 30) return plural(days, "dia", "dias");
    const months = Math.floor(days / 30);
    if (months < 12) return plural(months, "mês", "meses");
    return plural(Math.floor(days / 365), "ano", "anos");
  }

  /** "2 horas e 13 minutos" */
  function hoursAndMinutes(ms) {
    const total = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (!h) return plural(m, "minuto", "minutos");
    if (!m) return plural(h, "hora", "horas");
    return `${plural(h, "hora", "horas")} e ${plural(m, "minuto", "minutos")}`;
  }

  function untilMidnight(date = new Date()) {
    const end = new Date(date);
    end.setHours(24, 0, 0, 0);
    return end - date;
  }

  function daysUntilNewYear(date = new Date()) {
    const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const next = new Date(date.getFullYear() + 1, 0, 1);
    return Math.round((next - today) / 86400000);
  }

  function yearProgress(date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 1);
    const end = new Date(date.getFullYear() + 1, 0, 1);
    return (date - start) / (end - start);
  }

  H.time = {
    period,
    formatClock,
    formatDate,
    humanize,
    hoursAndMinutes,
    untilMidnight,
    daysUntilNewYear,
    yearProgress,
  };
})((window.Horacio = window.Horacio || {}));
