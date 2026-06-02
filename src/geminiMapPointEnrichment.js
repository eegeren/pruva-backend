const fetch = require('node-fetch');

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
];
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const ENRICHABLE_TYPES = new Set([
  'marina',
  'fuel',
  'service',
  'diving',
  'water',
  'customs',
  'emergency',
  'restaurant',
  'beach',
]);

function isConfigured() {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  return key.startsWith('AIza');
}

function clean(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'unknown') {
    return null;
  }
  return trimmed;
}

function hasSparseDetails(point) {
  return (
    point.depth_m == null &&
    point.berth_count == null &&
    !clean(point.vhf_channel) &&
    !clean(point.opening_hours) &&
    (!point.fuel_types || (Array.isArray(point.fuel_types) && point.fuel_types.length === 0)) &&
    !clean(point.amenities) &&
    !clean(point.ai_summary)
  );
}

function enrichmentIsFresh(point) {
  if (!point.enriched_at) return false;
  const age = Date.now() - new Date(point.enriched_at).getTime();
  return age < CACHE_TTL_MS;
}

function shouldEnrich(point) {
  if (!isConfigured()) return false;
  if (!ENRICHABLE_TYPES.has(point.type)) return false;
  if (enrichmentIsFresh(point) && !hasSparseDetails(point)) return false;
  if (enrichmentIsFresh(point) && hasSparseDetails(point)) {
    // Retry once per week if still empty after a prior run
    return true;
  }
  if (!enrichmentIsFresh(point)) return true;
  return hasSparseDetails(point);
}

function parseDepthM(value) {
  const text = clean(value);
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

function parseBerthCount(value) {
  const text = clean(value);
  if (!text) return null;
  const match = text.match(/(\d+)/);
  if (!match) return null;
  const num = Number.parseInt(match[1], 10);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function parseFuelTypes(value) {
  const text = clean(value);
  if (!text) return null;
  return text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPrompt(point) {
  const kindByType = {
    marina: 'marina',
    fuel: 'marine fuel station',
    service: 'marine service yard or boatyard',
    diving: 'dive site or diving center',
    water: 'water supply point for boats',
    customs: 'customs or port authority office for yachts',
    emergency: 'marine emergency or rescue point',
    restaurant: 'restaurant or café for boaters near the water',
    beach: 'beach or landing spot relevant to boaters',
  };
  const kind = kindByType[point.type] || 'marine map point';

  const lines = [
    'You are a nautical data assistant for the Pruva sailing app.',
    'Return ONLY valid JSON (no markdown) for this place.',
    'Use concise English. Use null for unknown fields — do not guess wildly.',
    'Prefer facts from the business name, coordinates, phone, and website when plausible.',
    '',
    'Place:',
    `- name: ${point.name}`,
    `- type: ${point.type} (${kind})`,
    `- latitude: ${point.latitude}`,
    `- longitude: ${point.longitude}`,
  ];

  if (point.phone) lines.push(`- phone: ${point.phone}`);
  if (point.website) lines.push(`- website: ${point.website}`);
  if (point.description) lines.push(`- description: ${point.description}`);

  lines.push('');
  lines.push(`JSON keys (all strings or null):
entrance_depth, berth_capacity, vhf_channel,
opening_hours, fuel_types,
amenities (services useful to boaters),
summary (one sentence overview in English)`);
  lines.push('For fuel stations prioritize fuel_types, opening_hours, amenities.');
  lines.push('For marinas prioritize entrance_depth, berth_capacity, vhf_channel, opening_hours.');
  lines.push(
    `Use coordinates (${point.latitude}, ${point.longitude}) to infer the real place if the name is vague.`,
  );
  lines.push('For Turkish Aegean/Mediterranean coast, use local marina knowledge when reasonable.');

  return lines.join('\n');
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY.trim();
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  };

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        console.warn(`Gemini ${model} error ${response.status}:`, JSON.stringify(data).slice(0, 200));
        continue;
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      const payload = JSON.parse(text);
      return payload;
    } catch (err) {
      console.warn(`Gemini ${model} failed:`, err.message);
    }
  }
  return null;
}

function payloadToUpdates(point, payload) {
  if (!payload || typeof payload !== 'object') return null;

  const depthM = parseDepthM(payload.entrance_depth);
  const berthCount = parseBerthCount(payload.berth_capacity);
  const vhf = clean(payload.vhf_channel);
  const hours = clean(payload.opening_hours);
  const fuelTypes = parseFuelTypes(payload.fuel_types);
  const amenities = clean(payload.amenities);
  const summary = clean(payload.summary);

  const updates = {
    depth_m: point.depth_m ?? depthM,
    berth_count: point.berth_count ?? berthCount,
    vhf_channel: clean(point.vhf_channel) ? point.vhf_channel : vhf,
    opening_hours: clean(point.opening_hours) ? point.opening_hours : hours,
    fuel_types:
      point.fuel_types && Array.isArray(point.fuel_types) && point.fuel_types.length > 0
        ? point.fuel_types
        : fuelTypes,
    amenities: clean(point.amenities) ? point.amenities : amenities,
    ai_summary: clean(point.ai_summary) ? point.ai_summary : summary,
  };

  const changed =
    (updates.depth_m != null && point.depth_m == null) ||
    (updates.berth_count != null && point.berth_count == null) ||
    (updates.vhf_channel && !clean(point.vhf_channel)) ||
    (updates.opening_hours && !clean(point.opening_hours)) ||
    (updates.fuel_types && (!point.fuel_types || point.fuel_types.length === 0)) ||
    (updates.amenities && !clean(point.amenities)) ||
    (updates.ai_summary && !clean(point.ai_summary));

  if (!changed && !summary && !amenities) return null;
  return updates;
}

async function enrichMapPoint(point, db, options = {}) {
  if (!options.force && !shouldEnrich(point)) return point;

  const payload = await callGemini(buildPrompt(point));
  if (!payload) {
    console.warn(`Gemini returned no payload for map point ${point.id} (${point.name})`);
    return point;
  }

  const updates = payloadToUpdates(point, payload);
  if (!updates) {
    console.warn(`Gemini payload had no usable fields for map point ${point.id}`);
    return point;
  }

  const result = await db.query(
    `UPDATE map_points
     SET
       depth_m = COALESCE(depth_m, $2),
       berth_count = COALESCE(berth_count, $3),
       vhf_channel = COALESCE(NULLIF(TRIM(vhf_channel), ''), NULLIF(TRIM($4), '')),
       opening_hours = COALESCE(NULLIF(TRIM(opening_hours), ''), NULLIF(TRIM($5), '')),
       fuel_types = CASE
         WHEN fuel_types IS NOT NULL AND cardinality(fuel_types) > 0 THEN fuel_types
         WHEN $6::text[] IS NOT NULL THEN $6::text[]
         ELSE fuel_types
       END,
       amenities = COALESCE(NULLIF(TRIM(amenities), ''), NULLIF(TRIM($7), '')),
       ai_summary = COALESCE(NULLIF(TRIM(ai_summary), ''), NULLIF(TRIM($8), '')),
       enriched_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      point.id,
      updates.depth_m,
      updates.berth_count,
      updates.vhf_channel,
      updates.opening_hours,
      updates.fuel_types,
      updates.amenities,
      updates.ai_summary,
    ]
  );

  return result.rows[0] || point;
}

module.exports = {
  ENRICHABLE_TYPES,
  isConfigured,
  shouldEnrich,
  enrichMapPoint,
};
