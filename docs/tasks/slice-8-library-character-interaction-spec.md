# Slice 8: 제작형 서재와 삽화 속 캐릭터 대화 명세

> 상태: **기본 구현 및 피드백 1·2·4·6 반영 완료, 피드백 5 (캐릭터 테두리 시각 고도화) 최우선 진행 예정**
> 확정일: 2026-09-15
> 입력: 사용자 요청 및 2026-09-15 Q1~Q3 확인

## 확정 가정

1. 로그인한 사용자의 완성된 개인화 동화가 있으면 `/library` 카드에 공통 본편 1쪽의 개인화 삽화를 표시한다.
2. 개인화 1쪽이 없거나 준비되지 않았거나 서명 URL 발급에 실패하면 기존 기본 삽화 자리표시를 유지한다. 얼굴 레퍼런스 사진은 표지로 쓰지 않는다.
3. 홈의 로그인 사용자용 `내 얼굴로 만들기`로 시작한 흐름만 제작 모드다. 일반 `동화 체험하기`, 헤더의 `서재`, 직접 URL 진입은 기존 시연 흐름을 유지한다.
4. 제작 모드는 `?mode=create`로 홈 → 서재 → 동화 상세까지만 보존한다. 촬영·생성·읽기 경로에는 전달하지 않는다.
5. 제작 모드의 동화 상세에서는 세션 상태와 관계없이 `시연 동화 읽기`를 표시하지 않는다. 개인화 제작·읽기·이어보기·재시도·초기화 동작은 유지한다.
6. 캐릭터 대화 진입은 개인화 리더의 삽화 위 캐릭터 영역이 담당한다. 마우스 호버, 키보드 포커스, 모바일 터치 모두 지원한다.
7. 캐릭터 영역은 기존의 단순 타원형 광원에서 나아가, 캐릭터 실루엣에 어울리는 은은한 테두리 광선/아우라 시각 효과 고도화를 최우선으로 진행한다.

## Objective

서재에서 사용자가 이미 만든 동화를 즉시 알아보고, 제작 의도로 들어온 사용자가 시연 CTA에 분산되지 않으며, 개인화 리더에서는 그림 속 등장인물을 직접 만지는 듯 대화를 시작하게 한다.

### 사용자 시나리오

1. 로그인 사용자가 서재를 열면 완성된 내 얼굴 동화 카드에 개인화 1쪽 삽화가 나타난다.
2. 홈에서 `내 얼굴로 만들기`를 누르면 제작 모드 서재와 상세가 이어지고 상세에는 시연 읽기 버튼이 없다.
3. 일반 체험 흐름으로 서재에 들어가면 상세의 시연 읽기 버튼은 그대로 보인다.
4. 개인화 동화를 읽다가 대화 가능한 캐릭터에 마우스를 올리거나 키보드로 포커스하면 캐릭터 주변이 빛나고 이름이 나타난다.
5. 캐릭터를 클릭·탭·Enter/Space로 선택하면 해당 캐릭터가 선택된 기존 대화 표면이 열린다.
6. 대화를 닫으면 시작점으로 포커스가 돌아오며, 답변 생성과 음성 폴링은 닫힌 동안에도 유지된다.

## Tech Stack

- Frontend: Next.js 16.3.3 App Router, React 19.2.8, TypeScript, Tailwind CSS 4, Vitest 3
- Backend: NestJS 11.1.9, TypeORM 0.3.31, MySQL, Jest 30
- Shared contract: `@nerd/contracts`
- Existing data: `story_page_characters.hitbox`, `session_page_images.image_key`

## Commands

```bash
pnpm --filter @nerd/contracts build
pnpm --filter nerd-back test -- story-session.service.spec.ts --runInBand
pnpm --filter nerd-back build
pnpm --filter nerd-front test
pnpm --filter nerd-front build
pnpm ci:all
git diff --check
```

DB 스키마 변경은 없으며 마이그레이션·시드 명령을 실행하지 않는다.

## Project Structure

```text
packages/contracts/src/session.ts                 내 세션 썸네일·비하인드 캐릭터 계약
apps/back/src/modules/story-session/              1쪽 썸네일 및 6A/6B 등장인물 응답
apps/front/app/(demo)/library/                    제작 모드 보존과 개인화 카드
apps/front/components/story/                      제작 CTA와 BookPager 정적 오버레이 슬롯
apps/front/app/(trial)/stories/[slug]/read/       캐릭터 hotspot·대화 표면 연결
apps/front/lib/                                   제작 모드와 좌표 변환 순수 로직
```

## API Contract

