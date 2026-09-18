-- 사용자 삽화(session_page_images) WebP 전환 — 적용
--
-- 실행:  pnpm db:sql docs/sql/session-images-webp.up.sql
-- 롤백:  pnpm db:sql docs/sql/session-images-webp.down.sql
--
-- ⚠️ 선행 조건: `pnpm sessions:webp` 로 webp 객체를 먼저 올릴 것.
--
-- ⭐ 이쪽은 **손실(q85)** 이다 — 템플릿과 기준이 다르다. 이 이미지는 화면에 보여주기만 하고
--    모델 입력으로 내려받지 않는다(`download()` 호출 전수 확인: 얼굴 참조와 템플릿 둘뿐).
--    실측 13장: 30665KB → 3807KB (88% 감소).
--
-- 🚫 키를 나열하지 않고 **확장자만 치환**한다. 키에 세션 UUID 가 들어 있어 공개 저장소에
--    남기지 않으려는 것이다. 대상은 아래 id 목록으로 고정한다 — 그래야 롤백이 정확해진다
--    (이 행들 말고도 원래부터 webp 인 행이 28건 있어 조건만으로는 구분되지 않는다).

START TRANSACTION;

UPDATE session_page_images
SET image_key = CONCAT(LEFT(image_key, CHAR_LENGTH(image_key) - 4), '.webp')
WHERE image_key LIKE '%.png'
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

-- png 0 / webp 41 이어야 한다.
SELECT LOWER(SUBSTRING_INDEX(image_key, '.', -1)) AS ext, COUNT(*) AS rows_count
FROM session_page_images WHERE image_key IS NOT NULL AND image_key <> ''
GROUP BY ext ORDER BY ext;
