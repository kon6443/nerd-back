# 동화 낭독·캐릭터 답변 TTS Implementation Plan

**Goal:** 시연·체험 리더에 페이지별 낭독을 추가하고, 캐릭터 답변을 별도 목소리로 생성·저장·재생한다.

**Architecture:** 정적 낭독은 `story_pages`의 오브젝트 키를 서명 URL로 제공한다. 동적 답변은 `TextToSpeechPort`와 OpenRouter Gemini 3.1 Flash TTS 어댑터를 거쳐 생성하며 DB 상태 선점으로 중복 과금을 막는다. 프론트는 리더 범위의 단일 오디오 컨트롤러로 내레이션과 답변 음성을 배타적으로 재생한다.

**Tech Stack:** NestJS 11, TypeORM/MySQL, Next.js 16, React 19, zod contracts, MinIO/S3, OpenRouter Audio Speech API, Gemini 3.1 Flash TTS Preview, Jest, Vitest.

**Spec:** [`docs/tasks/slice-7-tts-spec.md`](../docs/tasks/slice-7-tts-spec.md)

## Goal & Acceptance Criteria

- 첫 사용자 입력 뒤 본편 1~5 및 선택한 6A/6B 낭독이 페이지 이동에 맞춰 재생된다.
- A/B 선택 화면과 사용자 질문은 읽지 않는다.
- 캐릭터 답변 텍스트를 먼저 표시하고, 음성은 생성 완료 후 저장·재사용한다.
- 음성 장애가 책과 텍스트 채팅을 막지 않는다.
- `/grill-me` Q1~Q27의 상태·배치·접근성 결정이 테스트와 수동 QA로 고정된다.

### 비목표

- 문장 하이라이트, seek, 배속, 별도 볼륨, 백그라운드 재생
- 음성 복제, 본문 런타임 TTS, 오디오 포맷 변환
- 새 큐·상태관리 라이브러리 도입

## Existing Patterns / Source of Truth

- 요구사항: `docs/tasks/slice-7-tts-spec.md`
- 분기 모델: `docs/tasks/slice-6-behind-branch-spec.md`
- API 계약: `packages/contracts/src/story.ts`, `story-chat.ts`, `session.ts`
- 저장소: `StoragePort`와 `S3StorageAdapter`
- 외부 AI: Port & Adapter, DB 선점, 외부 요청·응답 본문 로그 금지
- 리더: `BookPager`가 쪽 넘김을, `BookFrame` 조각이 본문 배치를 소유
- 채팅: `useCharacterChat`이 상태를, `CharacterChat`이 내용 UI를 소유
- 충돌 가능성: 기존 `story_page_chats.status`는 LLM 상태이므로 오디오 상태로 재사용하지 않는다.

## Design (Minimal Approach + Key Decisions)

- 정적 낭독은 별도 테이블 없이 `story_pages.narration_audio_key`로 둔다. 6A/6B는 기존 `branch_key` 행으로 구분된다.
- 캐릭터 목소리 설정은 `story_characters`에, 생성 결과는 `story_page_chats`에 둔다.
- `StoryPageView`, `AfterStoryChoice`, `StoryChatExchange`는 키가 아닌 서명 URL을 반환한다.
- LLM 답변 저장 뒤 TTS 상태를 선점하고 백엔드에서 생성을 계속한다. 서버 중단은 만료된 `pending`과 음성 전용 재시도로 복구한다.
- 별도 큐가 없는 대신 강한 내구성을 보장하지 않는다. 현재 범위의 비용 중복 방지와 사용자 재시도는 DB가 보장한다.
- 프론트 오디오 상태는 리더 생명주기에 두며 책을 다시 열면 초기화한다.

## Implementation Steps (Thin Vertical Slices)

### Step 1 — 데이터·계약 기반

- [x] 마이그레이션과 엔티티에 정적 낭독 키, 캐릭터 음성 설정, 답변 음성 키·상태를 추가한다.
- [x] 공유 계약에 낭독 URL과 답변 음성 상태·URL을 추가한다.
- [x] 공식 동화 시드에 이미 업로드된 14개 낭독 키를 연결한다.
- [x] SQL·metadata·시드 정합성 테스트를 추가한다. 실제 DB에는 적용하지 않는다.

**Checkpoint:** 백엔드 build/test에서 스키마·계약이 일치하고 DB 쓰기 명령을 실행하지 않았다.

### Step 2 — 정적 낭독 API

- [x] 본편 페이지 조회가 `narrationAudioUrl`을 발급한다.
- [x] 비하인드 A/B 조회가 각 결과의 `narrationAudioUrl`을 발급한다.
- [x] 오디오 키 누락과 서명 실패가 페이지 응답을 실패시키지 않는 테스트를 추가한다.

**Checkpoint:** 본편 5개와 A/B 두 개의 URL 매핑 및 `null` 폴백이 서비스 테스트에서 확인된다.

### Step 3 — 캐릭터 답변 TTS 백엔드

