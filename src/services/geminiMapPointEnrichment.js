const fetch = require('node-fetch');

/** One cheap model per request — trying several models on 429 burns quota faster. */
const DEFAULT_MODEL = 'gemini-2.0-flash-lite';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_QUOTA_COOLDOWN_MS = 60 * 60 * 1000;

let quotaBlockedUntil = 0;
const enrichmentInFlight = new Set();

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

function hasAiReviews(point) {
  if (point.type !== 'marina') return true;
  const raw = point.ai_reviews;
  if (!raw) return false;
  if (Array.isArray(raw)) return raw.length > 0;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }
  return false;
}

function enrichmentIsFresh(point) {
  if (!point.enriched_at) return false;
  const age = Date.now() - new Date(point.enriched_at).getTime();
  return age < CACHE_TTL_MS;
}

function isQuotaBlocked() {
  return Date.now() < quotaBlockedUntil;
}

function getQuotaStatus() {
  if (!isConfigured()) {
    return { configured: false, blocked: false, blocked_until: null };
  }
  if (!isQuotaBlocked()) {
    return { configured: true, blocked: false, blocked_until: null };
  }
  return {
    configured: true,
    blocked: true,
    blocked_until: new Date(quotaBlockedUntil).toISOString(),
  };
}

function markQuotaBlocked(retryAfterSeconds) {
  const cooldownMs = retryAfterSeconds
    ? retryAfterSeconds * 1000
    : Number(process.env.GEMINI_QUOTA_COOLDOWN_MS || DEFAULT_QUOTA_COOLDOWN_MS);
  quotaBlockedUntil = Date.now() + cooldownMs;
  console.warn(
    `Gemini quota exceeded — enrichment paused for ${Math.round(cooldownMs / 60000)} min. Enable billing: https://ai.google.dev/pricing`,
  );
}

function shouldEnrich(point) {
  if (!isConfigured()) return false;
  if (isQuotaBlocked()) return false;
  if (!ENRICHABLE_TYPES.has(point.type)) return false;

  const needsReviews = point.type === 'marina' && !hasAiReviews(point);
  const needsDetails = hasSparseDetails(point);

  if (enrichmentIsFresh(point) && !needsDetails && !needsReviews) return false;
  if (!enrichmentIsFresh(point)) return true;
  return needsDetails || needsReviews;
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

function parseAiReviews(payload, pointType) {
  if (pointType !== 'marina' || !Array.isArray(payload.reviews)) return null;

  const items = payload.reviews
    .slice(0, 4)
    .map((entry, index) => {
      const text = clean(entry?.text);
      if (!text) return null;
      const ratingRaw = entry?.rating;
      const ratingNum =
        typeof ratingRaw === 'number'
          ? ratingRaw
          : Number.parseFloat(String(ratingRaw ?? ''));
      const rating = Number.isFinite(ratingNum)
        ? Math.min(5, Math.max(1, Math.round(ratingNum * 10) / 10))
        : null;
      return {
        author: clean(entry?.author) || `Sailor ${index + 1}`,
        text,
        rating,
      };
    })
    .filter(Boolean);

  return items.length ? items : null;
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
  lines.push(`JSON keys (all strings or null unless noted):
entrance_depth, berth_capacity, vhf_channel,
opening_hours, fuel_types,
amenities (services useful to boaters),
summary (one sentence overview in English)`);
  if (point.type === 'marina') {
    lines.push(`reviews (array of 3 objects, required for marinas):
  each item: { "author": string (e.g. "Guest skipper"), "text": string (2-3 sentences, realistic marina experience), "rating": number 1-5 }`);
    lines.push('Write plausible sailor reviews about berthing, staff, facilities, and approach. Do not claim they are real people.');
  } else {
    lines.push('reviews: null');
  }
  lines.push('For fuel stations prioritize fuel_types, opening_hours, amenities.');
  lines.push('For marinas prioritize entrance_depth, berth_capacity, vhf_channel, opening_hours, and reviews.');
  lines.push(
    `Use coordinates (${point.latitude}, ${point.longitude}) to infer the real place if the name is vague.`,
  );
  lines.push('For Turkish Aegean/Mediterranean coast, use local marina knowledge when reasonable.');

  return lines.join('\n');
}

function parseRetryAfterSeconds(data, response) {
  const header = response.headers?.get?.('retry-after');
  if (header) {
    const sec = Number.parseInt(header, 10);
    if (Number.isFinite(sec) && sec > 0) return sec;
  }
  const details = data?.error?.details;
  if (Array.isArray(details)) {
    for (const item of details) {
      if (item?.['@type']?.includes('RetryInfo') && item.retryDelay) {
        const match = String(item.retryDelay).match(/(\d+)/);
        if (match) return Number.parseInt(match[1], 10);
      }
    }
  }
  return null;
}

async function callGemini(prompt) {
  if (isQuotaBlocked()) return null;

  const apiKey = process.env.GEMINI_API_KEY.trim();
  const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (response.status === 429) {
      markQuotaBlocked(parseRetryAfterSeconds(data, response));
      return null;
    }

    if (!response.ok) {
      console.warn(`Gemini ${model} error ${response.status}:`, JSON.stringify(data).slice(0, 200));
      return null;
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (err) {
    console.warn(`Gemini ${model} failed:`, err.message);
    return null;
  }
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
  const aiReviews = hasAiReviews(point) ? null : parseAiReviews(payload, point.type);

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
    ai_reviews: aiReviews,
  };

  const changed =
    (updates.depth_m != null && point.depth_m == null) ||
    (updates.berth_count != null && point.berth_count == null) ||
    (updates.vhf_channel && !clean(point.vhf_channel)) ||
    (updates.opening_hours && !clean(point.opening_hours)) ||
    (updates.fuel_types && (!point.fuel_types || point.fuel_types.length === 0)) ||
    (updates.amenities && !clean(point.amenities)) ||
    (updates.ai_summary && !clean(point.ai_summary)) ||
    (updates.ai_reviews && updates.ai_reviews.length > 0);

  if (!changed && !summary && !amenities && !aiReviews) return null;
  return updates;
}

async function enrichMapPoint(point, db, options = {}) {
  if (!options.force && !shouldEnrich(point)) return point;
  if (enrichmentInFlight.has(point.id)) return point;

  enrichmentInFlight.add(point.id);
  try {
    return await enrichMapPointInner(point, db, options);
  } finally {
    enrichmentInFlight.delete(point.id);
  }
}

async function enrichMapPointInner(point, db, options = {}) {
  const payload = await callGemini(buildPrompt(point));
  if (!payload) {
    if (!isQuotaBlocked()) {
      console.warn(`Gemini returned no payload for map point ${point.id} (${point.name})`);
    }
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
       ai_reviews = CASE
         WHEN ai_reviews IS NOT NULL AND jsonb_array_length(ai_reviews) > 0 THEN ai_reviews
         WHEN $9::jsonb IS NOT NULL THEN $9::jsonb
         ELSE ai_reviews
       END,
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
      updates.ai_reviews ? JSON.stringify(updates.ai_reviews) : null,
    ]
  );

  return result.rows[0] || point;
}

module.exports = {
  ENRICHABLE_TYPES,
  isConfigured,
  getQuotaStatus,
  shouldEnrich,
  enrichMapPoint,
};
