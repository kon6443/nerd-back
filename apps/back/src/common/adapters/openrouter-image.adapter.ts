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
      'bytedance-seed/seedream-5-0-lite';
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

    const prompt =
      "A delightful children's fairy tale book character sheet. Create a warm, friendly storybook protagonist illustration based on the facial features in the reference photo. Clear character design, soft pastel watercolor storybook aesthetic, front-facing view, clean white background.";

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
   */
  async generatePageIllustration(input: GeneratePageIllustrationInput): Promise<Buffer> {
    const inputReferences = [
      {
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${input.referenceImage.toString('base64')}` },
      },
    ];

    const style = input.style || 'gentle warm watercolor fairy tale storybook illustration';
    const prompt = `A full scene illustration for a children's storybook. Scene: ${input.prompt}. Style: ${style}. Featuring the protagonist character from the reference image, preserving the character's facial features and cheerful expression. Rich atmospheric lighting, whimsical storybook detail.`;

    return this.callImageApi({
      prompt,
      inputReferences,
      aspectRatio: input.aspectRatio || '4:3',
      actionName: '동화 페이지 삽화 생성',
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

    this.logger.log(
      `OpenRouter ${params.actionName} 시작 (모델: ${this.defaultModel}, 비율: ${params.aspectRatio})...`,
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
