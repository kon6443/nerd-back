# Slice 7: 동화 낭독과 캐릭터 답변 TTS 명세

> 상태: **구현 완료 · 운영 DB 적용 및 수동 QA 전**
> 확정일: 2026-09-14
> TTS 공급자 확정: 2026-09-14 OpenRouter `google/gemini-3.1-flash-tts-preview`
> 입력: 2026-09-14 `/grill-me` Q1~Q27 합의
> 관련 문서: [`tasks-my-story.md`](tasks-my-story.md) D9 · [`slice-6-behind-branch-spec.md`](slice-6-behind-branch-spec.md)

## 확정 가정

1. 웹 브라우저의 책 리더가 대상이며 네이티브 앱과 백그라운드 미디어 앱은 만들지 않는다.
2. 동화 본문 낭독은 팀이 미리 제작한 MP3를 재생한다. 런타임 TTS 비용이 발생하지 않는다.
3. 캐릭터 대화 답변만 OpenRouter의 `google/gemini-3.1-flash-tts-preview`로 동적 생성한다.
4. 개발과 운영은 같은 DB를 사용하므로 AI는 마이그레이션 파일만 작성하고 실행하지 않는다.
5. 오브젝트 스토리지는 현재 `StoragePort`와 MinIO/S3 서명 URL 방식을 유지한다.
6. 본편은 공통 1~5쪽이고, 삽화·음성이 없는 A/B 선택 화면 뒤에 결과 6A 또는 6B가 온다.

## Objective

독자가 화면을 보면서 동화 낭독을 듣고, 캐릭터에게 받은 답변도 그 캐릭터의 목소리로 들을 수 있게 한다. 음성 로딩이나 외부 TTS 장애는 책 읽기와 텍스트 대화를 막지 않아야 하며, 한 번 생성한 답변 음성은 저장해 다시 과금하지 않는다.

### 사용자 시나리오

1. 독자는 첫 쪽에서 `읽어주기`를 눌러 낭독을 시작한다.
2. 이후 쪽을 직접 넘기면 낭독이 자동으로 이어진다.
3. 5쪽 뒤 선택 화면에서는 음성이 멈추고, A/B를 고르면 선택한 6쪽 음성이 이어진다.
4. 캐릭터 채팅을 열거나 조작하면 낭독은 일시정지한다.
5. 새 캐릭터 답변은 텍스트가 먼저 보이고, 준비된 답변 음성이 한 번 자동 재생된다.
6. 저장된 대화를 다시 열면 자동 재생하지 않으며 재생 버튼으로 다시 들을 수 있다.

## 범위

### 포함

- 시연과 체험 리더의 페이지별 정적 낭독
- 본편 1~5쪽 및 비하인드 6A·6B의 총 7개 낭독 파일 연결
- 세션 동안 유지되는 읽어주기 상태와 단일 전역 재생 정책
- 캐릭터별 Gemini 사전 구성 목소리와 발화 스타일 설정
- 캐릭터 답변 음성의 생성 상태, 영구 저장, 조회 및 음성만 재시도
- 접근 가능한 재생 상태와 오류 안내

### 비목표

- A/B 선택 화면 음성
- 사용자 질문 낭독
- 문장별 하이라이트와 타임스탬프
- 진행 막대 드래그, 배속, 별도 음량 조절
- 화면 잠금 및 백그라운드 재생
- 본문 낭독의 런타임 TTS 생성
- WebP와 별개인 오디오 포맷 변환·압축 최적화
- 음성 복제와 사용자 음성 업로드

## UX State Machine

### 동화 낭독

```text
초기(off)
  └─ [읽어주기] → playing
playing
  ├─ [일시정지] → off
  ├─ 다음/이전 쪽 → 새 쪽 자동 재생
  ├─ 채팅 진입·조작 → off
  ├─ 탭 숨김·화면 이탈 → off
  └─ 음성 종료 → ready (쪽은 넘기지 않음)
off
  └─ [재생] → playing + 이후 쪽 자동 재생 활성화
```

