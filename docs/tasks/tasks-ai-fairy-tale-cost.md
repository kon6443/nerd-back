# AI 동화 MVP — Gemini 비용·구성 결정 기록

- **상태**: 제안 (2026-08-29)
- **범위**: 부모 캐릭터 이미지, 동화 본문, TTS, 아이와의 상호작용에 사용하는 Gemini 모델과 예상 API 비용
- **비목표**: 실제 결제 금액 보장, 환율 예측, Cloud Storage·네트워크·백엔드 인프라 비용, 부모 음성 복제 구현
- **가격 기준일**: 2026-08-29. 모델 가격은 바뀔 수 있으므로 구현 직전에 공식 가격표를 다시 확인한다.

## 결론

Gemini 유료 API만 사용하고 생성 결과를 저장·재사용하는 비용 최적화 MVP는 가족별 최초 동화 생성에 약 **$0.16**이 든다. 1달러를 1,400원으로 가정하면 약 **220원**이다.

권장 구성은 다음과 같다.

| 기능 | 모델 | 호출 전략 |
|---|---|---|
| 동화 본문·상호작용 | `gemini-3.5-flash-lite` | 짧은 context와 제한된 출력으로 실시간 호출 |
| 부모 캐릭터 1장 | `gemini-3.1-flash-lite-image` | 최초 1회 생성 후 고정 배경에 합성 |
| 여러 장면의 캐릭터 일관성 | `gemini-3.1-flash-image` | 페이지마다 새 그림이 꼭 필요한 경우에만 사용 |
| 동화 낭독 | `gemini-2.5-flash-preview-tts` | 전체 동화를 최초 1회 생성해 저장 |
| 아이 음성 인식 | `gemini-3.5-transcribe` | 상호작용 구간에서만 짧게 호출 |

비용을 줄일 때는 이미지 기능을 제거하지 않는다. **부모 캐릭터를 한 번만 생성하고 재사용**하며, 페이지별 이미지 생성과 반복 TTS를 제한한다.

## 제품 가정

가족 한 명이 동화 한 편을 처음 만들고 읽는 흐름을 다음과 같이 가정한다.

| 항목 | 가정 |
|---|---:|
| 부모 캐릭터 | 1K 이미지 1장 |
| 동화 본문 생성 | input 2,000 tokens, output 3,000 tokens |
| 낭독 길이 | 5분 |
| 상호작용 | 10회, 합계 input 10,000 tokens·output 1,000 tokens |
| 아이 음성 입력 | 합계 3분 |
| 재생성 | 없음 |

이미지·전체 낭독 음성은 Object Storage에 저장한다. 같은 동화를 다시 읽을 때는 해당 API를 다시 호출하지 않는다.

## 적용 단가

