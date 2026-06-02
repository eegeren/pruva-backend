const { cleanText } = require('./marinePOINormalizer');

function fallbackDescriptionFor(poi) {
  const typeName = {
    marina: 'marina',
    anchorage: 'anchorage',
    bay: 'bay',
    fuel_station: 'marine fuel stop',
    service_point: 'marine service point',
    harbor: 'harbor',
    dive_site: 'dive site',
    unknown_marine: 'marine point',
  }[poi.type] || 'marine point';

  const location = [poi.city, poi.region, poi.country].filter(Boolean).join(', ');
  const suffix = location ? ` near ${location}` : '';

  switch (poi.type) {
    case 'marina':
      return `Marine facility${suffix}. Confirm berth availability, depth, services and seasonal operating hours before arrival.`;
    case 'anchorage':
      return `Anchorage area${suffix}. Check updated charts, shelter, holding conditions and latest marine weather before overnight stay.`;
    case 'fuel_station':
      return `Marine fuel point${suffix}. Confirm fuel availability, dock access and opening hours before departure.`;
    case 'service_point':
      return `Marine support location${suffix}. Contact the operator to confirm available maintenance, repair or yard services.`;
    case 'bay':
      return `Coastal bay${suffix}. Review depth, wind exposure and local restrictions before anchoring or swimming.`;
    case 'dive_site':
      return `Dive location${suffix}. Verify local rules, sea state and operator guidance before entering the water.`;
    default:
      return `${typeName.charAt(0).toUpperCase() + typeName.slice(1)}${suffix}. Review live conditions and charts before use.`;
  }
}

function enrichMarinePOI(poi) {
  const next = { ...poi };
  next.description = cleanText(next.description) || fallbackDescriptionFor(next);

  if (!next.facilities && next.type === 'marina') {
    next.facilities = ['berthing', 'marine services'];
  }
  if (!next.facilities && next.type === 'fuel_station') {
    next.facilities = ['fuel dock'];
  }
  if (!next.facilities && next.type === 'service_point') {
    next.facilities = ['marine support'];
  }

  return next;
}

module.exports = { enrichMarinePOI, fallbackDescriptionFor };

