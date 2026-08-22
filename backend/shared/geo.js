// ─────────────────────────────────────────────────────────────
// Geolocalização — ViaCEP (endereço) + Mapbox (geocodificação).
// Usado pelo módulo "geolocation" (atendimento externo).
// ─────────────────────────────────────────────────────────────
const { fetchJson, onlyDigits } = require('./documents');

const CEP_CACHE = new Map();

/** Consulta o endereço a partir do CEP (ViaCEP). */
async function lookupCEP(value) {
  const cep = onlyDigits(value);
  if (cep.length !== 8) return { valid: false, reason: 'CEP inválido. Informe os 8 números.' };
  if (CEP_CACHE.has(cep)) return { valid: true, data: CEP_CACHE.get(cep) };

  const json = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`);
  if (!json) return { valid: true, unavailable: true, reason: 'Não foi possível consultar o CEP agora.' };
  if (json.erro) return { valid: false, reason: 'CEP não encontrado.' };

  const data = {
    cep: `${cep.slice(0, 5)}-${cep.slice(5)}`,
    logradouro: json.logradouro || '',
    bairro: json.bairro || '',
    cidade: json.localidade || '',
    estado: json.uf || '',
  };
  CEP_CACHE.set(cep, data);
  return { valid: true, data };
}

/**
 * Converte o endereço em latitude/longitude.
 * Usa o Mapbox quando MAPBOX_TOKEN estiver configurado; caso contrário,
 * recorre ao Nominatim (OpenStreetMap), que é gratuito e sem chave.
 */
async function geocode(address) {
  const query = String(address || '').trim();
  if (query.length < 8) return null;

  const token = process.env.MAPBOX_TOKEN;
  if (token) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
      + `?limit=1&country=BR&access_token=${encodeURIComponent(token)}`;
    const json = await fetchJson(url);
    const feature = json && Array.isArray(json.features) && json.features[0];
    if (feature && Array.isArray(feature.center)) {
      return { longitude: feature.center[0], latitude: feature.center[1], provider: 'mapbox' };
    }
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
  const json = await fetchJson(url);
  const hit = Array.isArray(json) && json[0];
  if (hit) return { latitude: Number(hit.lat), longitude: Number(hit.lon), provider: 'nominatim' };
  return null;
}

/** Monta o endereço completo para geocodificação. */
function buildAddress({ address, addressNumber, neighborhood, city, state, zipCode }) {
  return [
    [address, addressNumber].filter(Boolean).join(', '),
    neighborhood,
    city,
    state,
    zipCode,
    'Brasil',
  ].filter(Boolean).join(' - ');
}

module.exports = { lookupCEP, geocode, buildAddress };
