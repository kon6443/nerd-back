-- 템플릿 WebP 전환 — 롤백 (up.sql 을 정확히 되돌린다)
--
-- 실행:
--   pnpm db:sql docs/sql/template-webp.down.sql
--
-- 언제 쓰나: 잭과 콩나무 삽화가 이상하게 생성되거나, 모델이 webp 입력을 처리하지 못할 때.
--
-- ⭐ 안전한 이유: PNG 원본 7장이 스토리지에 **그대로** 있다. up.sql 은 키 문자열만 바꿨고
--    객체를 지우거나 덮어쓰지 않았다. 되돌리면 전환 전과 바이트 단위로 같은 상태가 된다.
--    (webp 객체도 남지만 아무도 참조하지 않으므로 무해하다.)

START TRANSACTION;

UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-1.png'   WHERE base_image_key = 'templates/jack-and-beanstalk/page-1.webp';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-2.png'   WHERE base_image_key = 'templates/jack-and-beanstalk/page-2.webp';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-3.png'   WHERE base_image_key = 'templates/jack-and-beanstalk/page-3.webp';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-4.png'   WHERE base_image_key = 'templates/jack-and-beanstalk/page-4.webp';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-5.png'   WHERE base_image_key = 'templates/jack-and-beanstalk/page-5.webp';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-6-a.png' WHERE base_image_key = 'templates/jack-and-beanstalk/page-6-a.webp';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-6-b.png' WHERE base_image_key = 'templates/jack-and-beanstalk/page-6-b.webp';

COMMIT;

-- 결과 확인 — png 7 / webp 0 이어야 한다.
SELECT SUBSTRING_INDEX(base_image_key, '.', -1) AS ext, COUNT(*) AS rows_count
FROM story_pages
WHERE base_image_key LIKE 'templates/jack-and-beanstalk/page-%'
GROUP BY ext ORDER BY ext;
