function cleanText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeName(value) {
  const text = cleanText(value);
  if (!text) return null;
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value) {
  if (value == null) return null;
  const match = String(value).replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  const number = parseNumber(value);
  return number == null ? null : Math.round(number);
}

function splitList(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const items = value.map(cleanText).filter(Boolean);
    return items.length ? items : null;
  }
  const items = String(value)
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

function coordinateForElement(element) {
  if (Number.isFinite(element.lat) && Number.isFinite(element.lon)) {
    return { latitude: element.lat, longitude: element.lon };
  }
  if (element.center && Number.isFinite(element.center.lat) && Number.isFinite(element.center.lon)) {
    return { latitude: element.center.lat, longitude: element.center.lon };
  }
  return null;
}

function hasTruthyTag(tags, key) {
  const value = cleanText(tags[key]);
  if (!value) return false;
  return !['no', 'false', '0'].includes(value.toLowerCase());
}

function inferType(tags) {
  const seamarkType = cleanText(tags['seamark:type'])?.toLowerCase();
  const facilityCategory = cleanText(tags['seamark:small_craft_facility:category'])?.toLowerCase();

  if (tags.leisure === 'marina' || tags.harbour === 'marina' || tags['seamark:harbour:category'] === 'marina') {
    return 'marina';
  }
  if (seamarkType === 'anchorage' || tags.anchorage != null || tags.mooring != null || tags['seamark:anchorage:category'] != null) {
    return 'anchorage';
  }
  if (tags.natural === 'bay' || tags.place === 'bay' || hasTruthyTag(tags, 'bay')) {
    return 'bay';
  }
  if (
    facilityCategory === 'fuel_station' ||
    seamarkType === 'bunker_station' ||
    tags.waterway === 'fuel' ||
    tags.amenity === 'fuel'
  ) {
    return 'fuel_station';
  }
  if (
    hasTruthyTag(tags, 'boat:repair') ||
    tags.shop === 'boat' ||
    tags.craft === 'boatbuilder' ||
    tags.industrial === 'shipyard'
  ) {
    return 'service_point';
  }
  if (tags.sport === 'scuba_diving' || tags.diving != null) {
    return 'dive_site';
  }
  if (seamarkType === 'harbour' || tags.harbour != null) {
    return facilityCategory ? 'service_point' : 'harbor';
  }
  if (seamarkType === 'small_craft_facility') {
    return facilityCategory === 'fuel_station' ? 'fuel_station' : 'service_point';
  }
  return 'unknown_marine';
}

function displayNameFor(type, tags, osmType, osmId) {
  const name = cleanText(tags.name || tags['seamark:name'] || tags['name:en'] || tags['official_name']);
  if (name) return name;

  const fallback = {
    marina: 'Unnamed Marina',
    anchorage: 'Unnamed Anchorage',
    bay: 'Unnamed Bay',
    fuel_station: 'Marine Fuel Station',
    service_point: 'Marine Service Point',
    harbor: 'Unnamed Harbor',
    dive_site: 'Dive Site',
    unknown_marine: 'Marine Point',
  }[type] || 'Marine Point';

  return `${fallback} ${osmType}/${osmId}`;
}

function extractFacilities(tags) {
  const keys = [
    'facilities',
    'service',
    'services',
    'seamark:small_craft_facility:category',
    'boat',
    'mooring',
    'dock',
    'toilets',
    'shower',
    'electricity',
    'water',
    'waste_disposal',
  ];

  const facilities = [];
  for (const key of keys) {
    const value = tags[key];
    if (value == null) continue;
    if (['yes', 'true', '1'].includes(String(value).toLowerCase())) {
      facilities.push(key.replace(/^(seamark:)?/, '').replace(/[:_]/g, ' '));
    } else if (!['no', 'false', '0'].includes(String(value).toLowerCase())) {
      facilities.push(...(splitList(value) || [String(value)]));
    }
  }

  const unique = [...new Set(facilities.map((item) => item.trim()).filter(Boolean))];
  return unique.length ? unique : null;
}

function extractFuelTypes(tags) {
  const source = tags.fuel || tags['fuel:diesel'] || tags['fuel:octane_95'] || tags['fuel:petrol'] || tags['seamark:bunker_station:product'];
  const values = splitList(source) || [];
  if (hasTruthyTag(tags, 'fuel:diesel')) values.push('diesel');
  if (hasTruthyTag(tags, 'fuel:petrol') || hasTruthyTag(tags, 'fuel:octane_95')) values.push('petrol');
  const unique = [...new Set(values.map((item) => item.trim()).filter(Boolean))];
  return unique.length ? unique : null;
}

function normalizeOSMElement(element) {
  const tags = element.tags || {};
  const coords = coordinateForElement(element);
  if (!coords) return null;

  const osmType = element.type || 'node';
  const osmId = Number(element.id);
  if (!Number.isFinite(osmId)) return null;

  const type = inferType(tags);
  const name = displayNameFor(type, tags, osmType, osmId);
  const normalizedName = normalizeName(name);

  return {
    source: 'osm',
    source_id: `osm:${osmType}:${osmId}`,
    osm_type: osmType,
    osm_id: osmId,
    type,
    name,
    normalized_name: normalizedName,
    latitude: coords.latitude,
    longitude: coords.longitude,
    country: cleanText(tags['addr:country'] || tags.country),
    region: cleanText(tags['addr:region'] || tags['addr:state'] || tags.region),
    city: cleanText(tags['addr:city'] || tags['addr:town'] || tags['addr:village']),
    address: cleanText(tags['addr:full'] || tags.address || tags['addr:street']),
    tags,
    description: cleanText(tags.description || tags.note),
    phone: cleanText(tags.phone || tags['contact:phone']),
    website: cleanText(tags.website || tags['contact:website'] || tags.url),
    vhf_channel: cleanText(tags.vhf || tags['vhf:channel'] || tags['seamark:harbour:VHF_channel']),
    opening_hours: cleanText(tags.opening_hours),
    entrance_depth_m: parseNumber(tags.depth || tags['seamark:harbour:depth'] || tags['seamark:depth']),
    berth_capacity: parseInteger(tags.berths || tags['capacity:boats'] || tags.capacity),
    fuel_types: extractFuelTypes(tags),
    facilities: extractFacilities(tags),
    price_range: cleanText(tags.fee || tags.charge),
    holding_type: cleanText(tags.holding || tags['seamark:anchorage:category']),
    seabed_type: cleanText(tags.seabed || tags.bottom || tags['seamark:anchorage:seabed']),
    shelter_quality: cleanText(tags.shelter || tags.protection),
    depth_min_m: parseNumber(tags['depth:min'] || tags.min_depth),
    depth_max_m: parseNumber(tags['depth:max'] || tags.max_depth),
    source_updated_at: cleanText(tags.timestamp) ? new Date(tags.timestamp) : null,
  };
}

module.exports = {
  cleanText,
  normalizeName,
  normalizeOSMElement,
  parseNumber,
  splitList,
};

