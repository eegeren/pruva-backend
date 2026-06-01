WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        type,
        lower(regexp_replace(trim(name), '\s+', ' ', 'g')),
        round(latitude::numeric, 4),
        round(longitude::numeric, 4)
      ORDER BY created_at DESC, id DESC
    ) AS duplicate_rank
  FROM map_points
)
DELETE FROM map_points
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS map_points_unique_place_idx
ON map_points (
  type,
  lower(regexp_replace(trim(name), '\s+', ' ', 'g')),
  round(latitude::numeric, 4),
  round(longitude::numeric, 4)
);
