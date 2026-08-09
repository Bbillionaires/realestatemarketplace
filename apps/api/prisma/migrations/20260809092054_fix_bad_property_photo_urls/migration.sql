-- Corrects two problems the previous backfill migration
-- (20260809013451_backfill_property_photo_urls) didn't cover:
--
-- 1. Two of that migration's own 14 curated URLs turned out not to be what
--    they were meant to be: idx 8 was a staged toy/miniature house-with-keys
--    photo, not a real apartment building, and idx 11 was a city skyline, not
--    a building exterior at all. Every property that got assigned either one
--    is repointed to a newly-verified real apartment-building exterior photo.
--
-- 2. Some properties already had a non-NULL "photoUrl" pointing at
--    picsum.photos (a general random-stock-photo placeholder service, not
--    real estate imagery) predating this feature — the previous migration
--    only ever touched NULL rows, so it correctly left these alone, but
--    they're just as wrong (arbitrary photos of e.g. food or animals). These
--    are backfilled the same way: cycle through the (corrected) curated list
--    by creation order.
UPDATE "Property"
SET "photoUrl" = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80'
WHERE "photoUrl" = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80';

UPDATE "Property"
SET "photoUrl" = 'https://images.unsplash.com/photo-1567684014761-b65e2e59b9eb?w=800&q=80'
WHERE "photoUrl" = 'https://images.unsplash.com/photo-1523731407965-2430cd12f5e4?w=800&q=80';

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
    ('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80', 8),
    ('https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&q=80', 9),
    ('https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&q=80', 10),
    ('https://images.unsplash.com/photo-1567684014761-b65e2e59b9eb?w=800&q=80', 11),
    ('https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&q=80', 12),
    ('https://images.unsplash.com/photo-1580216643062-cf460548a66a?w=800&q=80', 13)
),
photo_count AS (
  SELECT count(*) AS n FROM photos
),
ranked AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY "createdAt", id) - 1) AS rn
  FROM "Property"
  WHERE "photoUrl" LIKE 'https://picsum.photos/%'
)
UPDATE "Property" p
SET "photoUrl" = photos.url
FROM ranked, photos, photo_count
WHERE p.id = ranked.id
  AND photos.idx = ranked.rn % photo_count.n;
