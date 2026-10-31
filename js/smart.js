/*
  Inteligência leve do Horácio — tudo no aparelho, sem chave e sem IA pesada.
  - Conversão de unidades (comprimento, área, volume, massa, tempo, velocidade, temperatura, dados)
  - Tempos, distâncias e velocidades aproximados
  - Finanças: juros compostos, aportes, parcelas, descontos, porcentagens, orçamento, câmbio
  - Geopolítica: dados oficiais dos países (REST Countries)
  - Inteligência emocional: acolhimento e dicas simples
*/
(function (H) {
  const T = H.time;

  /* ---------- Utilidades ---------- */

  /** Minúsculas, sem acentos, mantendo números, vírgulas, %, / e ²/³. */
  function plain(input) {
    return input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/²/g, "2")
      .replace(/³/g, "3")
      .replace(/[?!]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** "1.500,75" → 1500.75 · "3,5" → 3.5 · "10 mil" → 10000 · "um" → 1 */
  function toNumber(raw, mil) {
    let v = String(raw);
    if (/^(um|uma)$/.test(v)) v = "1";
    else if (/^(meio|meia)$/.test(v)) v = "0.5";
    else if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, "");
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n * (mil ? 1000 : 1);
  }

  const NUM = String.raw`(\d+(?:[.,]\d+)*|um|uma|meio|meia)(\s*mil\b)?`;

  function fmt(n, maxDigits) {
    const abs = Math.abs(n);
    const digits = maxDigits ?? (abs >= 100 ? 0 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 8);
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(n);
  }

  const money = (n) => `${fmt(n, 2)} reais`;

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* ---------- Conversão de unidades ---------- */

  // [dimensão, fator para a unidade base, singular, plural, padrão de reconhecimento]
  // Base: m, m², L, kg, s, m/s, byte. Ordem importa: compostos antes dos simples.
  const UNITS = [
    ["speed", 1 / 3.6, "quilômetro por hora", "quilômetros por hora", /km\s*\/\s*h|kmh|quilometros? por hora/],
    ["speed", 1, "metro por segundo", "metros por segundo", /m\s*\/\s*s|metros? por segundo/],
    ["speed", 0.44704, "milha por hora", "milhas por hora", /mph|milhas? por hora/],
    ["speed", 0.514444, "nó", "nós", /\bnos\b|\bknots?\b/],
    ["area", 1e6, "quilômetro quadrado", "quilômetros quadrados", /km\s*2|quilometros? quadrados?/],
    ["area", 1, "metro quadrado", "metros quadrados", /\bm\s*2\b|metros? quadrados?/],
    ["area", 1e-4, "centímetro quadrado", "centímetros quadrados", /cm\s*2|centimetros? quadrados?/],
    ["area", 1e-6, "milímetro quadrado", "milímetros quadrados", /mm\s*2|milimetros? quadrados?/],
    ["area", 1e4, "hectare", "hectares", /hectares?|\bha\b/],
    ["area", 24200, "alqueire paulista", "alqueires paulistas", /alqueires?(?: paulistas?)?/],
    ["area", 4046.86, "acre", "acres", /\bacres?\b/],
    ["volume", 1000, "metro cúbico", "metros cúbicos", /\bm\s*3\b|metros? cubicos?/],
    ["volume", 0.001, "centímetro cúbico", "centímetros cúbicos", /cm\s*3|centimetros? cubicos?/],
    ["volume", 0.001, "mililitro", "mililitros", /mililitros?|\bml\b/],
    ["volume", 1, "litro", "litros", /litros?|\bl\b/],
    ["volume", 3.78541, "galão americano", "galões americanos", /gal(?:ao|oes)/],
    ["length", 1852, "milha náutica", "milhas náuticas", /milhas? nauticas?/],
    ["length", 1609.344, "milha", "milhas", /milhas?/],
    ["length", 1000, "quilômetro", "quilômetros", /\bkm\b|quilometros?|kilometros?/],
    ["length", 0.01, "centímetro", "centímetros", /\bcm\b|centimetros?/],
    ["length", 0.001, "milímetro", "milímetros", /\bmm\b|milimetros?/],
    ["length", 0.1, "decímetro", "decímetros", /\bdm\b|decimetros?/],
    ["length", 0.3048, "pé", "pés", /\bpes\b|\bpe\b|\bft\b/],
    ["length", 0.0254, "polegada", "polegadas", /polegadas?/],
    ["length", 0.9144, "jarda", "jardas", /jardas?/],
    ["length", 1, "metro", "metros", /\bm\b|metros?/],
    ["mass", 1000, "tonelada", "toneladas", /toneladas?/],
    ["mass", 1e-6, "miligrama", "miligramas", /miligramas?|\bmg\b/],
    ["mass", 1, "quilo", "quilos", /quilos?|quilogramas?|\bkg\b/],
    ["mass", 0.001, "grama", "gramas", /gramas?|\bg\b/],
    ["mass", 0.453592, "libra", "libras", /libras?|\blbs?\b/],
    ["mass", 0.0283495, "onça", "onças", /oncas?|\boz\b/],
    ["mass", 15, "arroba", "arrobas", /arrobas?/],
    ["time", 31557600, "ano", "anos", /\banos?\b/],
    ["time", 2629800, "mês", "meses", /\bmeses\b|\bmes\b/],
    ["time", 604800, "semana", "semanas", /semanas?/],
    ["time", 86400, "dia", "dias", /\bdias?\b/],
    ["time", 3600, "hora", "horas", /\bhoras?\b|\bh\b/],
    ["time", 60, "minuto", "minutos", /minutos?|\bmin\b/],
    ["time", 1, "segundo", "segundos", /segundos?|\bseg\b/],
    ["data", 1024 ** 4, "terabyte", "terabytes", /terabytes?|\btb\b/],
    ["data", 1024 ** 3, "gigabyte", "gigabytes", /gigabytes?|gigas?|\bgb\b/],
    ["data", 1024 ** 2, "megabyte", "megabytes", /megabytes?|megas?|\bmb\b/],
    ["data", 1024, "kilobyte", "kilobytes", /kilobytes?|\bkb\b/],
    ["temp", null, "grau Celsius", "graus Celsius", /celsius|graus? c\b|°c/],
    ["temp", null, "grau Fahrenheit", "graus Fahrenheit", /fahrenheit|graus? f\b|°f/],
    ["temp", null, "kelvin", "kelvins", /kelvins?/],
  ].map(([dim, factor, one, many, re]) => ({ dim, factor, one, many, re: new RegExp(re.source, "g") }));

  /** Todas as unidades citadas, na ordem em que aparecem (sem sobreposição). */
  function findUnits(t) {
    const found = [];
    for (const u of UNITS) {
      u.re.lastIndex = 0;
      for (const m of t.matchAll(u.re)) {
        const start = m.index;
        const end = start + m[0].length;
        if (found.some((f) => start < f.end && end > f.start)) continue;
        found.push({ unit: u, start, end });
      }
    }
    return found.sort((a, b) => a.start - b.start);
  }

  function toCelsius(v, unit) {
    if (unit.one.includes("Fahrenheit")) return (v - 32) * (5 / 9);
    if (unit.one === "kelvin") return v - 273.15;
    return v;
  }

  function fromCelsius(c, unit) {
    if (unit.one.includes("Fahrenheit")) return c * (9 / 5) + 32;
    if (unit.one === "kelvin") return c + 273.15;
    return c;
  }

  function convertReply(input) {
    const t = plain(input);
    const units = findUnits(t);
    if (units.length < 2) return null;

    let from, to;
    const ask = t.match(/\bquant[oa]s\b/);
    if (ask) {
      // "quantos metros tem 3 km" → destino é a unidade logo após "quantos"
      to = units.find((u) => u.start > ask.index) || units[0];
      from = units.find((u) => u !== to);
    } else {
      [from, to] = units;
    }
    if (!from || !to || from.unit.dim !== to.unit.dim || from.unit === to.unit) {
      if (from && to && from.unit.dim !== to.unit.dim) {
        return `Não dá para converter ${from.unit.many} em ${to.unit.many}: medem coisas diferentes.`;
      }
      return null;
    }

    // Número mais próximo antes da unidade de origem (ou "um metro" → 1)
    const before = t.slice(0, from.start);
    const nums = [...before.matchAll(new RegExp(NUM, "g"))];
    const last = nums[nums.length - 1];
    const value = last ? toNumber(last[1], last[2]) : 1;
    if (value === null) return null;

    let result;
    if (from.unit.dim === "temp") {
      result = fromCelsius(toCelsius(value, from.unit), to.unit);
    } else {
      result = (value * from.unit.factor) / to.unit.factor;
    }
    const name = (u, v) => (Math.abs(v) === 1 ? u.one : u.many);
    return `${fmt(value)} ${name(from.unit, value)} ${value === 1 ? "é" : "são"} ${fmt(result)} ${name(to.unit, result)}.`;
  }

  /* ---------- Tempo, distância e velocidade ---------- */

  const MODE_SPEED = [
    [/a pe|andando|caminhando/, 5, "a pé"],
    [/correndo/, 10, "correndo"],
    [/de bicicleta|pedalando|de bike/, 15, "de bicicleta"],
    [/de moto/, 60, "de moto"],
    [/de onibus/, 40, "de ônibus"],
    [/de aviao|voando/, 800, "de avião"],
    [/de carro|dirigindo|na estrada/, 80, "de carro"],
  ];

  function lengthKm(t) {
    const m = t.match(new RegExp(`${NUM}\\s*(km|quilometros?|metros?|m|milhas?)\\b(?!\\s*\\/)(?! por)`));
    if (!m) return null;
    const v = toNumber(m[1], m[2]);
    const u = m[3];
    if (/^mi/.test(u)) return v * 1.609344;
    if (/^(m|metros?)$/.test(u)) return v / 1000;
    return v;
  }

  function speedKmh(t) {
    const m = t.match(new RegExp(`${NUM}\\s*(km\\s*\\/\\s*h|kmh|quilometros? por hora|por hora|m\\s*\\/\\s*s|metros? por segundo)`));
    if (!m) return null;
    const v = toNumber(m[1], m[2]);
    return /m\s*\/\s*s|por segundo/.test(m[3]) ? v * 3.6 : v;
  }

  function durationH(t) {
    let h = 0;
    for (const m of t.matchAll(new RegExp(`${NUM}\\s*(horas?|h|minutos?|min)\\b`, "g"))) {
      const v = toNumber(m[1], m[2]);
      h += /^h/.test(m[3]) ? v : v / 60;
    }
    if (/\bmeia hora\b/.test(t)) h += 0.5;
    return h || null;
  }

  function spanText(hours) {
    const ms = hours * 3600000;
    if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} segundos`;
    if (hours >= 48) return `${fmt(hours / 24, 1)} dias (${T.hoursAndMinutes(ms)})`;
    return T.hoursAndMinutes(ms);
  }

  function travelReply(input) {
    const t = plain(input);
    const dist = lengthKm(t);
    const speed = speedKmh(t);
    const dur = durationH(t.replace(/km\s*\/\s*h|por hora/g, " "));

    // Velocidade necessária: "qual a velocidade para fazer 300 km em 4 horas"
    if (/velocidade|que velocidade|quantos km\/h/.test(t) && dist && dur) {
      return `Você precisa manter uma média de cerca de ${fmt(dist / dur, 1)} quilômetros por hora.`;
    }
    // Distância: "quantos km faço em 2 horas a 80 km/h"
    if (/quant[oa]s? (km|quilometros|metros)|que distancia|qual distancia|ate onde/.test(t) && speed && dur) {
      return `Em ${spanText(dur)} a ${fmt(speed)} quilômetros por hora, você percorre cerca de ${fmt(speed * dur, 1)} quilômetros.`;
    }
    // Tempo: "quanto tempo levo para fazer 120 km a 80 km/h" / "quanto tempo andando 5 km"
    if (/quanto tempo|em quanto tempo|quanto demora|quantas horas|quantos minutos|leva quanto/.test(t) && dist) {
      let v = speed;
      let how = v ? `a ${fmt(v)} quilômetros por hora` : "";
      if (!v) {
        const mode = MODE_SPEED.find(([re]) => re.test(t));
        if (!mode) return null;
        [, v, how] = mode;
        how = `${how}, numa média de ${v} quilômetros por hora`;
      }
      return `Para ${fmt(dist, 1)} quilômetros ${how}, leva cerca de ${spanText(dist / v)}.`;
    }
    return null;
  }

  /* ---------- Finanças ---------- */

  function rate(t) {
    const m = t.match(/(\d+(?:[.,]\d+)?)\s*(?:%|por cento)\s*(ao mes|ao ano|a\.?m\.?|a\.?a\.?|por mes|por ano|mensal|anual)?/);
    if (!m) return null;
    const r = toNumber(m[1]) / 100;
    const yearly = /ano|a\.?a|anual/.test(m[2] || "");
    return { monthly: yearly ? Math.pow(1 + r, 1 / 12) - 1 : r, label: `${fmt(r * 100)}% ${yearly ? "ao ano" : "ao mês"}` };
  }

  function months(t) {
    const m = t.match(/(\d+)\s*(meses|mes|anos?)\b/);
    if (!m) return null;
    return /ano/.test(m[2]) ? Number(m[1]) * 12 : Number(m[1]);
  }

  function amounts(t) {
    // Valores em dinheiro: números que não são taxa nem prazo
    return [...t.matchAll(new RegExp(`(?:r\\$\\s*)?${NUM}(?!\\s*(?:%|por cento|meses|mes|anos?|vezes|parcelas|x\\b))`, "g"))]
      .map((m) => ({ v: toNumber(m[1], m[2]), at: m.index, raw: m[0] }))
      .filter((a) => a.v !== null);
  }

  function interestReply(t) {
    if (!/rend|juros|investi|aplica|poupan|guardando|guardar|aporte|vai ficar|terei|teria/.test(t)) return null;
    const r = rate(t);
    const n = months(t);
    if (!r || !n) return null;
    const vals = amounts(t);
    // Aporte mensal: "500 por mês" (a taxa "1% ao mês" não entra, por causa do %)
    const monthlyMatch = t.match(new RegExp(`${NUM}\\s*(?:reais\\s*)?(?:por mes|todo mes|mensais|mensalmente|ao mes)`));
    const monthly = monthlyMatch ? toNumber(monthlyMatch[1], monthlyMatch[2]) : 0;
    const initial = vals.find((a) => !monthlyMatch || a.at !== monthlyMatch.index)?.v || 0;
    const i = r.monthly;
    const fvInitial = initial * Math.pow(1 + i, n);
    const fvMonthly = monthly ? monthly * ((Math.pow(1 + i, n) - 1) / i) : 0;
    const total = fvInitial + fvMonthly;
    const invested = initial + monthly * n;
    if (!invested) return null;
    const span = n % 12 === 0 && n >= 12 ? `${n / 12} ${n === 12 ? "ano" : "anos"}` : `${n} meses`;
    const what = [initial ? money(initial) : "", monthly ? `${money(monthly)} por mês` : ""].filter(Boolean).join(" mais ");
    return `Com ${what} a ${r.label}, em ${span} você terá cerca de ${money(total)}: ${money(invested)} investidos e ${money(total - invested)} de juros.`;
  }

  function installmentReply(t) {
    if (!/parcela|prestac|financ|empresti|vezes|parcelado|parcelar/.test(t)) return null;
    const nMatch = t.match(/(\d+)\s*(?:vezes|parcelas|prestacoes|x\b|meses)/);
    if (!nMatch) return null;
    const n = Number(nMatch[1]);
    const r = rate(t);
    const vals = amounts(t).filter((a) => a.at !== nMatch.index);
    const pv = vals[0]?.v;
    if (!pv || !n) return null;
    if (!r || r.monthly === 0) return `${n} parcelas de ${money(pv / n)}, sem juros.`;
    const i = r.monthly;
    const pmt = (pv * i) / (1 - Math.pow(1 + i, -n));
    return `Financiando ${money(pv)} em ${n} vezes a ${r.label}, cada parcela fica em cerca de ${money(pmt)}. ` +
      `No total você paga ${money(pmt * n)}, sendo ${money(pmt * n - pv)} de juros.`;
  }

  function percentReply(t) {
    // "30% de desconto em 250" · "250 com 30% de desconto" · "aumento de 10% em 1500"
    const r = t.match(/(\d+(?:[.,]\d+)?)\s*(?:%|por cento)/);
    if (r && /desconto|aumento|acrescimo|reajuste|mais|menos|tirando|abatimento/.test(t)) {
      const pct = toNumber(r[1]);
      const base = amounts(t).find((a) => a.at !== r.index && !t.slice(a.at, a.at + a.raw.length + 2).includes("%"));
      if (!base) return null;
      const off = /desconto|menos|tirando|abatimento/.test(t);
      const delta = (base.v * pct) / 100;
      return off
        ? `Com ${fmt(pct)}% de desconto, ${fmt(base.v, 2)} cai para ${fmt(base.v - delta, 2)}: um desconto de ${fmt(delta, 2)}.`
        : `Com ${fmt(pct)}% de aumento, ${fmt(base.v, 2)} vai para ${fmt(base.v + delta, 2)}: um acréscimo de ${fmt(delta, 2)}.`;
    }
    // "30 é quantos por cento de 200" · "quanto por cento é 30 de 200"
    const m = t.match(new RegExp(`${NUM}\\s*(?:e|sao|representa)?\\s*quant[oa]s? (?:por cento|%)\\s*de\\s*${NUM}`)) ||
      t.match(new RegExp(`quant[oa]s? (?:por cento|%)\\s*(?:e|sao)?\\s*${NUM}\\s*de\\s*${NUM}`));
    if (m) {
      const a = toNumber(m[1], m[2]);
      const b = toNumber(m[3], m[4]);
      if (a !== null && b) return `${fmt(a, 2)} é ${fmt((a / b) * 100, 2)}% de ${fmt(b, 2)}.`;
    }
    return null;
  }

  function budgetReply(t) {
    if (!/(dividir|organizar|orcamento|planejar|distribuir).*(salario|renda|ganho|dinheiro)|(salario|renda) de/.test(t)) return null;
    const v = amounts(t)[0]?.v;
    if (!v) return null;
    return `Uma divisão saudável para ${money(v)} é a regra 50, 30, 20: ` +
      `${money(v * 0.5)} para o essencial, como moradia, contas e mercado; ` +
      `${money(v * 0.3)} para estilo de vida e lazer; ` +
      `e ${money(v * 0.2)} para guardar ou quitar dívidas. ` +
      `Comece montando uma reserva de emergência de uns seis meses de gastos essenciais, cerca de ${money(v * 0.5 * 6)}.`;
  }

  /* Câmbio (AwesomeAPI, gratuita e sem chave) */

  const CURRENCIES = [
    [/dolar(?:es)? canadense|cad\b/, "CAD", "dólar canadense", "dólares canadenses"],
    [/dolar(?:es)? australiano|aud\b/, "AUD", "dólar australiano", "dólares australianos"],
    [/dolar|dolares|\busd\b/, "USD", "dólar", "dólares"],
    [/euros?|eur\b/, "EUR", "euro", "euros"],
    [/libras? esterlinas?|gbp\b/, "GBP", "libra esterlina", "libras esterlinas"],
    [/pesos? argentinos?|ars\b/, "ARS", "peso argentino", "pesos argentinos"],
    [/pesos? chilenos?|clp\b/, "CLP", "peso chileno", "pesos chilenos"],
    [/pesos? mexicanos?|mxn\b/, "MXN", "peso mexicano", "pesos mexicanos"],
    [/ienes?|yen|jpy\b/, "JPY", "iene", "ienes"],
    [/yuans?|renminbi|cny\b/, "CNY", "yuan", "yuans"],
    [/francos? suicos?|chf\b/, "CHF", "franco suíço", "francos suíços"],
    [/bitcoins?|btc\b/, "BTC", "bitcoin", "bitcoins"],
    [/ethereum|eth\b/, "ETH", "ethereum", "ethereum"],
    [/\breais\b|\breal\b|\bbrl\b|r\$/, "BRL", "real", "reais"],
  ];

  function findCurrencies(t) {
    const out = [];
    for (const [re, code, one, many] of CURRENCIES) {
      const m = t.match(re);
      if (m && !out.some((o) => o.code === code)) out.push({ code, one, many, at: m.index });
    }
    return out.sort((a, b) => a.at - b.at);
  }

  async function rateToBRL(code) {
    if (code === "BRL") return 1;
    const res = await fetch(`https://economia.awesomeapi.com.br/json/last/${code}-BRL`);
    if (!res.ok) throw new Error("cambio");
    const data = await res.json();
    return Number(data[`${code}BRL`].bid);
  }

  async function currencyReply(input) {
    const t = plain(input);
    const cur = findCurrencies(t);
    if (cur.length < 2 && !/cotacao|quanto|converte|convert|cambio|valendo/.test(t)) return null;
    if (!cur.length || (cur.length === 1 && cur[0].code === "BRL")) return null;
    // A primeira moeda citada é a de origem; sem segunda, converte para reais.
    const first = cur[0];
    const target = cur[1] || { code: "BRL", one: "real", many: "reais" };
    const valueMatch = [...t.slice(0, first.at).matchAll(new RegExp(NUM, "g"))].pop();
    const amount = valueMatch ? toNumber(valueMatch[1], valueMatch[2]) : 1;
    let a, b;
    try {
      [a, b] = await Promise.all([rateToBRL(first.code), rateToBRL(target.code)]);
    } catch {
      return "Não consegui consultar a cotação agora. Tente de novo em instantes.";
    }
    const result = (amount * a) / b;
    const name = (c, v) => (v === 1 ? c.one : c.many);
    const digits = target.code === "BTC" || target.code === "ETH" ? 6 : 2;
    if (!valueMatch) {
      return `Agora, 1 ${first.one} está valendo cerca de ${fmt(result, digits)} ${name(target, result)}.`;
    }
    return `${fmt(amount, 2)} ${name(first, amount)} dão cerca de ${fmt(result, digits)} ${name(target, result)}, pela cotação de agora.`;
  }

  const TIPS = [
    "Monte uma reserva de emergência antes de investir em coisas arriscadas: o ideal são seis meses dos seus gastos essenciais.",
    "Fuja do rotativo do cartão e do cheque especial: são os juros mais caros do país. Se não der para pagar a fatura toda, um empréstimo pessoal costuma sair mais barato.",
    "Pague-se primeiro: assim que o salário cair, separe a parte de guardar antes de gastar.",
    "Anote seus gastos por um mês. Só de enxergar para onde o dinheiro vai, fica mais fácil cortar o que não importa.",
    "Para comparar investimentos, olhe o rendimento depois do imposto e das taxas, não só a porcentagem anunciada.",
    "Compras grandes: espere 48 horas antes de decidir. Se a vontade passar, você economizou.",
  ];

  function financeReply(input) {
    const t = plain(input);
    if (/dica (financeira|de dinheiro)|como (economizar|guardar dinheiro|sair das dividas|juntar dinheiro)/.test(t)) {
      return TIPS[Math.floor(Math.random() * TIPS.length)];
    }
    return installmentReply(t) || interestReply(t) || budgetReply(t) || percentReply(t);
  }

  /* ---------- Geopolítica (REST Countries) ---------- */

  const REGIONS = { Americas: "Américas", Europe: "Europa", Asia: "Ásia", Africa: "África", Oceania: "Oceania", Antarctic: "Antártida" };
  const LANGS = {
    por: "português", spa: "espanhol", eng: "inglês", fra: "francês", deu: "alemão", ita: "italiano", jpn: "japonês",
    zho: "chinês", rus: "russo", ara: "árabe", hin: "hindi", kor: "coreano", nld: "holandês", tur: "turco", heb: "hebraico",
    grn: "guarani", que: "quíchua", aym: "aimará", ukr: "ucraniano", pol: "polonês", swe: "sueco", nor: "norueguês",
    dan: "dinamarquês", fin: "finlandês", ell: "grego", fas: "persa", urd: "urdu", ben: "bengali", ind: "indonésio",
    msa: "malaio", tha: "tailandês", vie: "vietnamita", swa: "suaíli", afr: "africâner", cat: "catalão", eus: "basco",
    glg: "galego", gle: "irlandês", isl: "islandês", hun: "húngaro", ces: "tcheco", ron: "romeno", bul: "búlgaro",
    hrv: "croata", srp: "sérvio",
  };
  const currencyName = (code) => {
    try {
      const n = new Intl.DisplayNames(["pt-BR"], { type: "currency" }).of(code);
      return n.charAt(0).toLowerCase() + n.slice(1);
    } catch {
      return code;
    }
  };

  const COUNTRY_Q = /\b(capital|populacao|habitantes|quantas pessoas|quantos habitantes|area|tamanho|extensao|moeda|dinheiro|idioma|lingua|linguas|idiomas|continente|regiao|fronteira|vizinhos|faz fronteira)\b/;

  const COUNTRY_KEY = /(capital|popula[cç][aã]o|habitantes|quantas pessoas|[aá]rea|tamanho|extens[aã]o|moeda|dinheiro|idiomas?|l[ií]nguas?|continente|regi[aã]o|fronteiras?|vizinhos)/u;
  const FILLER = /^(?:d[oae]s?|de|na|no|nas|nos|o|a|os|as|se|fala|falam|faz|fazem|com|quem|tem|é|e|em|qual|quais|que|quantos|quantas|quantos|oficial|oficiais|pa[ií]s|pa[ií]ses|hor[aá]cio)$/u;

  /** Nome do país, com acentos ("França"): o que sobra perto da palavra-chave. */
  function countryName(input) {
    const t = input.toLowerCase().replace(/[?!.,;:]/g, " ").replace(/\s+/g, " ").trim();
    const k = t.match(COUNTRY_KEY);
    if (!k) return null;
    const trim = (part) => {
      const words = part.split(" ").filter(Boolean);
      while (words.length && FILLER.test(words[0])) words.shift();
      while (words.length && FILLER.test(words[words.length - 1])) words.pop();
      return words.join(" ");
    };
    return trim(t.slice(k.index + k[0].length)) || trim(t.slice(0, k.index)) || null;
  }

  async function countryData(name) {
    const fields = "name,translations,capital,population,area,currencies,languages,region,subregion,borders";
    const res = await fetch(`https://restcountries.com/v3.1/translation/${encodeURIComponent(name)}?fields=${fields}`);
    if (!res.ok) return null;
    const list = await res.json();
    const n = plain(name);
    return list.find((c) => plain(c.translations?.por?.common || "") === n) || list[0] || null;
  }

  async function countryReply(input) {
    const t = plain(input).replace(/[.,;]/g, " ").replace(/\s+/g, " ").trim();
    const q = t.match(COUNTRY_Q);
    if (!q) return null;
    const name = countryName(input);
    if (!name) return null;
    let c;
    try {
      c = await countryData(name);
    } catch {
      return null;
    }
    if (!c) return null;
    const pt = c.translations?.por?.common || c.name.common;
    const k = q[1];
    if (k === "capital") {
      const caps = c.capital || [];
      return caps.length ? `A capital ${artigo(pt)} ${pt} é ${caps.join(" e ")}.` : `${pt} não tem uma capital oficial.`;
    }
    if (/populacao|habitantes|pessoas/.test(k)) {
      const p = c.population;
      const txt = p >= 1e6 ? `${fmt(p / 1e6, 1)} milhões` : fmt(p, 0);
      return `${pt} tem cerca de ${txt} de habitantes.`;
    }
    if (/area|tamanho|extensao/.test(k)) {
      return `${pt} tem cerca de ${fmt(c.area, 0)} quilômetros quadrados.`;
    }
    if (/moeda|dinheiro/.test(k)) {
      const codes = Object.keys(c.currencies || {});
      return codes.length ? `A moeda ${artigo(pt)} ${pt} é ${codes.map((code) => `${currencyName(code)} (${code})`).join(" e ")}.` : `Não encontrei a moeda ${artigo(pt)} ${pt}.`;
    }
    if (/idioma|lingua/.test(k)) {
      const langs = Object.entries(c.languages || {}).map(([code, en]) => LANGS[code] || en);
      return `${capitalize(locative(pt))} ${pt} se fala ${langs.join(", ").replace(/, ([^,]*)$/, " e $1")}.`;
    }
    if (/continente|regiao/.test(k)) {
      return `${pt} fica ${c.subregion ? `na região ${c.subregion} ` : ""}nas ${REGIONS[c.region] || c.region}.`.replace("nas Europa", "na Europa").replace("nas Ásia", "na Ásia").replace("nas África", "na África").replace("nas Oceania", "na Oceania").replace("nas Antártida", "na Antártida");
    }
    if (/fronteira|vizinhos/.test(k)) {
      const borders = c.borders || [];
      if (!borders.length) return `${pt} não faz fronteira terrestre com nenhum país.`;
      try {
        const res = await fetch(`https://restcountries.com/v3.1/alpha?codes=${borders.join(",")}&fields=translations,name`);
        const list = await res.json();
        const names = list.map((x) => x.translations?.por?.common || x.name.common);
        return `${pt} faz fronteira com ${names.length} países: ${names.join(", ").replace(/, ([^,]*)$/, " e $1")}.`;
      } catch {
        return `${pt} faz fronteira com ${borders.length} países.`;
      }
    }
    return null;
  }

  /** "na Bolívia", "no Japão", "nos Estados Unidos", "em Portugal" */
  function locative(country) {
    const a = artigo(country);
    return { da: "na", do: "no", das: "nas", dos: "nos", de: "em" }[a];
  }

  function artigo(country) {
    const fem = /a$/i.test(country) && !/^(canada|guatemala|panama)$/i.test(plain(country));
    const plural = /^(estados unidos|emirados|paises baixos|filipinas|maldivas|bahamas|seicheles)/i.test(plain(country));
    if (/^(portugal|israel|cuba|angola|mocambique|madagascar|singapura|taiwan|andorra|malta|chipre)$/i.test(plain(country))) return "de";
    return plural ? (fem ? "das" : "dos") : fem ? "da" : "do";
  }

  /* ---------- Inteligência emocional ---------- */

  const CRISIS = /(quero morrer|vontade de morrer|me matar|suicid|nao quero (mais )?viver|acabar com (a )?minha vida|tirar (a )?minha (propria )?vida|me machucar|sumir pra sempre)/;

  const FEELINGS = [
    {
      re: /(triste|tristeza|pra baixo|para baixo|deprimid|desanimad|chatead|mal hoje|estou mal|to mal|chorando|vontade de chorar|coracao partido)/,
      replies: [
        "Sinto muito que você esteja assim. Tristeza pesa, e tudo bem não estar bem hoje. Quer me contar o que aconteceu?",
        "Que pena ouvir isso. Às vezes ajuda dar nome ao que dói e falar com alguém de confiança. Estou aqui para ouvir: o que está pesando mais?",
        "Fico do seu lado. Uma coisa pequena pode ajudar agora: um copo de água, uma janela aberta, uns minutos de caminhada. E se quiser desabafar, pode falar comigo.",
      ],
      persistent: "Se essa tristeza já dura semanas, vale procurar um psicólogo ou a unidade de saúde perto de você. Cuidar da cabeça é tão importante quanto do corpo.",
    },
    {
      re: /(ansios|ansiedade|nervos|preocupad|aflit|agoniad|apreensiv|com medo|assustad|panico)/,
      replies: [
        "Respira comigo: inspire contando até quatro, segure quatro, solte em quatro, espere quatro. Repita umas quatro vezes. Depois me conta o que está te preocupando.",
        "Ansiedade costuma exagerar o tamanho das coisas. Tente separar: o que disso depende de você agora? Comece só por esse primeiro passo.",
        "Entendo. Um truque rápido para o momento: repare em cinco coisas que você vê, quatro que pode tocar, três que ouve. Isso traz a cabeça de volta para o agora.",
      ],
      persistent: "Se a ansiedade estiver atrapalhando seu sono ou seu dia a dia com frequência, um profissional pode ajudar bastante.",
    },
    {
      re: /(estressad|sobrecarregad|exaust|esgotad|cansad|sem energia|morto de cansaco|nao aguento mais (o )?trabalho)/,
      replies: [
        "Você merece uma pausa. Que tal parar dez minutos, beber água e esticar o corpo? Às vezes o melhor jeito de render mais é descansar um pouco.",
        "Quando tudo parece urgente, escolha só três coisas importantes para hoje. O resto pode esperar até amanhã.",
        "Cansaço acumulado cobra caro. Se puder, priorize uma boa noite de sono hoje. Quer que eu te lembre de ir dormir mais cedo?",
      ],
    },
    {
      re: /(sozinh|solitari|solidao|ninguem (me )?liga|sem amigos|abandonad)/,
      replies: [
        "Sentir-se só é duro. Que tal mandar uma mensagem para alguém de quem você gosta, mesmo que seja só um oi? E enquanto isso, eu estou aqui com você.",
        "Você não está sozinho nessa conversa. Me conta como foi o seu dia?",
      ],
    },
    {
      re: /(com raiva|irritad|puto|furios|odio|revoltad|estressado com)/,
      replies: [
        "Raiva é um sinal de que algo importa para você. Antes de responder a alguém, dê uns minutos e respire fundo. Quer me contar o que aconteceu?",
        "Entendo a irritação. Uma caminhada curta ou escrever o que sente, sem mandar para ninguém, ajuda a baixar a temperatura.",
      ],
    },
    {
      re: /(feliz|alegre|animad|empolgad|consegui|deu certo|passei|fui aprovad|to bem|estou bem|otimo dia|dia incrivel)/,
      replies: [
        "Que notícia boa! Fico feliz por você. Aproveite e comemore, você merece.",
        "Excelente! Momentos assim valem guardar na memória. O que deixou o dia tão bom?",
      ],
    },
  ];

  let lastFeeling = "";
  let feelingCount = 0;

  function emotionalReply(input) {
    const t = plain(input);
    if (CRISIS.test(t)) {
      return "Sinto muito que você esteja passando por isso. Você não está sozinho e merece apoio agora. " +
        "Por favor, fale com o CVV: é só ligar 188, de graça e a qualquer hora, ou conversar pelo chat em cvv.org.br. " +
        "Se estiver em perigo imediato, ligue 192. Eu continuo aqui com você.";
    }
    if (!/(estou|to|ando|me sinto|sinto|sentindo|fiquei|tô|estava|hoje|que dia|ta dificil|esta dificil|consegui|deu certo|passei|fui)/.test(t)) return null;
    const feeling = FEELINGS.find((f) => f.re.test(t));
    if (!feeling) return null;
    feelingCount = feeling === lastFeeling ? feelingCount + 1 : 1;
    lastFeeling = feeling;
    const reply = feeling.replies[(feelingCount - 1) % feeling.replies.length];
    return feelingCount >= 3 && feeling.persistent ? `${reply} ${feeling.persistent}` : reply;
  }

  /* ---------- Intenções ---------- */

  // Avaliadas pelo cérebro antes das outras habilidades. null = "não era comigo".
  const intents = [
    { match: /./, reply: ({ input }) => emotionalReply(input) },
    { match: /(cotacao|dolar|euro|bitcoin|libra esterlina|iene|yuan|pesos? (argentino|chileno|mexicano)|franco suico|cambio)/, reply: ({ input }) => currencyReply(input) },
    { match: /(parcela|prestac|financ|empresti|juros|rend|investi|aplica|poupan|guard|aporte|terei|vai ficar|desconto|aumento|acrescimo|reajuste|por cento|%|salario|renda|orcamento|dica|economizar|dividas|juntar dinheiro)/, reply: ({ input }) => financeReply(input) },
    { match: /(quanto tempo|em quanto tempo|quanto demora|quantas horas|quantos minutos|velocidade|que distancia|quantos km|quantos quilometros)/, reply: ({ input }) => travelReply(input) },
    { match: /(capital|populacao|habitantes|area|tamanho|moeda|idioma|lingua|continente|fronteira|vizinhos)/, reply: ({ input }) => countryReply(input) },
    { match: /(em|para|quant[oa]s|converte|convert|equivale|sao|tem)/, reply: ({ input }) => convertReply(input) },
  ];

  H.smart = { intents, convertReply, travelReply, financeReply, currencyReply, countryReply, emotionalReply, plain };
})((window.Horacio = window.Horacio || {}));
