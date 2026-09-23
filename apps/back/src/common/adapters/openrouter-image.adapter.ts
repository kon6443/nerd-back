import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTIFICATION_PORT, type NotificationPort } from '../port/notification.port';
import type {
  GeneratePageIllustrationInput,
  GenerateReferenceInput,
  ImageGenerationPort,
} from '../port/image-generation.port';

/**
 * 이미지 생성 요청 타임아웃.
 *
 * ⚠️ 채팅·TTS(각 30초)보다 **의도적으로 길다** — 이미지 한 장에 1분 이상 걸리는 것이 정상이다
 * (`apps/front/lib/api/client.ts` 의 dev 프록시 우회 주석 참조). 30초로 맞추면 정상 요청을 죽인다.
 *
 * 🚫 `STALE_RUNNING_MS`(3분, `story-session.service.ts`) 보다 **확실히 작아야 한다** —
 *    길면 claim 회수가 먼저 돌아 같은 페이지를 두 번 생성한다(유료 호출 2배).
 *    청크(최대 4장)가 순차로 도므로 최악 소요는 `청크 수 × 이 값`이다.
 */
export const IMAGE_GENERATION_TIMEOUT_MS = 120_000;

/**
 * 사용자에게 보여줄 실패 문구.
 *
 * 🚫 provider 가 돌려준 오류 원문을 여기에 담지 않는다 — 이 메시지는
 *    `session_page_images.error_message` 에 저장되어 `GET /sessions/:id/pages` 의
 *    **성공 응답 본문**으로 사용자 브라우저까지 나간다. 전역 필터를 거치지 않으므로
 *    필터 4단의 "내부 정보를 덮는" 방어가 닿지 않는다(`docs/lessons.md` 2026-09-04).
 */
const IMAGE_FAILURE_MESSAGE = '그림을 만들지 못했어요. 잠시 후 다시 시도해 주세요.';

/**
 * 버퍼 앞머리(매직바이트)로 실제 포맷을 판별한다.
 *
 * ⚠️ **확장자나 DB 값이 아니라 바이트를 본다.** 스토리지에 `.png` 로 저장된 것이 실제로는
 * 다른 포맷일 수 있고(변환 폴백·수동 교체), 그때 선언 MIME 이 틀리면 모델이 디코딩에 실패한다.
 *
 * 🚫 `image/jpeg` 로 하드코딩하지 않는다 — 예전에는 그랬고, PNG 를 JPEG 라고 말하며 보내면서도
 *    동작한 것은 **업스트림이 관대했기 때문**이지 보장이 아니었다.
 */
function detectImageMime(buffer: Buffer): string {
  // JPEG: FF D8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  // WebP: 'RIFF' .... 'WEBP'
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return 'image/png';
}

/**
 * 이미지 헤더에서 픽셀 크기를 읽는다. 지원하지 않는 포맷이면 `null`.
 *
 * 🚫 `sharp` 를 부르지 않는다 — 이 경로는 요청마다 도는 동기 계산이고, 크기만 필요하다.
 *    헤더 몇 바이트면 되는 일에 디코더를 띄우지 않는다.
 */
