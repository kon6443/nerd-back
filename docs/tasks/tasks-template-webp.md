# 템플릿 이미지 PNG → WebP 무손실 전환

> 상태: **코드 완료 · DB 전환 대기** (착수 2026-09-16)
> 발단: 사용자 질문 「이미지가 webp 로 관리되나? 기존 png 도 바꿀 수 있나?」
> 브랜치: `perf/template-webp` — `main`(`600838c`) 에서 분기
> 이 문서가 이 작업의 **SSOT** 다.

---

## 실측으로 확인한 현황

| 대상 | 포맷 | 건수 |
|---|---|---|
| 개인화 삽화 | webp 28 / **png 20** | png 는 전부 09-09~09-11 생성분. webp 도입(09-13, `22f49f3`) 이전 |
| 레퍼런스(얼굴) | jpg 7 / png 1 | webp 변환을 거치지 않는다 |
| 템플릿 기본 삽화 | **png 14** | 2개 템플릿 × 7장 |

🚫 **기존 개인화 PNG 20건은 건드리지 않기로 했다.** 장당 1.5MB 로 잡아도 전체 30MB 이고 webp 로 30% 줄여야 10MB 다. **그 10MB 를 위해 운영 DB 에 쓰기를 하는 것은 수지가 안 맞는다.** 09-11 이전 세션이라 대부분 다시 열리지도 않는다. 정 거슬리면 세션을 지우면 된다(삭제 시 스토리지 객체까지 정리하도록 이미 고쳤다).

## 왜 템플릿만 하는가

템플릿은 **페이지를 만들 때마다 매번 다운로드**되고(캐시 없음), base64 로 인코딩돼 모델 요청 본문에 실린다. 세션 하나당 7회다. 일회성 정리인 개인화 삽화와 성격이 다르다.

---

## 포맷 선택 — 무손실이어야 하는 이유

| 방식 | 크기 | 최대 픽셀차 |
|---|---|---|
| 원본 PNG | 3220KB | — |
| PNG 재압축(순수 무손실) | **4301KB (34% 증가)** | 0 |
| **webp 무손실** | **2215KB (31% 감소)** | **0** |
| webp q92 | 587KB (82% 감소) | 59 |
| webp q85 | 404KB (87% 감소) | 64 |

⚠️ **첫 측정에서 "PNG 재압축 71% 감소"가 나왔는데 그건 무손실이 아니었다.** `sharp` 의 `png({ effort })` 가 팔레트 양자화를 켠다(최대 픽셀차 54). 측정 방법을 의심하지 않았으면 잘못된 근거로 결론을 낼 뻔했다.

**템플릿은 모델 입력이다.** 손실 압축은 결과 삽화에 영향을 줄 수 있고 그 영향은 눈으로 보기 전엔 알 수 없다. 무손실은 디코딩 후 픽셀이 원본과 같아 영향이 **원리적으로** 0 이다. 그래서 87% 대신 31% 를 택했다.

🚫 `convertImageToWebp` 의 기본값(q85)은 그대로 둔다 — **결과 삽화**는 사용자에게 보여주기만 하므로 용량이 더 중요하다. 두 용도의 기준이 다르다.

---

## 작업 내용

- [x] `convertImageToWebp` 에 `{ lossless }` 옵션 추가. 기존 호출부 4곳 무영향(옵셔널)
- [x] 변환 스크립트 신설 — 새 키로만 업로드, **기존 PNG 보존**, DB 는 건드리지 않고 SQL 만 출력
- [x] `jack-and-beanstalk` 7장 변환·업로드 (21MB → 14.7MB, 30% 감소). **7장 전부 원본과 픽셀 단위 일치 실측 확인**
- [x] 시드 파일 키 갱신 (jack 만. `red-riding-hood` 는 png 유지)
- [ ] **DB 전환** — 아래 SQL, 사람이 실행
- [ ] 모델이 webp 를 정상 처리하는지 실제 생성 1회로 확인

---

## 리뷰에서 잡은 결함 3건

### ⭐ 1. webp 템플릿이면 `aspect_ratio` 가 `4:3` 으로 고정된다 (머지 차단급)

`resolveAspectRatio` 가 **PNG 헤더만 파싱**하고 그 외에는 `'4:3'` 을 돌려줬다.

```ts
if (!isPng) return '4:3';              // ← webp 는 전부 여기
const width = baseImage.readUInt32BE(16);   // PNG IHDR 직접 파싱
```

템플릿은 **1024×1536 = 2:3(세로)** 이고 호출부 2곳 모두 `aspectRatio` 를 넘기지 않으므로 **항상 이 경로**다. 그대로 배포했다면 잭과 콩나무 삽화가 전부 가로 비율로 생성됐다. `IMAGE_PROVIDER = openrouter` 실측 확인 — **잠복이 아니라 동작 중인 경로**였다.

