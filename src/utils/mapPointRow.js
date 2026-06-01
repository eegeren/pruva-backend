function formatFuelTypes(fuelTypes) {
  if (fuelTypes == null) return null;
  if (Array.isArray(fuelTypes)) {
    const items = fuelTypes.map((item) => String(item).trim()).filter(Boolean);
    return items.length ? items.join(', ') : null;
  }
  const text = String(fuelTypes).trim();
  return text || null;
}

function formatAiReviews(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatMapPointRow(row) {
  if (!row) return row;
  return {
    ...row,
    fuel_types: formatFuelTypes(row.fuel_types),
    enriched_at: row.enriched_at ?? null,
    amenities: row.amenities ?? null,
    ai_summary: row.ai_summary ?? null,
    ai_reviews: formatAiReviews(row.ai_reviews),
  };
}

function formatMapPointRows(rows) {
  return rows.map(formatMapPointRow);
}

module.exports = { formatMapPointRow, formatMapPointRows };
