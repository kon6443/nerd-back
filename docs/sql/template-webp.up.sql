-- 템플릿 WebP 전환 — 적용
--
-- 실행:
--   pnpm db:sql docs/sql/template-webp.up.sql
--
-- 되돌리기:
--   pnpm db:sql docs/sql/template-webp.down.sql
--
-- ⚠️ 선행 조건 두 가지. 어기면 잭과 콩나무 삽화 생성이 깨진다.
--   1. 코드가 배포되어 있을 것 (WebP MIME 판별 + 비율 판독). 구버전은 webp 를
--      `image/png` 로 선언하고 aspect_ratio 를 `4:3` 으로 보낸다.
--   2. 스토리지에 `templates/jack-and-beanstalk/page-*.webp` 7개가 있을 것.
--      🚫 `prod/templates/...` 가 아니다 — 앱의 download() 는 접두사를 붙이지 않는다.
--      확인·생성: pnpm back tsx src/scripts/convert-template-images-to-webp.ts --slug jack-and-beanstalk
--
-- 🚫 이 파일 실행 전후로 `pnpm db:seed:stories` 를 돌리지 않는다 (upsert 라 순서가 꼬인다).
--
-- 🚫 story_templates.cover_image_key 는 건드리지 않는다. 운영 DB 의 표지는 시드가 아니라
--    별도 업로드로 들어가 있고(`prod/templates/.../cover-<hash>.webp`) 이미 webp 다.

START TRANSACTION;

UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-1.webp'   WHERE base_image_key = 'templates/jack-and-beanstalk/page-1.png';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-2.webp'   WHERE base_image_key = 'templates/jack-and-beanstalk/page-2.png';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-3.webp'   WHERE base_image_key = 'templates/jack-and-beanstalk/page-3.png';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-4.webp'   WHERE base_image_key = 'templates/jack-and-beanstalk/page-4.png';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-5.webp'   WHERE base_image_key = 'templates/jack-and-beanstalk/page-5.png';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-6-a.webp' WHERE base_image_key = 'templates/jack-and-beanstalk/page-6-a.png';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-6-b.webp' WHERE base_image_key = 'templates/jack-and-beanstalk/page-6-b.png';

COMMIT;

-- 결과 확인 — webp 7 / png 0 이어야 한다.
SELECT SUBSTRING_INDEX(base_image_key, '.', -1) AS ext, COUNT(*) AS rows_count
FROM story_pages
WHERE base_image_key LIKE 'templates/jack-and-beanstalk/page-%'
GROUP BY ext ORDER BY ext;