> 내가 세운 근거("무손실이라 픽셀이 같으니 영향 0")가 **이 경로를 덮지 못했다.** 픽셀 동일성은 포맷 판별에 의존하는 로직과 무관하다.

**조치**: `readImageSize()` 신설 — PNG + WebP **세 변종**(VP8L·VP8·VP8X)의 크기를 읽는다. 변종마다 크기 오프셋이 다르고, 하나라도 못 읽으면 조용히 `4:3` 으로 떨어진다. RGB 손실은 `VP8 `, 무손실은 `VP8L`, **알파나 EXIF 가 붙으면 `VP8X`** 가 된다(실측). 네 케이스를 테스트로 고정했다.

### 2. 표지 갱신 SQL 누락

`cover_image_key` 는 `story_templates` 테이블인데 스크립트가 `story_pages` 만 출력했다. 표지 키가 `page-1` 과 같아 `new Set` 중복 제거로 합쳐진 탓이다. → 표지 UPDATE·롤백문 추가.

### 3. 템플릿 다운로드 실패를 조용히 삼킴

빈 `catch` 2곳. 실패하면 어댑터가 **템플릿 없이 T2I** 로 전혀 다른 그림을 그리는데 상태는 `succeeded` 로 남아 **아무도 모른다.** 키를 옮기는 이번 같은 작업에서 실수가 바로 여기로 떨어진다. → `createLogThrottle` 로 감싼 `warn` 추가.

---

## DB 전환 SQL (사람이 실행)

```sql
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-1.webp' WHERE base_image_key = 'templates/jack-and-beanstalk/page-1.png';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-2.webp' WHERE base_image_key = 'templates/jack-and-beanstalk/page-2.png';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-3.webp' WHERE base_image_key = 'templates/jack-and-beanstalk/page-3.png';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-4.webp' WHERE base_image_key = 'templates/jack-and-beanstalk/page-4.png';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-5.webp' WHERE base_image_key = 'templates/jack-and-beanstalk/page-5.png';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-6-a.webp' WHERE base_image_key = 'templates/jack-and-beanstalk/page-6-a.png';
UPDATE story_pages SET base_image_key = 'templates/jack-and-beanstalk/page-6-b.webp' WHERE base_image_key = 'templates/jack-and-beanstalk/page-6-b.png';
UPDATE story_templates SET cover_image_key = 'templates/jack-and-beanstalk/page-1.webp' WHERE cover_image_key = 'templates/jack-and-beanstalk/page-1.png';
```

되돌리려면 `.webp` ↔ `.png` 를 바꿔 같은 문을 실행한다. **PNG 원본은 스토리지에 그대로 있다.**

## ⚠️ 배포 순서 — 어기면 조용히 깨진다

1. **코드 배포 먼저** (MIME 판별 + 비율 판독). 구버전 코드는 webp 를 `image/png` 로 선언하고 비율을 `4:3` 으로 보낸다
2. 그다음 위 SQL
3. 🚫 **그 사이 `pnpm db:seed:stories` 를 실행하지 않는다** — 시드는 upsert 라 DB 가 webp 로 바뀌는데, 코드가 구버전이면 위 두 문제가 함께 터진다

가장 위험한 순서는 **시드만 먼저 도는 것**이다: DB 는 webp 를 가리키는데 스토리지에 객체가 없으면 다운로드가 실패하고, 예전에는 그것을 조용히 삼켜 **템플릿 없는 그림**이 `succeeded` 로 저장됐다. 결함 3을 고친 이유다.

## 남은 것

- **모델의 webp 디코딩 여부** — 생성 1회 비용이 들어 검증하지 않았다. `red-riding-hood` 는 png 로 남겨 뒀으므로, jack 이 실패해도 다른 동화는 멀쩡하다. 이상하면 DB 키를 `.png` 로 되돌린다
- `red-riding-hood` 전환은 jack 관찰 후 결정
- 개인화 삽화 PNG 20건은 **의도적으로 방치** (위 「현황」 참조)

---

## 진행 로그

- **2026-09-16** 실측으로 현황 파악 → 개인화 PNG 는 방치, 템플릿만 전환하기로 결정
- **2026-09-16** 손실 q85 로 5장을 먼저 올렸다가, 사용자 지적("결과물에 영향 없나")으로 재측정해 **무손실로 전환**. DB 를 안 바꾼 상태라 실사용 영향은 없었다
- **2026-09-16** 리뷰에서 `aspect_ratio` 결함 발견 — 반증 에이전트와 독립적으로 같은 결론. 3건 수정 후 `pnpm back ci:core` 통과 (33 suites / 324 tests)
