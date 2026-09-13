import { ConfigService } from '@nestjs/config';
import { StoryChatLlm } from './story-chat.llm';

const RESPONSE = {
  status: 'completed',
  model: 'openai/gpt-5.6-luna',
  output: [
    { type: 'reasoning', summary: [] },
    {
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: ' 지금은 조금 긴장돼. ' }],
    },
  ],
  usage: { input_tokens: 120, output_tokens: 20 },
};

describe('StoryChatLlm', () => {
  const adapter = new StoryChatLlm(
    new ConfigService({
      OPENROUTER_API_KEY: 'test-key',
      OPENROUTER_CHAT_MODEL: 'openai/gpt-5.6-luna',
    }),
  );

  it('Luna·출력 상한·저장 비활성·timeout으로 단발 요청한다', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(RESPONSE)));
    const result = await adapter.complete({
      system: '장면 지시',
      prompt: '기분이 어때?',
      maxOutputTokens: 1000,
    });
    expect(result).toMatchObject({
      text: '지금은 조금 긴장돼.',
      usage: { inputTokens: 120, outputTokens: 20, model: 'openai/gpt-5.6-luna' },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/responses');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(options?.body))).toEqual({
      model: 'openai/gpt-5.6-luna',
      instructions: '장면 지시',
      input: '기분이 어때?',
      max_output_tokens: 300,
      reasoning: { effort: 'none' },
      provider: { allow_fallbacks: false, require_parameters: true },
      store: false,
    });
  });

  it('키가 없으면 네트워크를 호출하지 않는다', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch');
    const unavailable = new StoryChatLlm(new ConfigService());
    expect(unavailable.isAvailable()).toBe(false);
    await expect(unavailable.complete({ prompt: '질문' })).rejects.toThrow('AI 연결 설정');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 429, 500])(
    'HTTP %s 오류에 재시도하거나 provider 본문을 노출하지 않는다',
    async (status) => {
      const fetchMock = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('private provider details', { status }));
      await expect(adapter.complete({ prompt: '질문' })).rejects.toThrow(
        'AI 답변을 받지 못했습니다.',
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    { ...RESPONSE, status: 'incomplete' },
    { ...RESPONSE, output: [] },
    {
      ...RESPONSE,
      output: [
        { type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'private' }] },
      ],
    },
    { private: 'schema failure' },
  ])('불완전·빈 답변·거절·잘못된 응답은 성공으로 표시하지 않는다', async (body) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(adapter.complete({ prompt: '질문' })).rejects.toThrow(
      'AI 답변을 받지 못했습니다.',
    );
  });

  it('네트워크 실패·timeout은 본문 없는 오류로 바꾸고 재시도하지 않는다', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('private network detail'));
    await expect(adapter.complete({ prompt: '질문' })).rejects.toThrow(
      'AI 답변을 받지 못했습니다.',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