- 브라우저 자동재생 제한을 피하기 위해 매 독서 세션의 최초 재생은 사용자의 버튼 입력으로만 시작한다.
- 읽어주기 활성 상태는 메모리에서만 유지하고 책을 다시 열면 `off`로 시작한다.
- 일시정지는 단순히 현재 음원만 멈추는 것이 아니라 이후 쪽 자동재생도 끈다.
- 현재 음성이 끝나도 쪽을 자동으로 넘기지 않는다.
- 한 번에 하나의 음성만 재생한다. 새 재생이 시작되면 기존 낭독이나 캐릭터 음성을 정지한다.
- 음성이 없는 쪽은 읽기를 막지 않고 `이 페이지는 음성이 준비되지 않았어요`를 표시한다. 읽어주기 활성 상태는 유지되어 다음 유효한 쪽에서 자동재생한다.
- 문서가 숨겨지거나 리더에서 이탈하면 즉시 일시정지하고 복귀 시 자동 재개하지 않는다.

### 재생 UI

- 데스크톱: 본문 면 하단, 페이지 번호 위
- 모바일: 본문 바로 아래
- 조작: 재생/일시정지, 처음부터, 비조작형 진행 막대, `현재 시간 / 전체 시간`
- 아이콘에 접근 가능한 이름을 제공하고 상태 문구는 `aria-live="polite"`로 알린다.
- 실제 `<audio>` 요소의 상태를 정본으로 삼고 애니메이션만으로 재생 상태를 표현하지 않는다.

### 프리로드

- 현재 쪽과 다음 쪽 음성만 `preload="metadata"` 또는 동등한 방식으로 준비한다.
- 5쪽에서는 선택 직후 재생을 위해 6A와 6B를 모두 준비한다.
- 선택 화면 진입 시 5쪽 음성은 정지한다.

### 캐릭터 답변 음성

- 답변 텍스트를 먼저 표시하고 `목소리를 준비하고 있어요…` 상태를 보여 준다.
- 새 답변이 현재 화면에서 준비됐을 때만 자동 재생한다.
- 과거에 저장된 답변과 페이지를 떠난 뒤 완성된 답변은 자동 재생하지 않는다.
- 실패하면 텍스트는 유지하고 `음성 다시 만들기`를 제공한다. LLM 답변은 다시 생성하지 않는다.
- 목소리 설정이 없는 캐릭터는 내레이터로 대체하지 않고 텍스트만 제공한다.

## Data Model

DB에는 URL이 아니라 오브젝트 키와 공급자 설정을 저장한다.

### `story_pages`

| 컬럼 | 타입 | 의미 |
|---|---|---|
| `narration_audio_key` | `VARCHAR(512) NULL` | 사전 제작 페이지 낭독 MP3의 오브젝트 키 |

`(template_id, page_no, branch_key)`가 이미 6A와 6B를 별도 행으로 구분하므로 오디오 테이블은 추가하지 않는다.

### `story_characters`

| 컬럼 | 타입 | 의미 |
|---|---|---|
| `tts_voice_id` | `VARCHAR(128) NULL` | Gemini 캐릭터 사전 구성 목소리 ID |
| `tts_settings` | `JSON NULL` | Gemini 인라인 오디오 태그 등 비밀값이 아닌 공급자 음성 설정 |

모델은 캐릭터마다 바꾸지 않고 서버 환경변수 `OPENROUTER_TTS_MODEL`로 고정하며 기본값은 `google/gemini-3.1-flash-tts-preview`다. 기존 OpenRouter 연동과 같은 서버 전용 `OPENROUTER_API_KEY`를 사용한다. API 키와 위 두 필드는 공개 API로 내보내지 않는다.

### `story_page_chats`

| 컬럼 | 타입 | 의미 |
|---|---|---|
| `reply_audio_key` | `VARCHAR(512) NULL` | 생성된 캐릭터 답변 음성 오브젝트 키 |
| `reply_audio_status` | `VARCHAR(16) NOT NULL` | `not_requested`, `pending`, `completed`, `failed` |
| `reply_audio_updated_at` | `DATETIME(3) NULL` | 음성 작업 선점·완료·실패 시각. 오래된 `pending` 회수 기준 |