function readImageSize(buffer: Buffer): { width: number; height: number } | null {
  // PNG: 8바이트 시그니처 + IHDR 의 width/height (오프셋 16, 20)
  if (
    buffer.length >= 24 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  // WebP: 'RIFF' .... 'WEBP' + 청크. 세 변종의 크기 위치가 다르다.
  if (
    buffer.length >= 30 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const chunk = buffer.toString('ascii', 12, 16);
    // 무손실(VP8L): 1비트 시그니처 뒤에 14비트씩 (width-1), (height-1)
    if (chunk === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      const width = (bits & 0x3fff) + 1;
      const height = ((bits >> 14) & 0x3fff) + 1;
      return { width, height };
    }
    // 확장(VP8X): 24비트씩 (width-1), (height-1)
    if (chunk === 'VP8X') {
      const width = buffer.readUIntLE(24, 3) + 1;
      const height = buffer.readUIntLE(27, 3) + 1;
      return { width, height };
    }
    // 손실(VP8 ): 키프레임 헤더 뒤 14비트씩
    if (chunk === 'VP8 ') {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    return null;
  }

  return null;
}

/** data URL 로 감싼다. 모델 입력은 전부 이 형태다. */
function toDataUrl(buffer: Buffer): string {
  return `data:${detectImageMime(buffer)};base64,${buffer.toString('base64')}`;
}
const IMAGE_TIMEOUT_MESSAGE = '그림 만들기가 오래 걸려 중단했어요. 다시 시도해 주세요.';

interface OpenRouterImageResponse {
  data?: Array<{
    b64_json?: string;
    media_type?: string;
  }>;
  usage?: {
    cost?: number;
  };
  error?: {
    message?: string;
    code?: number | string;
  };
}

export const MAX_RETRY_COUNT = 2;
export const INITIAL_RETRY_DELAY_MS = 1500;

export interface OpenRouterRetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

/**
 * OpenRouter Unified Image API 어댑터.
 * 공식 이미지 전용 엔드포인트(POST https://openrouter.ai/api/v1/images)와 input_references 를 사용한다.
 */
@Injectable()
export class OpenRouterImageAdapter implements ImageGenerationPort {
  private readonly logger = new Logger(OpenRouterImageAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly defaultModel: string;
  private maxRetries = MAX_RETRY_COUNT;
  private initialDelayMs = INITIAL_RETRY_DELAY_MS;
  private sleepFn: (ms: number) => Promise<void> = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  constructor(
    private readonly configService: ConfigService,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
  ) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    this.defaultModel =
      this.configService.get<string>('OPENROUTER_IMAGE_MODEL') ||
      'qwen/qwen-image-3';
  }

  /**
   * 단위 테스트 등에서 재시도 파라미터를 변경하기 위한 설정 주입 메서드
   */
  setRetryOptions(options: OpenRouterRetryOptions): void {
    if (options.maxRetries !== undefined) this.maxRetries = options.maxRetries;
    if (options.initialDelayMs !== undefined) this.initialDelayMs = options.initialDelayMs;
    if (options.sleepFn) this.sleepFn = options.sleepFn;
  }

  /**
   * 사용자 얼굴 사진(1~3장)을 input_references 로 전달하여
   * 동화 주인공 캐릭터 레퍼런스 일러스트 1장을 생성한다.
   */
  async generateReference(input: GenerateReferenceInput): Promise<Buffer> {
    const inputReferences: Array<{ type: string; image_url: { url: string } }> = [
      {
        type: 'image_url',
        image_url: { url: toDataUrl(input.front) },
      },
    ];

    if (input.left) {
      inputReferences.push({
        type: 'image_url',
        image_url: { url: toDataUrl(input.left) },
      });
    }

    if (input.right) {
      inputReferences.push({
        type: 'image_url',
        image_url: { url: toDataUrl(input.right) },
      });
    }

    const costumeDesc = input.characterPrompt
      ? ` The character is ${input.characterPrompt}.`
      : '';

    const prompt =
      `A delightful children's fairy tale book character sheet. Create a warm, friendly storybook protagonist illustration${costumeDesc} based on the facial features in the reference photo. Clear character design, soft pastel watercolor storybook aesthetic, front-facing view, clean white background.`;

    return this.callImageApi({
      prompt,
      inputReferences,
      aspectRatio: '1:1',
      actionName: '주인공 캐릭터 레퍼런스 생성',
    });
  }

  /**
   * 캐릭터 레퍼런스 이미지와 페이지별 장면 프롬프트를 합성하여
   * 동화 본문 페이지 삽화를 생성한다.
   * 템플릿 기본 삽화(baseImage)가 제공되면 구도와 배경 참조용으로 함께 주입한다.
   */
  async generatePageIllustration(input: GeneratePageIllustrationInput): Promise<Buffer> {
    const inputReferences: Array<{ type: string; image_url: { url: string } }> = [];

    // 첫 번째 첨부 파일은 프롬프트에서 <base_scene_template> 역할로 명명한다.
    if (input.baseImage) {
      inputReferences.push({
        type: 'image_url',
        image_url: { url: toDataUrl(input.baseImage) },
      });
    }

    // 두 번째 첨부 파일은 프롬프트에서 <protagonist_identity> 역할로 명명한다.
    inputReferences.push({
      type: 'image_url',
      image_url: { url: toDataUrl(input.referenceImage) },
    });

    const hasNamedInputRoles =
      input.prompt.includes('<base_scene_template>') &&
      input.prompt.includes('<protagonist_identity>');

    let prompt: string;
    if (
      hasNamedInputRoles ||
      input.prompt.includes('IMAGE EDITING') ||
      input.prompt.includes('Input image 1')
    ) {
      // 1. 두 입력의 역할을 이름으로 구분했거나 명시적인 편집 지시문이면 그대로 사용한다.
      // 역할 태그가 있는 프롬프트를 다시 감싸면 상충한 지시가 생겨 인물 정체성이 약해진다.
      prompt = input.prompt;
    } else if (
      input.prompt.includes('첫 번째 이미지') ||
      input.prompt.includes('두 번째 이미지')
    ) {
      // 2. 레거시 '첫 번째 이미지/두 번째 이미지' 프롬프트가 들어온 경우 모델이 인식할 수 있는 XML 태그 변수로 자동 정규화
      prompt = input.prompt
        .replace(/첫\s*번째\s*이미지/g, '<base_scene_template>')
        .replace(/두\s*번째\s*이미지/g, '<protagonist_identity>');
    } else if (input.baseImage) {
      // 2. 템플릿 삽화(baseImage)가 제공된 경우: Gemini 공식 권장 XML 태그 기반 이미지 합성·치환 지시문 생성
      // 사용자 얼굴은 실제 사진(photo) 또는 사전 생성된 캐릭터 일러스트 시트(character sheet) 모두 유연하게 인식
      const costumeRequirement = input.characterPrompt
        ? `4. COSTUME REQUIREMENT: The main protagonist MUST wear ${input.characterPrompt}.`
        : '4. COSTUME REQUIREMENT: The main protagonist MUST wear the exact costume and clothing illustrated in <base_scene_template>.';

      prompt = [
        '<task_specification>',
        '<context>',
        "You are an expert children's fairy tale book illustrator. Your task is to compose a personalized storybook scene by integrating the protagonist's identity into an existing scene template.",
        '</context>',
        '',
        '<inputs>',
        '  <base_scene_template>',
        "    Attached Image 1 (first image): The complete storybook illustration template defining the background scenery, composition, lighting, artistic watercolor style, and the character's clothing.",
        '  </base_scene_template>',
        '  <protagonist_identity>',
        "    Attached Image 2 (second image): The facial identity and character reference for the protagonist. (This reference may be provided as either a real human portrait photo or a pre-designed fairy tale character illustration sheet). Extract and use the protagonist's unique facial features, eye shape, nose, expression, and hairstyle from this image.",
        '  </protagonist_identity>',
        '</inputs>',
        '',
        '<instructions>',
        '1. CANVAS & BACKGROUND: Use <base_scene_template> as the exact base canvas. PRESERVE 100% of the background environment, scenery layout, and whimsical watercolor art style from <base_scene_template>.',
        "2. FACE REPLACEMENT: Locate the main protagonist in <base_scene_template>. Replace ONLY the protagonist's face and hair with the facial identity and features from <protagonist_identity>.",
        '3. SEAMLESS BLENDING: Seamlessly adapt and paint the face from <protagonist_identity> to match the hand-drawn pastel watercolor storybook aesthetic, lighting, and soft skin tone of <base_scene_template>.',
        costumeRequirement,
        '</instructions>',
        '',
        '<scene_story>',
        input.prompt,
        '</scene_story>',
        '</task_specification>',
      ].join('\n');
    } else {
      // 3. 템플릿 삽화가 없는 경우: 단일 레퍼런스 기반 신규 장면 생성(T2I)
      const style = input.style || 'gentle warm watercolor fairy tale storybook illustration';
      const costumeInstruction = input.characterPrompt
        ? `The main protagonist MUST wear ${input.characterPrompt}.`
        : "Featuring the protagonist character from the reference image, preserving the character's facial features and cheerful expression.";

      prompt = `A full scene illustration for a children's storybook. Scene: ${input.prompt}. Style: ${style}. ${costumeInstruction} Rich atmospheric lighting, whimsical storybook detail, consistent character appearance across scenes.`;
    }

    return this.callImageApi({
      prompt,
      inputReferences,
      aspectRatio: this.resolveAspectRatio(input.aspectRatio, input.baseImage),
      actionName: '동화 페이지 삽화 생성',
    });
  }

  /**
   * 명시값이 없으면 템플릿의 실제 비율과 가장 가까운 지원 비율을 사용한다.
   *
   * ⚠️ **포맷 판별이 곧 비율 판별이다.** 예전에는 PNG 헤더만 읽고 그 외에는 `'4:3'` 을
   * 돌려줬다. 템플릿을 WebP 로 바꾸자 세로 템플릿(1024x1536 = 2:3)이 **가로 4:3 으로
   * 요청되는** 상태가 됐다 — 픽셀은 같아도 **결과 삽화의 비율이 달라진다.**
   * 포맷을 넓힐 때는 이 함수를 반드시 함께 본다.
   */
  private resolveAspectRatio(explicitRatio?: string, baseImage?: Buffer): string {
    if (explicitRatio) return explicitRatio;
    if (!baseImage) return '4:3';

    const size = readImageSize(baseImage);
    if (!size) return '4:3';
    const { width, height } = size;

    const supportedRatios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'];
    const imageRatio = width / height;

    return supportedRatios.reduce((closest, candidate) => {
      const [candidateWidth, candidateHeight] = candidate.split(':').map(Number);
      const [closestWidth, closestHeight] = closest.split(':').map(Number);
      const candidateDistance = Math.abs(candidateWidth / candidateHeight - imageRatio);
      const closestDistance = Math.abs(closestWidth / closestHeight - imageRatio);
      return candidateDistance < closestDistance ? candidate : closest;
    });
  }

  /**
   * OpenRouter Unified Image API 공통 호출 메서드
   */
  private async callImageApi(params: {
    prompt: string;
    inputReferences: Array<{ type: string; image_url: { url: string } }>;
    aspectRatio: string;
    actionName: string;
  }): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error(
        'OPENROUTER_API_KEY 가 설정되지 않아 OpenRouter 이미지를 생성할 수 없습니다.',
      );
    }

    // 🚫 프롬프트 원문을 남기지 않는다 — 외부 API 요청·응답 **본문** 로깅 금지(루트 CLAUDE.md).
    //    공유 로그 스택의 인제스트 한도가 낮아, 본문 대신 길이만 남긴다.
    //    응답 로그(아래)가 이미 비용·길이만 남기는 것과 형식을 맞췄다.
    this.logger.log(
      `[OpenRouter 요청] ${params.actionName} | 모델: ${this.defaultModel} | 레퍼런스 이미지: ${params.inputReferences.length}장 | 프롬프트 ${params.prompt.length}자`,
    );

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        this.logger.warn(
          `[OpenRouter 재시도] ${params.actionName} (${attempt}/${this.maxRetries})`,
        );
      }

      // ⚠️ `signal` 이 없으면 업스트림이 매달릴 때 이 await 가 풀리지 않는다. 호출측은
      //    `await Promise.all(chunk)` 이라 **한 장 때문에 남은 청크와 완료 판정이 통째로 멈춘다.**
      let response: Response;
      try {
        response = await fetch('https://openrouter.ai/api/v1/images', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://nerd-fairytale.local',
            'X-Title': 'My Story Fairy Tale',
          },
          body: JSON.stringify({
            model: this.defaultModel,
            prompt: params.prompt,
            input_references: params.inputReferences,
            aspect_ratio: params.aspectRatio,
            output_format: 'png',
          }),
          signal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
        });
      } catch (error: unknown) {
        // `AbortSignal.timeout` 은 `TimeoutError`(DOMException) 를, 연결 실패는 `TypeError` 를 던진다.
        const isTimeout = error instanceof Error && error.name === 'TimeoutError';
        if (isTimeout) {
          this.logger.error(
            `[OpenRouter 요청 실패] ${params.actionName} | 타임아웃 ${IMAGE_GENERATION_TIMEOUT_MS}ms`,
          );
          // 120초 타임아웃은 추가 재시도 시 세션 락(3분)을 초과하므로 재시도 없이 즉시 중단
          throw new Error(IMAGE_TIMEOUT_MESSAGE);
        }

        // 일시적 연결 실패 시 재시도
        if (attempt < this.maxRetries) {
          const delayMs = this.initialDelayMs * Math.pow(2, attempt);
          this.logger.warn(
            `[OpenRouter 연결 실패] ${params.actionName} — ${delayMs}ms 후 재시도 (${attempt + 1}/${this.maxRetries})`,
          );
          await this.sleepFn(delayMs);
          continue;
        }

        this.logger.error(`[OpenRouter 요청 실패] ${params.actionName} | 연결 실패`);
        throw new Error(IMAGE_FAILURE_MESSAGE);
      }

      const json = (await response.json().catch(() => null)) as OpenRouterImageResponse | null;

      this.logger.log(
        `[OpenRouter 응답] HTTP ${response.status} | 비용: $${json?.usage?.cost ?? 'N/A'} | 이미지 데이터 수신: ${json?.data?.[0]?.b64_json ? '정상 (' + json.data[0].b64_json.length + '자)' : '누락/없음'}`,
      );

      if (!response.ok) {
        // 402, 403 처럼 사람의 개입/설정이 필요한 영구적 에러는 재시도하지 않는다
        if (response.status === 402) {
          this.logger.error('OpenRouter 크레딧 부족 (402) — 크레딧 충전이 필요하다');
          this.notifications.notify({
            severity: 'critical',
            title: 'OpenRouter 크레딧 부족',
            summary:
              '이미지 생성이 전면 중단됩니다. 크레딧을 충전해야 복구됩니다 — 자동 복구되지 않습니다.',
            context: { 상태코드: response.status, 작업: params.actionName },
            dedupeKey: 'openrouter:credit-exhausted',
            dedupeTtlSeconds: 3600,
          });
          throw new Error(IMAGE_FAILURE_MESSAGE);
        }

        if (response.status === 403) {
          this.logger.error('OpenRouter 이미지 접근 거부 (403) — 키·워크스페이스 가드레일을 확인해야 한다');
          this.notifications.notify({
            severity: 'warning',
            title: 'OpenRouter 이미지 접근 거부',
            summary:
              '이미지 생성 요청이 403으로 거부됐습니다. API 키·워크스페이스의 모델/공급자 제한과 가드레일을 확인하세요.',
            context: { 상태코드: response.status, 작업: params.actionName },
            dedupeKey: 'openrouter:image-access-denied',
            dedupeTtlSeconds: 600,
          });
          throw new Error(IMAGE_FAILURE_MESSAGE);
        }

        // 일시적 오류(429 레이트리밋 또는 5xx 서버 일시 과부하) 판별
        const isTransient =
          response.status === 429 ||
          (response.status >= 500 && response.status < 600);

        if (isTransient && attempt < this.maxRetries) {
          let delayMs = this.initialDelayMs * Math.pow(2, attempt);
          const retryAfterHeader = response.headers?.get?.('retry-after');
          if (retryAfterHeader) {
            const parsedSeconds = parseInt(retryAfterHeader, 10);
            if (!Number.isNaN(parsedSeconds) && parsedSeconds > 0 && parsedSeconds <= 10) {
              delayMs = parsedSeconds * 1000;
            }
          }
          this.logger.warn(
            `[OpenRouter 일시적 오류] HTTP ${response.status} — ${delayMs}ms 후 재시도 (${attempt + 1}/${this.maxRetries})`,
          );
          await this.sleepFn(delayMs);
          continue;
        }

        // 재시도 소진 후 최종 실패 처리
        if (response.status === 429) {
          this.logger.error('OpenRouter 요청 속도 한도 초과 (429)');
          this.notifications.notify({
            severity: 'warning',
            title: 'OpenRouter 요청 한도 초과',
            summary: '이미지 생성이 지연되거나 실패합니다. 반복되면 플랜·동시성 조정이 필요합니다.',
            context: { 상태코드: response.status, 작업: params.actionName },
            dedupeKey: 'openrouter:rate-limited',
          });
        } else {
          this.logger.error(`OpenRouter 호출 실패 (${response.status})`);
        }
        throw new Error(IMAGE_FAILURE_MESSAGE);
      }

      const b64Json = json?.data?.[0]?.b64_json;
      if (!b64Json) {
        if (attempt < this.maxRetries) {
          const delayMs = this.initialDelayMs * Math.pow(2, attempt);
          this.logger.warn(
            `[OpenRouter 응답 누락] 이미지 데이터 없음 — ${delayMs}ms 후 재시도 (${attempt + 1}/${this.maxRetries})`,
          );
          await this.sleepFn(delayMs);
          continue;
        }
        this.logger.error('OpenRouter 응답에 이미지(b64_json) 데이터가 누락되었다');
        throw new Error(IMAGE_FAILURE_MESSAGE);
      }

      const cost = json?.usage?.cost;
      if (cost !== undefined) {
        this.logger.log(`OpenRouter 이미지 생성 성공 (비용: $${cost})`);
      }

      return Buffer.from(b64Json, 'base64');
    }

    throw new Error(IMAGE_FAILURE_MESSAGE);
  }
}
