import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GenerateReferenceInput, ImageGenerationPort } from '../port/image-generation.port';

@Injectable()
export class OpenRouterImageAdapter implements ImageGenerationPort {
  private readonly logger = new Logger(OpenRouterImageAdapter.name);
  private readonly apiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
  }

  async generateReference(input: GenerateReferenceInput): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY 가 설정되지 않아 OpenRouter 이미지를 생성할 수 없습니다.');
    }

    const frontBase64 = input.front.toString('base64');
    const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      {
        type: 'text',
        text: 'Create a clean, friendly fairy tale character reference sheet based on the user face provided.',
      },
      {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${frontBase64}` },
      },
    ];

    if (input.left) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${input.left.toString('base64')}` },
      });
    }

    if (input.right) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${input.right.toString('base64')}` },
      });
    }

    this.logger.log('OpenRouter 이미지 생성 호출 시작 (gemini-3.1-flash-image)...');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nerd-fairytale.local',
        'X-Title': 'My Story Fairy Tale',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-image',
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`OpenRouter 이미지 생성 실패: ${response.status} ${errorText}`);
      throw new Error(`OpenRouter 이미지 생성 실패: ${response.status}`);
    }

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string;
      images?: string[];
    };
  }>;
}

    const data = (await response.json()) as OpenRouterResponse;
    const assistantMessage = data.choices?.[0]?.message?.content;

    // OpenRouter 이미지 응답에서 Base64 데이터 추출 (data:image/...;base64,... 또는 마크다운 형식)
    const base64Match =
      typeof assistantMessage === 'string'
        ? assistantMessage.match(/data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)/)
        : null;

    if (base64Match && base64Match[1]) {
      return Buffer.from(base64Match[1], 'base64');
    }

    // 이미지가 별도 choice format 또는 URL인 경우 처리
    if (data.choices?.[0]?.message?.images?.[0]) {
      const img = data.choices[0].message.images[0];
      const b64 = img.replace(/^data:image\/[a-z]+;base64,/, '');
      return Buffer.from(b64, 'base64');
    }

    throw new Error('OpenRouter 응답에서 이미지 데이터를 추출하지 못했습니다.');
  }
}