가격은 [Gemini Developer API 공식 가격표](https://ai.google.dev/gemini-api/docs/pricing)를 기준으로 한다.

| 모델 | 과금 기준 | Standard 단가 |
|---|---|---:|
| `gemini-3.5-flash-lite` | input | $0.30 / 1M tokens |
| `gemini-3.5-flash-lite` | output·thinking | $2.50 / 1M tokens |
| `gemini-3.1-flash-lite-image` | 1K image output | $0.0336 / image |
| `gemini-3.1-flash-image` | 1K image output | $0.067 / image |
| `gemini-2.5-flash-preview-tts` | text input | $0.50 / 1M tokens |
| `gemini-2.5-flash-preview-tts` | audio output | $10.00 / 1M tokens |
| `gemini-3.5-transcribe` | audio input | 약 $0.003 / minute |
| `gemini-3.5-transcribe` | text output | 약 $0.002 / minute |

이미지 편집에는 부모 reference image의 input token 비용이 별도로 붙는다. 아래 계산은 출력 비용을 중심으로 한 예산 추정치이며, 실제 응답의 usage를 기록해 보정해야 한다.

## 가족 1명당 최초 생성 비용

### 부모 캐릭터 이미지

`gemini-3.1-flash-lite-image`로 1K 이미지 한 장을 만든다.

```text
1장 × $0.0336 = $0.0336
```

예산에는 reference image input을 고려해 약 **$0.034**로 반영한다.

### 동화 본문

```text
input:  2,000 × $0.30 / 1,000,000 = $0.0006
output: 3,000 × $2.50 / 1,000,000 = $0.0075
합계:                                  $0.0081
```

### 상호작용 10회

매 요청에 전체 대화 기록을 다시 보내지 않고 현재 장면과 짧은 요약만 전달한다.

```text
input:  10,000 × $0.30 / 1,000,000 = $0.0030
output:  1,000 × $2.50 / 1,000,000 = $0.0025
합계:                                   $0.0055
```

### 5분 TTS

Gemini audio는 초당 약 32 tokens로 계산한다. 자세한 기준은 [Gemini token 계산 문서](https://ai.google.dev/gemini-api/docs/tokens)를 따른다.

```text
5분 × 60초 × 32 tokens = 9,600 audio tokens
9,600 × $10 / 1,000,000 = $0.096
```

입력 텍스트 비용을 포함해 약 **$0.098**로 반영한다.

### 아이 음성 인식 3분

```text
3분 × ($0.003 input + $0.002 output) = $0.015
```

### 합계

| 항목 | 비용 |
|---|---:|
| 부모 캐릭터 1장 | $0.034 |
| 동화 본문 | $0.008 |
| 상호작용 10회 | $0.006 |
| 5분 TTS | $0.098 |
| 음성 인식 3분 | $0.015 |
| **합계** | **약 $0.16** |

## 규모별 예산

환율은 비교 편의를 위해 1달러=1,400원으로 고정 가정한다.

| 신규 가족 수 | 비용 최적화 MVP | 원화 가정 |
|---:|---:|---:|
| 1명 | $0.16 | 약 220원 |
| 100명 | $16 | 약 22,400원 |
| 1,000명 | $160 | 약 224,000원 |
| 10,000명 | $1,600 | 약 2,240,000원 |

이 표는 각 가족이 서로 다른 부모 캐릭터와 음성을 한 번씩 생성한다고 가정한다. 같은 가족이 저장된 동화를 다시 읽는 비용은 포함하지 않는다.

## 구현 방식별 비교

### A. 권장: 캐릭터 1장 생성 후 합성

- 부모 캐릭터 한 장만 생성한다.
- 배경과 장면은 미리 제작한다.
- 캐릭터 위치·크기·표정 효과는 클라이언트 또는 서버에서 합성한다.
- 가족별 최초 비용은 약 **$0.16**이다.

### B. 모든 페이지를 개인화 이미지로 생성

캐릭터 일관성이 필요한 6개 장면을 `gemini-3.1-flash-image`로 생성한다.

```text
이미지: 6장 × $0.067 = $0.402
나머지 본문·TTS·STT·상호작용 ≈ $0.126
합계 ≈ $0.53
```

| 신규 가족 수 | 페이지별 이미지 생성 | 원화 가정 |
|---:|---:|---:|
| 1명 | $0.53 | 약 740원 |
| 100명 | $53 | 약 74,200원 |
| 1,000명 | $530 | 약 742,000원 |

비용뿐 아니라 생성 지연, 실패 재시도, 장면 간 얼굴·의상 불일치가 늘어난다. 해커톤 MVP에서는 선택하지 않는다.

### C. 저장된 동화 재생

이미지와 5분 낭독 음성을 캐시하면 재생 시 해당 비용은 다시 발생하지 않는다. 음성 상호작용만 새로 수행하면 예상 비용은 세션당 약 **$0.03~0.06**이다.

## Free Tier 사용 판단

Gemini Free Tier는 Text와 TTS를 무료로 제공하지만 Image generation은 API Free Tier가 없다. 따라서 통제된 데모에서는 이미지 출력 비용인 약 **$0.034**만 발생할 수 있다.

다만 공식 가격표는 Free Tier 데이터가 Google 제품 개선에 사용될 수 있다고 명시한다. 실제 부모 사진·부모 음성·아이 음성을 처리할 때는 다음 원칙을 적용한다.

- 실제 사용자 데이터에는 Paid Tier를 사용한다.
- 해커톤 Free Tier 데모에는 팀원이 명시적으로 동의한 테스트 데이터만 사용한다.
- 원본 사진과 음성의 저장 기간을 정하고 삭제 기능을 제공한다.
- 얼굴·음성 처리와 사용 목적을 업로드 전에 고지한다.

## 부모 목소리 복제 제약

Gemini TTS는 한국어, 감정, 억양, 속도, 말투 제어를 지원하지만 공식 API는 `prebuilt voice`를 선택하는 방식이다. 자세한 사용 방식은 [Gemini TTS 문서](https://ai.google.dev/gemini-api/docs/speech-generation)를 따른다.

따라서 Gemini만 사용할 때의 범위는 다음과 같다.

- "따뜻한 아빠처럼 읽기": 가능
- "실제 부모와 동일한 목소리로 읽기": 범위 밖

부모 음성 복제가 핵심 요구사항이라면 별도의 voice cloning 공급자를 사용해야 하며, 그 비용은 이 문서의 Gemini 합계에 포함하지 않는다.

## 비용 통제 규칙

1. 부모 캐릭터는 최초 1장만 만들고 재생성은 최대 1회로 제한한다.
2. 이미지·TTS 요청 전에 content hash 기반 캐시를 조회한다.
3. 동화 본문과 전체 낭독 음성은 생성 직후 저장한다.
4. 상호작용 응답은 최대 50~80자로 제한한다.
5. LLM에는 전체 transcript 대신 현재 장면과 짧은 summary만 전달한다.
6. 사용자별 일일 상호작용 횟수와 프로젝트 일일 지출 한도를 둔다.
7. 모든 응답의 token usage, 모델, latency, 예상 비용을 기록한다.
8. API 실패 시 무제한 재시도하지 않고 고정 문구·기본 음성으로 fallback한다.

## 구현 전 검증 항목

- 동일 부모 사진으로 캐릭터 10회를 생성해 얼굴 유사도와 성공률을 확인한다.
- 한국어 동화 5분을 생성해 실제 audio token 수와 비용을 기록한다.
- 상호작용 10회의 평균 input·output tokens가 가정을 넘지 않는지 확인한다.
- 캐시 적용 후 동일 동화 재생에서 Image·TTS 호출이 0회인지 확인한다.
- Paid Tier의 데이터 사용·보관 조건을 다시 확인한다.
- 공식 가격표와 모델의 Preview·Stable 상태를 구현 직전에 재확인한다.

## 참고 자료

- [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini text-to-speech generation](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Gemini token counting](https://ai.google.dev/gemini-api/docs/tokens)
