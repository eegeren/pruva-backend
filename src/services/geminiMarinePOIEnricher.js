const fetch = require('node-fetch');
const { fallbackDescriptionFor } = require('./marinePOIEnrichmentService');

function isConfigured() {
  return Boolean((process.env.GEMINI_API_KEY || '').trim());
}

function promptFor(poi) {
  const facts = {
    name: poi.name,
    type: poi.type,
    coordinates: `${Number(poi.latitude).toFixed(5)}, ${Number(poi.longitude).toFixed(5)}`,
    city: poi.city,
    region: poi.region,
    country: poi.country,
    facilities: poi.facilities,
    fuel_types: poi.fuel_types,
    opening_hours: poi.opening_hours,
    vhf_channel: poi.vhf_channel,
    entrance_depth_m: poi.entrance_depth_m,
    berth_capacity: poi.berth_capacity,
    holding_type: poi.holding_type,
    seabed_type: poi.seabed_type,
    shelter_quality: poi.shelter_quality,
  };

  return [
    `Write a concise professional maritime navigation summary for this ${poi.type}.`,
    'Do not invent exact facts that are not provided.',
    'If data is limited, speak generally and responsibly.',
    'Keep under 55 words.',
    'Tone: premium, calm, useful for captains.',
    'Output English only.',
    `Known data: ${JSON.stringify(facts)}`,
  ].join(' ');
}

async function generateSummary(poi) {
  if (!isConfigured()) return fallbackDescriptionFor(poi);

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptFor(poi) }] }],
      generationConfig: { temperature: 0.35, maxOutputTokens: 120 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini enrichment failed with ${response.status}`);
  }

  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join(' ').trim();
  return text || fallbackDescriptionFor(poi);
}

module.exports = { generateSummary, isConfigured };

