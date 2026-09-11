import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  GeneratePageIllustrationInput,
  GenerateReferenceInput,
  ImageGenerationPort,
} from '../port/image-generation.port';

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

/**
 * OpenRouter Unified Image API 어댑터.
 * 공식 이미지 전용 엔드포인트(POST https://openrouter.ai/api/v1/images)와 input_references 를 사용한다.
 */
@Injectable()
export class OpenRouterImageAdapter implements ImageGenerationPort {
  private readonly logger = new Logger(OpenRouterImageAdapter.name);
  private readonly apiKey: string | undefined;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    this.defaultModel =
      this.configService.get<string>('OPENROUTER_IMAGE_MODEL') ||
      'qwen/qwen-image-3';
  }

  /**
   * 사용자 얼굴 사진(1~3장)을 input_references 로 전달하여
   * 동화 주인공 캐릭터 레퍼런스 일러스트 1장을 생성한다.
   */
  async generateReference(input: GenerateReferenceInput): Promise<Buffer> {
    const inputReferences: Array<{ type: string; image_url: { url: string } }> = [
      {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${input.front.toString('base64')}` },
      },
    ];

    if (input.left) {
      inputReferences.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${input.left.toString('base64')}` },
      });
    }

    if (input.right) {
      inputReferences.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${input.right.toString('base64')}` },
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

    const getMime = (buf: Buffer) =>
      buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : 'image/png';

    // 첫 번째 첨부 파일은 프롬프트에서 <base_scene_template> 역할로 명명한다.
    if (input.baseImage) {
      inputReferences.push({
        type: 'image_url',
        image_url: { url: `data:${getMime(input.baseImage)};base64,${input.baseImage.toString('base64')}` },
      });
    }

    // 두 번째 첨부 파일은 프롬프트에서 <protagonist_identity> 역할로 명명한다.
    inputReferences.push({
      type: 'image_url',
      image_url: { url: `data:${getMime(input.referenceImage)};base64,${input.referenceImage.toString('base64')}` },
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

  /** 명시값이 없으면 PNG 템플릿의 실제 비율과 가장 가까운 지원 비율을 사용한다. */
  private resolveAspectRatio(explicitRatio?: string, baseImage?: Buffer): string {
    if (explicitRatio) return explicitRatio;

    const isPng =
      baseImage !== undefined &&
      baseImage.length >= 24 &&
      baseImage.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!isPng) return '4:3';

    const width = baseImage.readUInt32BE(16);
    const height = baseImage.readUInt32BE(20);
    if (width === 0 || height === 0) return '4:3';

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

    const response = await fetch('https://openrouter.ai/api/v1/images', {
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
    });

    const json = (await response.json().catch(() => null)) as OpenRouterImageResponse | null;

    this.logger.log(
      `[OpenRouter 응답] HTTP ${response.status} | 비용: $${json?.usage?.cost ?? 'N/A'} | 이미지 데이터 수신: ${json?.data?.[0]?.b64_json ? '정상 (' + json.data[0].b64_json.length + '자)' : '누락/없음'}`,
    );

    if (!response.ok) {
      if (response.status === 402) {
        this.logger.error('OpenRouter 크레딧 부족 (402)');
        throw new Error(
          'OpenRouter 크레딧이 부족합니다 (402). https://openrouter.ai/settings/credits 에서 크레딧을 충전해 주세요.',
        );
      }
      if (response.status === 429) {
        this.logger.error('OpenRouter 요청 속도 한도 초과 (429)');
        throw new Error('OpenRouter 요청 한도 초과 (429). 잠시 후 다시 시도해 주세요.');
      }
      const errorMsg = json?.error?.message || response.statusText;
      this.logger.error(`OpenRouter 호출 실패 (${response.status}): ${errorMsg}`);
      throw new Error(`OpenRouter 이미지 생성 실패 (${response.status}): ${errorMsg}`);
    }

    const b64Json = json?.data?.[0]?.b64_json;
    if (!b64Json) {
      this.logger.error('OpenRouter 응답 본문에 이미지(b64_json) 데이터가 누락되었습니다.');
      throw new Error('OpenRouter 응답에서 이미지 데이터를 추출하지 못했습니다.');
    }

    const cost = json?.usage?.cost;
    if (cost !== undefined) {
      this.logger.log(`OpenRouter 이미지 생성 성공 (비용: $${cost})`);
    }

    return Buffer.from(b64Json, 'base64');
  }
}