- LLM 답변과 TTS 상태를 분리한다. 기존 채팅 `status`는 질문·답변 생성 상태만 나타낸다.
- 음성 생성 전 DB 상태를 `pending`으로 선점해 레플리카 간 중복 과금을 막는다.
- 완료된 키는 영구 재사용하며 일반 조회에서 TTS API를 다시 호출하지 않는다.
- 서버 프로세스가 생성 중 종료된 경우 `reply_audio_updated_at`이 제한시간을 넘긴 `pending`은 조회 시 `failed`로 취급해 음성만 재시도할 수 있게 한다. 채팅 생성 시각을 쓰면 오래된 대화의 음성 재시도가 즉시 만료되므로 별도 시각을 둔다.

## Storage Objects

이미 업로드된 정적 파일을 다음 페이지 행에 연결한다.

| 동화 | 1~5쪽 | 6A | 6B |
|---|---|---|---|
| 잭과 콩나무 | `narration/jack-and-beanstalk/page-{1..5}.mp3` | `narration/jack-and-beanstalk/page-6-a.mp3` | `narration/jack-and-beanstalk/page-6-b.mp3` |
| 빨간 모자 | `narration/red-riding-hood/page-{1..5}.mp3` | `narration/red-riding-hood/page-6-a.mp3` | `narration/red-riding-hood/page-6-b.mp3` |

동적 답변 음성은 충돌하지 않는 키를 사용한다.

```text
chat-audio/{sessionId}/{pageId}/{chatId}-{uuid}.mp3
```

업로드 콘텐츠 타입은 `audio/mpeg`이며 클라이언트에는 만료 서명 URL만 제공한다.

## API Contract

### 기존 응답 확장

- `StoryPageView.narrationAudioUrl: string | null`
- `AfterStoryChoice.narrationAudioUrl: string | null`
- `StoryChatExchange.replyAudioUrl: string | null`
- `StoryChatExchange.replyAudioStatus: 'not_requested' | 'pending' | 'completed' | 'failed'`

페이지 응답은 DB 키를 공개하지 않고 조회 시 서명 URL로 변환한다. 오디오 URL 발급 실패도 페이지 전체 실패로 올리지 않고 해당 필드만 `null`로 반환한다.

### 답변 음성 재시도

```http
POST /api/v2/sessions/:sessionId/pages/:pageNo/chat/audio?branchKey=common|a|b
```

- 본인 세션과 기존 채팅의 페이지·분기를 검증한다.
- `failed` 상태의 음성만 다시 생성한다. `pending` 또는 `completed`의 중복 요청은 새 OpenRouter TTS 호출을 만들지 않는다.
- 응답은 최신 `StoryChatView`를 반환한다.
- 답변 본문, persona, 공급자 응답 본문과 음성 데이터는 로그에 남기지 않는다.

### 생성 흐름

```text
LLM 답변 저장(completed)
  → reply_audio_status 선점(pending)
  → 클라이언트에는 답변 텍스트를 반환
  → 백엔드가 OpenRouter TTS 호출을 계속 수행
  → MP3 업로드
  → reply_audio_key + completed 저장
  → 클라이언트 GET 폴링에서 URL 수신
```

별도 큐 의존성은 1차 범위에 넣지 않는다. DB 선점으로 중복 실행을 막고, 프로세스 중단은 `failed` 전환과 명시적 재시도로 복구한다.

## Architecture

외부 음성 공급자는 백엔드 공통 Port 뒤에 둔다.

```ts
export interface TextToSpeechPort {
  isAvailable(): boolean;
  synthesize(input: {
    text: string;
    voiceId: string;
    settings: Record<string, string | number | boolean> | null;
  }): Promise<{ audio: Buffer; mimeType: "audio/mpeg"; usage?: unknown }>;
}
```

