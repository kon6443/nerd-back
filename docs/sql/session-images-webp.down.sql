-- 사용자 삽화(session_page_images) WebP 전환 — 롤백
--
-- 실행:  pnpm db:sql docs/sql/session-images-webp.down.sql
--
-- ⭐ 안전한 이유: PNG 원본 13장이 스토리지에 그대로 있다. up.sql 은 키 문자열만 바꿨다.
-- ⚠️ id 목록으로 범위를 좁힌다. 이 목록이 없으면 **원래부터 webp 였던 28건까지** png 로
--    바꿔 버려 그 책들이 통째로 깨진다.

START TRANSACTION;

UPDATE session_page_images
SET image_key = CONCAT(LEFT(image_key, CHAR_LENGTH(image_key) - 5), '.png')
WHERE image_key LIKE '%.webp'
  AND id IN (
  '010e794e-1527-4b27-a8da-5ee1e9b69eb5',
  '262af106-bac3-4832-a9e1-28127db4eebc',
  '344be928-b6d4-4413-b5b3-24442064535d',
  '38dd4e4d-50c2-4d64-b921-6100da7629f7',
  '53ba2ef1-43a9-44d9-a54d-d7d304c6ad30',
  '6e13afcd-174a-4b69-92d6-a7b64999505e',
  '7fdac17a-1102-4c3b-9976-99d543147c25',
  'aad556f3-d0a6-41b5-9557-58d7a8d8d581',
  'ba6ca58a-7bda-4411-a4c1-63daea5822fe',
  'bf9a4ba8-ed1d-492a-a4db-868f54d2c133',
  'c78ad819-a63c-421d-b8de-a52c91906d59',
  'd15448a6-f34a-4120-a1a6-a3d56a8380e9',
  'e184d8b8-c592-4a7c-9686-3c753067e0b3'
  );

COMMIT;

-- png 13 / webp 28 이어야 한다.
SELECT LOWER(SUBSTRING_INDEX(image_key, '.', -1)) AS ext, COUNT(*) AS rows_count
FROM session_page_images WHERE image_key IS NOT NULL AND image_key <> ''
GROUP BY ext ORDER BY ext;
