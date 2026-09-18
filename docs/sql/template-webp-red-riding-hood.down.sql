-- 빨간 모자 템플릿 WebP 전환 — 롤백
--
-- 실행:  pnpm db:sql docs/sql/template-webp-red-riding-hood.down.sql
--
-- ⭐ 안전한 이유: PNG 원본 7장이 스토리지에 그대로 있다. up.sql 은 키 문자열만 바꿨다.

START TRANSACTION;

UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-1.png'   WHERE base_image_key = 'templates/red-riding-hood/page-1.webp';
UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-2.png'   WHERE base_image_key = 'templates/red-riding-hood/page-2.webp';
UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-3.png'   WHERE base_image_key = 'templates/red-riding-hood/page-3.webp';
UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-4.png'   WHERE base_image_key = 'templates/red-riding-hood/page-4.webp';
UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-5.png'   WHERE base_image_key = 'templates/red-riding-hood/page-5.webp';
UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-6-a.png' WHERE base_image_key = 'templates/red-riding-hood/page-6-a.webp';
UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-6-b.png' WHERE base_image_key = 'templates/red-riding-hood/page-6-b.webp';

COMMIT;

SELECT SUBSTRING_INDEX(base_image_key, '.', -1) AS ext, COUNT(*) AS rows_count
FROM story_pages WHERE base_image_key IS NOT NULL AND base_image_key <> ''
GROUP BY ext ORDER BY ext;