- 기본 구현: `OpenRouterTextToSpeechAdapter`
- 테스트 구현: 네트워크를 호출하지 않는 mock
- OpenRouter의 `POST /api/v1/audio/speech`를 사용하고 `model`, `input`, `voice`, `response_format: "mp3"`를 전달한다.
- Gemini 3.1의 발화 제어는 검증된 `tts_settings.audioTag`를 답변 앞에 인라인으로 붙인다. OpenAI 공급자 전용 `instructions`를 최상위 필드로 보내지 않는다.
- 인증은 기존 `OPENROUTER_API_KEY`의 Bearer 토큰을 재사용한다.
- 타임아웃과 최대 입력 길이를 서버 상수로 제한한다.
- OpenRouter 또는 Preview 모델 장애는 채팅 텍스트와 책 리더의 가용성에 전파하지 않는다.

### TTS 공급자 결정

**결정:** 캐릭터 답변 TTS는 OpenRouter의 `google/gemini-3.1-flash-tts-preview`를 사용한다.

**이유:**

- Google AI Studio에서 한국어 음질과 발화 제어를 직접 검증했다.
- 이미지 생성과 캐릭터 채팅에서 이미 사용하는 OpenRouter API 키와 크레딧을 재사용할 수 있다.
- ElevenLabs용 별도 구독과 결제 계정을 추가하지 않아도 된다.
- OpenRouter가 제공하는 OpenAI 호환 음성 엔드포인트 뒤에 두고 Port 경계를 유지하면 추후 공급자 교체 범위가 어댑터로 제한된다.

**비용과 한도:**

- 2026-09-14 기준 입력은 100만 텍스트 토큰당 `$1`, 출력은 100만 오디오 토큰당 `$20`다.
- Gemini 오디오는 초당 25 토큰이므로 출력 비용은 약 `$0.03/분`이다. 10초 답변 7개는 입력 비용을 제외하고 약 `$0.035`다.
- 이 OpenRouter 모델에는 무료 엔드포인트가 없다. Google AI Studio 무료 프로젝트의 `3 RPM / 10K TPM / 10 RPD` 한도는 OpenRouter 호출에 적용되지 않는다.
- OpenRouter 크레딧 구매 수수료와 모델 가격 변경은 추론 비용과 별도로 운영 시 확인한다.

**대안:**

- Google Gemini Developer API 직접 호출: 같은 모델의 무료 등급을 쓸 수 있지만 현재 프로젝트 한도가 하루 10회라 공개 시연에 부족하다.
- ElevenLabs 직접 호출: 검증된 TTS 공급자지만 별도 구독·키·결제가 필요해 이번 범위에서는 제외한다.

**결과:**

- 모델은 Preview이므로 가용성과 응답 형식 변경 가능성을 전제로 한다.
- 과금·지연·실패율을 확인할 수 있게 공급자 응답의 usage와 generation ID만 기록하되 원문과 음성 데이터는 로그에 남기지 않는다.
- 공급자 장애 시 자동으로 다른 목소리나 모델로 바꾸지 않고 텍스트 답변과 `음성 다시 만들기`를 유지한다.

