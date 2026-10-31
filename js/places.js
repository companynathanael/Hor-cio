/*
  Lugares do dono (casa, trabalho) e distância até eles.
  - Localização atual: GPS do aparelho (Geolocation API).
  - Endereços: Nominatim (OpenStreetMap).
  - Rotas: OSRM nos servidores do OpenStreetMap; sem trânsito em tempo real.
  Os lugares ficam salvos só no aparelho.
*/
(function (H) {
  const NOMINATIM = "https://nominatim.openstreetmap.org";
  const ROUTER = {
    carro: "https://routing.openstreetmap.de/routed-car/route/v1/driving/",
    bicicleta: "https://routing.openstreetmap.de/routed-bike/route/v1/driving/",
    ape: "https://routing.openstreetmap.de/routed-foot/route/v1/driving/",
  };
  // Velocidades médias (km/h) para a estimativa em linha reta, se a rota falhar.
  const SPEED = { carro: 30, bicicleta: 14, ape: 4.8 };
  const DETOUR = 1.3; // ruas não são linha reta

  const canLocate = "geolocation" in navigator;

  class PlaceError extends Error {
    constructor(code) {
      super(code);
      this.code = code;
    }
  }

  /** Posição atual: { lat, lon, accuracy } */
  function here() {
    if (!canLocate) return Promise.reject(new PlaceError("unsupported"));
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
        (e) => reject(new PlaceError(e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    });
  }

  async function getJSON(url) {
    let res;
    try {
      res = await fetch(url, { headers: { Accept: "application/json" } });
    } catch {
      throw new PlaceError("network");
    }
    if (!res.ok) throw new PlaceError("service");
    return res.json();
  }

  /** Endereço → { lat, lon, label } */
  async function geocode(address) {
    const q = encodeURIComponent(address);
    const list = await getJSON(`${NOMINATIM}/search?format=jsonv2&limit=1&addressdetails=1&accept-language=pt-BR&q=${q}`);
    if (!list.length) throw new PlaceError("notfound");
    const r = list[0];
    return { lat: Number(r.lat), lon: Number(r.lon), label: shortLabel(r) };
  }

  /** Coordenadas → nome curto do endereço */
  async function reverse({ lat, lon }) {
    try {
      const r = await getJSON(`${NOMINATIM}/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=pt-BR&lat=${lat}&lon=${lon}`);
      return shortLabel(r);
    } catch {
      return "";
    }
  }

  function shortLabel(r) {
    const a = r.address || {};
    const street = [a.road, a.house_number].filter(Boolean).join(", ");
    const area = a.suburb || a.neighbourhood || a.city_district || a.city || a.town || a.village || "";
    return [street, area].filter(Boolean).join(" — ") || (r.display_name || "").split(",").slice(0, 2).join(",");
  }

  /** Distância em linha reta, em metros. */
  function haversine(a, b) {
    const R = 6371000;
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /**
   * Tempo e distância de `from` até `to`.
   * Resolve com { seconds, meters, exact } — exact=false quando é estimativa.
   */
  async function travel(from, to, mode = "carro") {
    const base = ROUTER[mode] || ROUTER.carro;
    try {
      const data = await getJSON(`${base}${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`);
      const route = data.routes?.[0];
      if (data.code === "Ok" && route) return { seconds: route.duration, meters: route.distance, exact: true };
    } catch {
      /* segue para a estimativa */
    }
    const meters = haversine(from, to) * DETOUR;
    return { seconds: (meters / 1000 / (SPEED[mode] || SPEED.carro)) * 3600, meters, exact: false };
  }

  H.places = { canLocate, here, geocode, reverse, haversine, travel, PlaceError };
})((window.Horacio = window.Horacio || {}));
