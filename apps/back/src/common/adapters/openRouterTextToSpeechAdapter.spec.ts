import { ConfigService } from '@nestjs/config';
import {
  OPENROUTER_TTS_MAX_INPUT_LENGTH,
  OpenRouterTextToSpeechAdapter,
} from './openRouterTextToSpeechAdapter';

describe('OpenRouterTextToSpeechAdapter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('키가 없으면 비활성이고 외부 요청을 보내지 않는다', async () => {
    const adapter = new OpenRouterTextToSpeechAdapter(new ConfigService());
    const fetchSpy = jest.spyOn(global, 'fetch');

    expect(adapter.isAvailable()).toBe(false);
    await expect(
      adapter.synthesize({ text: '안녕', voiceId: 'Kore', settings: null }),
    ).rejects.toThrow('설정되지');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Gemini 모델은 response_format pcm을 요청하고 PCM을 WAV로 변환한다', async () => {
    const rawPcm = Buffer.from([0, 1, 2, 3]);
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(rawPcm, {
        status: 200,
        headers: {
          'content-type': 'audio/pcm;rate=24000;channels=1',
          'x-generation-id': 'gen-1',
        },
      }),
    );
    const adapter = new OpenRouterTextToSpeechAdapter(
      new ConfigService({
        OPENROUTER_API_KEY: 'secret-key',
        OPENROUTER_TTS_MODEL: 'google/gemini-3.1-flash-tts-preview',
      }),
    );

    const result = await adapter.synthesize({
      text: '숲에서 기다리고 있었어.',
      voiceId: 'Kore',
      settings: { audioTag: '[whispers]' },
    });

    expect(result.mimeType).toBe('audio/wav');
    expect(result.audio.slice(0, 4).toString()).toBe('RIFF');
    expect(result.audio.slice(8, 12).toString()).toBe('WAVE');
    expect(result.usage).toEqual({ generationId: 'gen-1' });

    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe('https://openrouter.ai/api/v1/audio/speech');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer secret-key', 'Content-Type': 'application/json' },
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'google/gemini-3.1-flash-tts-preview',
      input: '[whispers] 숲에서 기다리고 있었어.',
      voice: 'Kore',
      response_format: 'pcm',
    });
  });

  it('비Gemini 모델이 MP3를 반환하면 그대로 MP3로 전달한다', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(Buffer.from('mp3-bytes'), {
        status: 200,
        headers: { 'content-type': 'audio/mpeg', 'x-generation-id': 'gen-2' },
      }),
    );
    const adapter = new OpenRouterTextToSpeechAdapter(
      new ConfigService({
        OPENROUTER_API_KEY: 'secret-key',
        OPENROUTER_TTS_MODEL: 'openai/tts-1',
      }),
    );

    await expect(
      adapter.synthesize({ text: '안녕', voiceId: 'alloy', settings: null }),
    ).resolves.toEqual({
      audio: Buffer.from('mp3-bytes'),
      mimeType: 'audio/mpeg',
      usage: { generationId: 'gen-2' },
    });
    const [, init] = fetchSpy.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      response_format: 'mp3',
    });
  });

  it('임의 설정을 요청 필드로 전달하지 않고 오류 본문은 노출하지 않는다', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('provider-private-body', { status: 429 }),
    );
    const adapter = new OpenRouterTextToSpeechAdapter(
      new ConfigService({ OPENROUTER_API_KEY: 'secret-key' }),
    );

    await expect(
      adapter.synthesize({
        text: '안녕',
        voiceId: 'Kore',
        settings: { instructions: 'unsupported', model: 'override' },
      }),
    ).rejects.not.toThrow('provider-private-body');
  });

  it('빈 입력과 최대 길이 초과를 요청 전에 거절한다', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const adapter = new OpenRouterTextToSpeechAdapter(
      new ConfigService({ OPENROUTER_API_KEY: 'secret-key' }),
    );

    await expect(
      adapter.synthesize({ text: '', voiceId: 'Kore', settings: null }),
    ).rejects.toThrow('입력 길이');
    await expect(
      adapter.synthesize({
        text: '가'.repeat(OPENROUTER_TTS_MAX_INPUT_LENGTH + 1),
        voiceId: 'Kore',
        settings: null,
      }),
    ).rejects.toThrow('입력 길이');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