`GET /api/v2/sessions/my`의 각 항목에 다음 필드를 추가한다.

```ts
interface MyStorySessionItem {
  thumbnailImageUrl: string | null;
}
```

- `completed` 세션의 `(pageNo=1, branchKey=common, status=succeeded)` 이미지만 후보로 삼는다.
- 여러 세션의 1쪽 이미지는 한 번의 DB 조회로 가져오고 세션 ID로 매핑한다.
- 이미지 키 누락과 서명 URL 실패는 `null`로 격리한다.

`AfterStoryChoice`에는 해당 6A/6B 페이지의 안전한 등장인물 정보와 히트박스를 추가한다.

```ts
interface AfterStoryChoice {
  characters: StoryPageCharacter[];
}
```

persona, 음성 설정, 내부 프롬프트는 공개하지 않는다.

## 제작 모드

- 정본 URL은 `/library?mode=create`다.
- `mode` 값이 정확히 `create`일 때만 제작 모드로 판정한다. 배열·다른 값·누락은 일반 모드다.
- 제작 모드의 카드 링크와 상세의 `서재로 돌아가기`는 쿼리를 보존한다.
- 홈의 일반 `동화 체험하기`, 헤더 `서재`, 로그인 기본 이동은 `/library`를 유지한다.
- 상세에서 `StorySessionActions`가 그리는 모든 상태와 로딩 자리표시에서 시연 CTA를 함께 제거해 폭이 뒤늦게 줄지 않게 한다.

## 캐릭터 상호작용

### 구조

`BookPager.renderArt`는 정적 삽화, 직전 삽화, 넘김 종이의 여러 조각에 반복 호출된다. 그 안에는 포커스 가능한 요소를 넣지 않는다. `BookPager`에 정적인 삽화 면에서만 한 번 렌더되는 `renderArtControls` 슬롯을 추가하고, 쪽 넘김 중에는 숨긴다.

`CharacterHotspots`는 다음을 담당한다.

- 히트박스가 있는 현재 장면 캐릭터만 버튼으로 렌더링
- `object-fit: cover`의 실제 확대·크롭을 반영한 좌표 변환
- 캐릭터별 `aria-label="{이름}와 대화하기"`
- 호버·포커스의 타원형 광원과 이름표
- 터치 환경에서 호버 없이도 찾을 수 있는 작은 말풍선 단서
- 최소 44px, 가능한 경우 프로젝트 아동 터치 기준 56px 확보
- reduced-motion에서 맥동과 전환 제거

쪽 넘김 중에는 hotspot을 렌더하지 않아 보이는 그림과 대화 장면이 갈리지 않게 한다. 대화 상태 훅은 기존처럼 리더가 소유해 표면을 닫아도 폴링을 계속한다.

### 시각 방향

새 화면을 만들지 않고 기존 그림책의 종이·마법 톤을 확장한다.

- Feather Green `#58cc02`: 제품의 기존 주 행동
- Macaw Blue `#1cb0f6`: 캐릭터 hotspot의 얇은 내부 광원
- Bee Gold `#ffc800`: 대화 가능 상태의 따뜻한 외곽 빛
- Beetle Purple `#ce82ff`: 키보드 포커스와 마법 반응
- Paper `#fbf7ec`: 이름표 바탕
- Ink `#4b4b4b`: 이름표 텍스트

새 색 리터럴은 컴포넌트에 추가하지 않고 기존 토큰을 사용한다. 기억에 남는 효과는 캐릭터 주변의 한 번의 타원형 광원에만 쓰고, 패널과 조작 바에는 장식을 추가하지 않는다.

```text
┌──────────── 펼친 책 ────────────┐
│  삽화                           │  본문
│       ╭ · · 금빛 광원 · · ╮     │
│       │     캐릭터          │     │
│       ╰─ 이름 · 말풍선 ────╯     │
└─────────────────────────────────┘
          ↓ 클릭·탭·키보드
   기존 대화 sheet / modal / dock
```

정사각 카드·그라데이션 장식을 새로 늘리지 않고, 삽화 자체가 인터랙션의 중심이 되게 한다.

## Code Style

- `.tsx`는 PascalCase, `.ts`는 camelCase 파일명을 사용한다.
- URL 판정과 좌표 계산은 렌더링에서 분리한 순수 함수로 작성한다.
- 공개 응답 형식은 `@nerd/contracts`가 소유한다.
- nullable 데이터는 기존 삽화와 비상호작용 상태로 안전하게 폴백한다.

```ts
const thumbnailImageUrl = imageKey
  ? await getOptionalPresignedUrl(imageKey)
  : null;
```

## Testing Strategy

