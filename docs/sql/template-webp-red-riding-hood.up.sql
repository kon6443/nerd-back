-- 빨간 모자 템플릿 WebP 전환 — 적용
--
-- 실행:  pnpm db:sql docs/sql/template-webp-red-riding-hood.up.sql
-- 롤백:  pnpm db:sql docs/sql/template-webp-red-riding-hood.down.sql
--
-- ⚠️ 선행 조건: 스토리지에 `templates/red-riding-hood/page-*.webp` 7개가 있을 것.
--    `pnpm templates:webp -- --slug red-riding-hood` 로 만든다.
--    🚫 `prod/templates/...` 가 아니다 — 앱의 download() 는 접두사를 붙이지 않는다.
--
-- 템플릿은 **모델 입력**이라 무손실로 변환한다 (픽셀 동일). 잭과 콩나무와 같은 기준이다.
-- 🚫 표지(`story_templates.cover_image_key`)는 건드리지 않는다 — 운영 DB 의 표지는 별도 업로드
--    경로로 들어가 있고 이미 webp 다 (`docs/tasks/tasks-template-webp.md`).

START TRANSACTION;

UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-1.webp'   WHERE base_image_key = 'templates/red-riding-hood/page-1.png';
UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-2.webp'   WHERE base_image_key = 'templates/red-riding-hood/page-2.png';
UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-3.webp'   WHERE base_image_key = 'templates/red-riding-hood/page-3.png';
UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-4.webp'   WHERE base_image_key = 'templates/red-riding-hood/page-4.png';
UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-5.webp'   WHERE base_image_key = 'templates/red-riding-hood/page-5.png';
UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-6-a.webp' WHERE base_image_key = 'templates/red-riding-hood/page-6-a.png';
UPDATE story_pages SET base_image_key = 'templates/red-riding-hood/page-6-b.webp' WHERE base_image_key = 'templates/red-riding-hood/page-6-b.png';

COMMIT;

-- 전체 템플릿이 webp 14 / png 0 이어야 한다 (잭 7 + 빨간모자 7).
SELECT SUBSTRING_INDEX(base_image_key, '.', -1) AS ext, COUNT(*) AS rows_count
FROM story_pages WHERE base_image_key IS NOT NULL AND base_image_key <> ''
GROUP BY ext ORDER BY ext;
