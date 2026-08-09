-- Data-only backfill: assigns a real house/apartment exterior photo to every
-- property that was created without a photoUrl (mostly properties created
-- through ad-hoc API calls during feature testing, never through the seed
-- script). The home page's flip-card feed otherwise falls back to a generic
-- placeholder icon for these, which reads as "not a real listing."
--
-- Curated by hand (each URL was actually downloaded and viewed before being
-- included here) to be a real exterior photo of a house or apartment
-- building — no interiors, no staged/toy-house shots, no luxury villas with
-- pools, to stay in tone with an affordable-housing marketplace. Cycles
-- through the list by creation order so a long list of properties doesn't
-- exhaust it. Only ever touches rows where "photoUrl" IS NULL — a property
-- created after this migration runs is untouched by it.
WITH photos(url, idx) AS (
  VALUES
    ('https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80', 0),
    ('https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&q=80', 1),
    ('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', 2),
    ('https://images.unsplash.com/photo-1571055107559-3e67626fa8be?w=800&q=80', 3),
    ('https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=800&q=80', 4),
    ('https://images.unsplash.com/photo-1592595896551-12b371d546d5?w=800&q=80', 5),
    ('https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=800&q=80', 6),
    ('https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80', 7),
    ('https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80', 8),
    ('https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&q=80', 9),
    ('https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80', 10),
    ('https://images.unsplash.com/photo-1523731407965-2430cd12f5e4?w=800&q=80', 11),
    ('https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&q=80', 12),
    ('https://images.unsplash.com/photo-1580216643062-cf460548a66a?w=800&q=80', 13)
),
photo_count AS (
  SELECT count(*) AS n FROM photos
),
ranked AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY "createdAt", id) - 1) AS rn
  FROM "Property"
  WHERE "photoUrl" IS NULL
)
UPDATE "Property" p
SET "photoUrl" = photos.url
FROM ranked, photos, photo_count
WHERE p.id = ranked.id
  AND photos.idx = ranked.rn % photo_count.n;