- [x] `TextToSpeechPort`와 `OpenRouterTextToSpeechAdapter`, `OPENROUTER_TTS_MODEL` 환경변수 검증을 추가한다. 인증은 기존 `OPENROUTER_API_KEY`를 공유한다.
- [x] 답변 완료 뒤 음성을 선점·생성·업로드·저장한다.
- [x] 음성 전용 재시도 API와 최신 상태 조회를 추가한다.
- [x] 동시 요청, 공급자 실패, 업로드 실패, 서버 중단 상태, 완료 음성 재사용을 테스트한다.

**Checkpoint:** 같은 채팅의 TTS 호출은 한 번이며 실패해도 저장된 답변 텍스트가 유지된다.

### Step 4 — 공통 내레이션 UX

- [x] 리더 범위 단일 오디오 컨트롤러와 `NarrationPlayer.tsx`를 추가한다.
- [x] 시연 `BookReader`와 체험 리더 양쪽에 같은 조작·상태 UI를 연결한다.
- [x] 현재/다음 음성 및 5쪽의 A/B 프리로드, 탭 숨김·화면 이탈 정지를 구현한다.
- [x] 최초 입력, 자동재생, 일시정지 의미, 종료 시 쪽 유지, 누락 음성 동작을 컨트롤러·통합 로직 테스트로 검증한다.

**Checkpoint:** 내레이션 하나만 재생되고 페이지·분기 이동 시 Q1~Q12, Q15~Q17, Q24~Q27이 고정된다.

### Step 5 — 캐릭터 답변 음성 UX

- [x] `useCharacterChat`에 오디오 상태 폴링과 음성 전용 재시도를 연결한다.
- [x] `CharacterChat`에 준비·재생·실패 UI를 추가하고 사용자 질문은 읽지 않는다.
- [x] 새 답변만 자동재생하고 저장 답변은 수동재생하는 규칙을 구현한다.
- [x] 채팅 조작 시 내레이션 정지와 전역 배타성을 검증한다.

**Checkpoint:** Q4~Q5, Q13~Q14, Q18~Q23의 새 답변·재방문·실패 흐름이 테스트된다.

### Step 6 — 통합 검증과 운영 준비

- [x] `pnpm ci:core`, 최종 `pnpm ci:all`, `git diff --check`를 수행한다.
- [ ] 1024×768 및 390×844에서 시연·체험·A/B·채팅을 수동 검증한다.
- [x] 운영 환경변수와 캐릭터 voice 설정 누락을 배포 전 게이트로 문서화한다.
- [x] 사용자 승인 아래 DB 마이그레이션을 적용하고 커밋·푸시·PR·배포를 완료한다.
- [ ] 공식 동화 시드 적용 여부와 정적 낭독 MP3 14개 전체 재생을 확인한다.

## Tests / Verification

- [x] Backend: migration/entity, adapter, story service, after-story, chat service/controller tests
- [x] Frontend: audio controller, narration UI, reader integration, chat audio states tests
- [x] Commands: backend·frontend CI 전체 검사와 `git diff --check`
- [ ] Manual: 시연·체험 각각 1→5→선택→6A/6B, 일시정지·탭 전환·느린/실패 음성
- [x] Runtime: 2026-09-15 사용자 확인 기준 공유 DB 마이그레이션 적용 및 실제 OpenRouter TTS 동작 확인

## Risk & Rollback

- **자동재생 차단:** 최초 사용자 입력을 게이트로 사용한다.
- **중복 과금:** DB 조건부 선점과 완료 키 재사용으로 방지한다.
- **서버 재시작:** 오래된 `pending`을 실패로 표시하고 음성만 재시도한다.
- **서명 URL 만료:** 재생 실패 시 최신 페이지/채팅 조회로 URL을 갱신한다.
- **공급자 장애:** 텍스트 우선, 음성만 실패하는 경계로 격리한다.
- **Preview 모델 변경·불안정:** 모델 ID를 환경변수로 고정하고 응답 검증 실패 시 텍스트만 유지한다.
- **롤백:** nullable 컬럼과 nullable 응답 필드로 단계 배포하고, 프론트 연결을 되돌려도 기존 읽기·채팅은 유지한다.

## Verification Story (작업 완료 후 채움)

- 무엇이 어떻게 바뀌었는가: 본편·A/B 정적 낭독 URL, OpenRouter Gemini 캐릭터 답변 TTS 생성·저장·재시도, 두 음원의 배타 재생 UI를 계약부터 리더까지 연결했다.
- 어떻게 동작을 확인했는가: contracts 검사, backend lint·267 unit·66 E2E·build, frontend lint·typecheck·79 tests·stub/health 검사와 Next Webpack production build, `git diff --check`를 통과했다. PR #50 병합과 front/back 배포 성공을 확인했으며, 2026-09-15 사용자 확인으로 공유 DB 마이그레이션과 실제 OpenRouter TTS 동작까지 검증했다. 정적 낭독 14개 전체 및 화면 크기별 수동 QA는 남아 있다.

## Lessons (해당 시)

- 외부 TTS와 브라우저 자동재생에서 재발 가능한 함정을 발견하면 `docs/lessons.md`에 기록한다.
