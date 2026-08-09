-- Full re-assignment of every property's "photoUrl" (not just NULL or
-- previously-wrong ones): earlier backfill migrations only ever touched rows
-- matching a specific old value, which meant properties that happened to get
-- assigned the same photo by an earlier cycling pass stayed paired forever.
-- This instead re-derives the whole assignment in one pass so the same photo
-- is never handed to two different properties (as long as the relevant pool
-- has at least as many photos as there are properties of that kind, which
-- holds today: 14 house photos vs. a handful of HOUSE/OTHER properties, 2
-- apartment-building photos vs. a couple of APARTMENT/CONDO/TOWNHOME ones).
--
-- House photos are real, ordinary, non-luxury single-story houses (mostly
-- with a visible attached garage, all no more than ~10 years old-looking) —
-- the kind of place that would actually show up on a HUD-assisted-housing
-- list, not a vacation cabin or an architect showcase. Apartment/condo/
-- townhome properties get one of two real apartment-building exteriors
-- instead, since a single-family house photo doesn't make sense for those.
WITH house_photos(url, idx) AS (
  VALUES
    ('https://images.unsplash.com/photo-1762810981576-1b07f76af9d2?w=800&q=80', 0),
    ('https://images.unsplash.com/photo-1652469281665-0ea785b9f743?w=800&q=80', 1),
    ('https://images.unsplash.com/photo-1592595896616-c37162298647?w=800&q=80', 2),
    ('https://images.unsplash.com/photo-1781645464768-5e3139476122?w=800&q=80', 3),
    ('https://images.unsplash.com/photo-1773427657182-4776c4f5b363?w=800&q=80', 4),
    ('https://images.unsplash.com/photo-1592595896551-12b371d546d5?w=800&q=80', 5),
    ('https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=800&q=80', 6),
    ('https://images.unsplash.com/photo-1783114481815-f3b64b1aa2c0?w=800&q=80', 7),
    ('https://images.unsplash.com/photo-1774655762504-5f3a07999cd7?w=800&q=80', 8),
    ('https://images.unsplash.com/photo-1773427626010-720ec1fab17a?w=800&q=80', 9),
    ('https://images.unsplash.com/photo-1720065609938-ec0e33ffd9ad?w=800&q=80', 10),
    ('https://images.unsplash.com/photo-1773427614314-6bd0b6115a40?w=800&q=80', 11),
    ('https://images.unsplash.com/photo-1783628092605-6fc6fb2a3b8c?w=800&q=80', 12),
    ('https://images.unsplash.com/photo-1715179749124-1596c1ccb3cd?w=800&q=80', 13)
),
house_photo_count AS (
  SELECT count(*) AS n FROM house_photos
),
ranked_houses AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY "createdAt", id) - 1) AS rn
  FROM "Property"
  WHERE "propertyType" NOT IN ('APARTMENT', 'CONDO', 'TOWNHOME')
)
UPDATE "Property" p
SET "photoUrl" = house_photos.url
FROM ranked_houses, house_photos, house_photo_count
WHERE p.id = ranked_houses.id
  AND house_photos.idx = ranked_houses.rn % house_photo_count.n;

WITH apartment_photos(url, idx) AS (
  VALUES
    ('https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&q=80', 0),
    ('https://images.unsplash.com/photo-1567684014761-b65e2e59b9eb?w=800&q=80', 1)
),
apartment_photo_count AS (
  SELECT count(*) AS n FROM apartment_photos
),
ranked_apartments AS (
  SELECT id, (ROW_NUMBER() OVER (ORDER BY "createdAt", id) - 1) AS rn
  FROM "Property"
  WHERE "propertyType" IN ('APARTMENT', 'CONDO', 'TOWNHOME')
)
UPDATE "Property" p
SET "photoUrl" = apartment_photos.url
FROM ranked_apartments, apartment_photos, apartment_photo_count
WHERE p.id = ranked_apartments.id
  AND apartment_photos.idx = ranked_apartments.rn % apartment_photo_count.n;