### Backend

- 완료 세션의 1쪽 공통 성공 이미지가 썸네일 URL로 변환된다.
- 미완료·실패·키 누락·서명 실패는 `null`이고 목록 전체는 성공한다.
- 여러 세션이어도 페이지 이미지 DB 조회는 한 번이다.
- 6A/6B가 각각 자기 페이지의 등장인물과 히트박스를 반환한다.

### Frontend

- `mode=create`만 제작 모드이며 목록·상세·뒤로가기 href가 의도를 보존한다.
- 세션과 동화 slug를 매칭해 완성된 개인화 1쪽만 카드 이미지로 선택한다.
- `cover` 좌표 변환이 정사각·세로형 원본과 다양한 컨테이너에서 크롭 오프셋을 반영한다.
- null 히트박스는 제외하고 캐릭터 클릭 시 역할을 선택한다.
- 넘김 중에는 정적 hotspot이 없고 넘김 종이 조각에 버튼이 복제되지 않는다.

### Manual

- 1024×768 및 390×844에서 두 공식 동화의 본편 1~5와 6A/6B를 확인한다.
- 마우스, Tab+Enter/Space, 터치로 같은 캐릭터가 선택된다.
- 삽화 크롭과 hotspot 위치가 맞고 이름표가 책 밖으로 잘리지 않는다.
- 대화 열기 시 내레이션이 멈추고 닫기·Esc·backdrop 뒤 포커스가 복귀한다.
- 빠른 쪽 넘김, dock 열린 상태의 쪽 이동, 답변 대기·완료·실패·로그인 상태를 확인한다.

## Boundaries

### Always

- 공개 서재는 비로그인 사용자를 위해 서버에서 즉시 렌더한다.
- 로그인 확인 뒤에만 `/sessions/my`를 호출한다.
- 포인터 호버 없이도 캐릭터를 발견하고 사용할 수 있게 한다.
- hotspot은 정적 삽화 면에만 존재하고 쪽 넘김 복제본에는 넣지 않는다.
- 기존 채팅의 1회 질문, 초안, 폴링, 음성 배타성 규칙을 유지한다.

### Ask first

- DB 스키마·새 dependency·새 이미지 분석 파이프라인 추가
- 캐릭터 실루엣 마스크 생성 또는 히트박스 데이터 변경
- 시연 리더에도 캐릭터 채팅 추가
- 배포, 운영 DB 변경, 커밋, 푸시, PR 생성

### Never

- 얼굴 레퍼런스 사진을 동화 썸네일로 표시하지 않는다.
- 오브젝트 키를 브라우저 응답에 노출하지 않는다.
- `aria-hidden` 트리 안에 포커스 가능한 hotspot을 복제하지 않는다.
- hover만으로 대화 가능 여부를 전달하지 않는다.
- 이미지 URL 실패 때문에 서재나 세션 목록 전체를 실패시키지 않는다.

## Success Criteria

- 완성된 내 얼굴 동화가 있는 로그인 사용자는 `/library` 카드에서 개인화 1쪽을 본다.
- 일반 사용자와 썸네일을 준비하지 못한 세션은 기존 서재를 정상적으로 사용한다.
- 홈의 `내 얼굴로 만들기` 흐름에서는 상세의 시연 CTA가 모든 상태에서 보이지 않는다.
- 일반 체험 흐름에서는 시연 CTA가 계속 보인다.
- 개인화 리더의 본편과 6A/6B에서 캐릭터를 그림 위에서 직접 선택해 기존 대화를 연다.
- 하단 `등장인물에게 물어보기` 런처가 없어도 로그인·대기·완료·실패 대화 상태에 다시 진입할 수 있다.
- 키보드·터치·reduced-motion·쪽 넘김에서 접근성과 장면 정합성이 유지된다.

## Open Questions & Known Issues (후속 과제)

- 구현을 막는 제품 결정은 없다.
- 실제 캐릭터 실루엣 윤곽선은 마스크 자산이 생길 때 별도 개선한다.
- **알려진 이슈 (후속 과제 기록)**: 이미 다 만들어진 완성 동화(`status === 'completed'`)를 읽는 중 리더 헤더에 `← 제작 현황 보기` 버튼이 노출되어 클릭 시 `GeneratingView`로 넘어가는 현상.
  - 현재는 `!sessionPages?.isAllCompleted && sessionPages?.status !== 'completed'` 가드로 완료 시 숨김 처리함.
  - 향후 세션 라이프사이클과 리더 상단 네비게이션을 전역 리팩토링할 때 완전한 상태 머신으로 통합 정리 예정.