참고: [OpenRouter 모델](https://openrouter.ai/google/gemini-3.1-flash-tts-preview) · [OpenRouter TTS API](https://openrouter.ai/docs/guides/overview/multimodal/tts) · [Gemini 가격](https://ai.google.dev/gemini-api/docs/pricing)

프론트는 재생 배타성을 담당하는 리더 범위의 오디오 컨트롤러를 하나만 두고, `NarrationPlayer`와 `CharacterReplyPlayer`가 그 컨트롤러를 공유한다. 전역 앱 상태나 새 상태관리 의존성은 추가하지 않는다.

## Project Structure

```text
packages/contracts/src/               공개 응답 및 상태 계약
apps/back/src/common/port/            TTS 공급자 독립 인터페이스
apps/back/src/common/adapters/        OpenRouter TTS 어댑터
apps/back/src/entities/               오디오 키·상태·목소리 설정
apps/back/src/modules/story/          페이지 URL과 채팅 음성 생성 API
apps/back/src/migrations/             컬럼 추가 마이그레이션
apps/front/components/story/          공통 내레이션 UI와 재생 제어
apps/front/app/(trial)/stories/...    캐릭터 답변 음성 UI
```

## Commands

```bash
pnpm dev
pnpm back ci:core
pnpm front ci:core
pnpm ci:core
pnpm ci:all
```

마이그레이션 파일은 작성하고 단위 테스트까지만 수행한다. `pnpm db:migrate:*`와 `pnpm db:seed:*`는 공유 운영 DB를 변경하므로 AI가 실행하지 않는다.

## Code Style

- `.tsx`는 PascalCase, `.ts`는 camelCase 파일명을 사용한다.
- 계약 검증은 `@nerd/contracts`의 zod 스키마가 소유한다.
- 외부 API는 Port를 거치고 서비스가 공급자 HTTP 형식을 알지 않는다.
- 타입 억제(`any`, `@ts-ignore`)를 사용하지 않는다.

```ts
const audioStatus: StoryReplyAudioStatus = chat.replyAudioKey ? "completed" : "failed";
```

## Testing Strategy

- 계약: 새 URL과 음성 상태 타입·스키마 검증
- 마이그레이션: SQL과 엔티티 metadata 일치, `down` 대칭 검증
- 어댑터: 요청 URL·인증 헤더·model/input/voice/format 전달, 타임아웃·비정상 응답 검증
- 백엔드 서비스: 선점, 중복 요청 1회, 저장 재사용, 실패 후 TTS만 재시도, 키 비공개 검증
- 프론트 단위: 최초 사용자 입력, 쪽 전환 자동재생, 일시정지 의미, 한 음성 배타성, 숨김 탭 정지, 재방문 비자동재생 검증
- 브라우저 수동: 시연·체험, 데스크톱·모바일, 본편→선택→6A/6B, 새/저장 채팅, 느린 음성·실패 확인

## Boundaries

### Always

- 페이지와 채팅 텍스트를 음성 장애와 독립적으로 표시한다.
- 오브젝트 키는 DB에, 서명 URL은 응답에 둔다.
- TTS 호출 전에 DB 상태를 선점하고 완료 음성을 재사용한다.
- 공급자 요청·응답 본문과 사용자 질문·답변을 로그에 남기지 않는다.
- 구현 후 `pnpm ci:core`, PR 전 `pnpm ci:all`을 수행한다.

### Ask first

- 마이그레이션 실행, 시드 실행, 커밋, 푸시, 배포
- 새 큐 또는 상태관리 의존성 추가
- 음성 공급자와 모델 변경
- 오디오 보존·삭제 정책 변경

### Never

- API 키, voice ID 또는 서명 URL을 저장소 문서·로그에 기록하지 않는다.
- TTS 실패 때문에 본문이나 캐릭터 답변을 실패 처리하지 않는다.
- 완료된 답변을 다시 생성하거나 사용자 질문까지 읽지 않는다.
- 폴링·재시도를 인메모리 공유 상태로 관리하지 않는다.

## Success Criteria

- 시연과 체험에서 첫 사용자 입력 뒤 페이지 낭독이 시작되고, 쪽 전환 규칙 Q1~Q27이 모두 동작한다.
- 본편 1~5와 6A·6B가 올바른 MP3를 재생하며 선택 화면에서는 재생하지 않는다.
- 새 캐릭터 답변 텍스트가 음성보다 먼저 보이고, 완료 시 현재 화면에서만 한 번 자동 재생된다.
- 저장된 답변은 자동 재생하지 않으며 저장된 MP3를 재사용한다.
- 같은 채팅에 동시 요청해도 OpenRouter TTS 호출과 저장 객체가 하나만 생성된다.
- 음성 누락·서명 URL 실패·OpenRouter 장애·탭 이탈에서도 책 읽기와 텍스트 채팅이 정상 동작한다.
- 접근 가능한 이름, 상태 알림, 키보드 조작과 모바일 레이아웃이 검증된다.

## Open Questions

- 구현을 막는 제품 결정은 없다.
- 배포 전 각 등장인물의 Gemini voice ID·settings 값과 `OPENROUTER_TTS_MODEL`을 검증해야 한다.
- 계정·콘텐츠 삭제 정책(D10)이 정해지면 캐릭터 답변 음성 삭제 범위를 함께 갱신한다.
