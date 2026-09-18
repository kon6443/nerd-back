-- 이미지 포맷 현황 확인 (읽기 전용)
--
-- 실행:  pnpm db:sql docs/sql/image-format.check.sql
--
-- 이미지 키를 들고 있는 컬럼은 네 개뿐이다. 전환 작업 전후로 여기만 보면 된다.
-- 🚫 `story_sessions.reference_image_key`(얼굴)는 **의도적으로 전환하지 않는다** —
--    모델이 얼굴을 베끼는 원본이고 대부분 이미 JPEG 다 (`docs/tasks/tasks-template-webp.md`).
--
-- ⚠️ UNION 각 절에서 `GROUP BY` 에 별칭(`ext`)을 쓰지 않는다. 별칭은 첫 절에서만 보이고
--    나머지는 `Unknown column 'ext' in 'group statement'` 로 죽는다 (실측).

SELECT 'story_pages.base_image_key' AS col, LOWER(SUBSTRING_INDEX(base_image_key, '.', -1)) AS ext, COUNT(*) AS rows_count
FROM story_pages WHERE base_image_key IS NOT NULL AND base_image_key <> ''
GROUP BY LOWER(SUBSTRING_INDEX(base_image_key, '.', -1))
UNION ALL
SELECT 'story_templates.cover_image_key', LOWER(SUBSTRING_INDEX(cover_image_key, '.', -1)), COUNT(*)
FROM story_templates WHERE cover_image_key IS NOT NULL AND cover_image_key <> ''
GROUP BY LOWER(SUBSTRING_INDEX(cover_image_key, '.', -1))
UNION ALL
SELECT 'session_page_images.image_key', LOWER(SUBSTRING_INDEX(image_key, '.', -1)), COUNT(*)
FROM session_page_images WHERE image_key IS NOT NULL AND image_key <> ''
GROUP BY LOWER(SUBSTRING_INDEX(image_key, '.', -1))
UNION ALL
SELECT 'story_sessions.reference_image_key', LOWER(SUBSTRING_INDEX(reference_image_key, '.', -1)), COUNT(*)
FROM story_sessions WHERE reference_image_key IS NOT NULL AND reference_image_key <> ''
GROUP BY LOWER(SUBSTRING_INDEX(reference_image_key, '.', -1))
ORDER BY col, ext;

-- 템플릿 쪽별 상세 (잭 7 + 빨간모자 7 = 14행)
SELECT t.slug, p.page_no, p.branch_key, p.base_image_key
FROM story_pages p JOIN story_templates t ON t.id = p.template_id
WHERE p.base_image_key IS NOT NULL AND p.base_image_key <> ''
ORDER BY t.slug, p.page_no, p.branch_key;
