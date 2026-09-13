import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { LlmCompletion, LlmCompletionRequest, LlmPort } from '@common/port/llm.port';

export const STORY_CHAT_MAX_OUTPUT_TOKENS = 300;
export const STORY_CHAT_TIMEOUT_MS = 30_000;

const responseSchema = z.object({
  status: z.literal('completed'),
  model: z.string(),
  output: z.array(
    z.object({
      type: z.string(),
      role: z.string().optional(),
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
    }),
  ),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
});

@Injectable()
export class StoryChatLlm implements LlmPort {
  constructor(private readonly config: ConfigService) {}

  isAvailable(): boolean {
    return Boolean(this.config.get<string>('OPENROUTER_API_KEY')?.trim());
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    if (!this.isAvailable()) throw new Error('AI 연결 설정이 없습니다.');
    const startedAt = Date.now();
    try {
      // SDK 의 자동 재시도 없이 정확히 한 번 요청한다. 본문·키·provider 오류를 로그에 남기지 않는다.
      const response = await fetch('https://openrouter.ai/api/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.get<string>('OPENROUTER_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(STORY_CHAT_TIMEOUT_MS),
        body: JSON.stringify({
          model: this.config.get<string>('OPENROUTER_CHAT_MODEL') ?? 'openai/gpt-5.6-luna',
          instructions: request.system,
          input: request.prompt,
          max_output_tokens: Math.min(
            request.maxOutputTokens ?? STORY_CHAT_MAX_OUTPUT_TOKENS,
            STORY_CHAT_MAX_OUTPUT_TOKENS,
          ),
          reasoning: { effort: 'none' },
          provider: { allow_fallbacks: false, require_parameters: true },
          store: false,
        }),
      });
      if (!response.ok) throw new Error('AI 요청이 거절되었습니다.');
      const body = responseSchema.parse(await response.json());
      const text = body.output
        .filter((item) => item.type === 'message' && item.role === 'assistant')
        .flatMap((item) => item.content ?? [])
        .filter((content) => content.type === 'output_text')
        .map((content) => content.text ?? '')
        .join('')
        .trim();
      if (!text) throw new Error('AI 답변이 비어 있습니다.');
      return {
        text,
        usage: {
          inputTokens: body.usage.input_tokens,
          outputTokens: body.usage.output_tokens,
          model: body.model,
          elapsedMs: Date.now() - startedAt,
        },
      };
    } catch {
      // fetch 및 검증 오류에 포함될 수 있는 외부 본문을 경계 밖으로 내보내지 않는다.
      throw new Error('AI 답변을 받지 못했습니다.');
    }
  }
}
