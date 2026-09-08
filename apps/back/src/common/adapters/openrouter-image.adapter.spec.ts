import { ConfigService } from '@nestjs/config';
import { OpenRouterImageAdapter } from './openrouter-image.adapter';

describe('OpenRouterImageAdapter', () => {
  let configService: ConfigService;
  let adapter: OpenRouterImageAdapter;
  const originalFetch = global.fetch;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENROUTER_API_KEY') return 'test-key';
        if (key === 'OPENROUTER_IMAGE_MODEL') return 'test-model';
        return undefined;
      }),
    } as unknown as ConfigService;

    adapter = new OpenRouterImageAdapter(configService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('API 키가 없으면 에러를 던진다', async () => {
    const noKeyConfig = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const noKeyAdapter = new OpenRouterImageAdapter(noKeyConfig);

    await expect(
      noKeyAdapter.generateReference({ front: Buffer.from('front-bytes') }),
    ).rejects.toThrow('OPENROUTER_API_KEY 가 설정되지 않아');
  });

  it('generateReference: OpenRouter Unified Image API 로 성공적으로 이미지를 생성한다', async () => {
    const mockBase64 = Buffer.from('generated-reference-png').toString('base64');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{ b64_json: mockBase64, media_type: 'image/png' }],
        usage: { cost: 0.035 },
      }),
    });

    const result = await adapter.generateReference({
      front: Buffer.from('front-bytes'),
      left: Buffer.from('left-bytes'),
      right: Buffer.from('right-bytes'),
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/images',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
      }),
    );

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.model).toBe('test-model');
    expect(body.aspect_ratio).toBe('1:1');
    expect(body.input_references).toHaveLength(3);
    expect(result.toString('utf-8')).toBe('generated-reference-png');
  });

  it('generatePageIllustration: 레퍼런스 이미지와 장면 프롬프트로 삽화를 생성한다', async () => {
    const mockBase64 = Buffer.from('generated-page-png').toString('base64');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{ b64_json: mockBase64, media_type: 'image/png' }],
        usage: { cost: 0.035 },
      }),
    });

    const result = await adapter.generatePageIllustration({
      referenceImage: Buffer.from('ref-bytes'),
      prompt: '구름 위에서 빵을 굽는 장면',
      aspectRatio: '4:3',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/images',
      expect.any(Object),
    );

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.model).toBe('test-model');
    expect(body.aspect_ratio).toBe('4:3');
    expect(body.input_references).toHaveLength(1);
    expect(body.prompt).toContain('구름 위에서 빵을 굽는 장면');
    expect(result.toString('utf-8')).toBe('generated-page-png');
  });

  it('402 크레딧 부족 시 명확한 안내 에러를 던진다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: jest.fn().mockResolvedValue({
        error: { message: 'Insufficient credits', code: 402 },
      }),
    });

    await expect(
      adapter.generateReference({ front: Buffer.from('front-bytes') }),
    ).rejects.toThrow('OpenRouter 크레딧이 부족합니다 (402)');
  });

  it('429 한도 초과 시 안내 에러를 던진다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: jest.fn().mockResolvedValue({
        error: { message: 'Rate limit exceeded', code: 429 },
      }),
    });

    await expect(
      adapter.generateReference({ front: Buffer.from('front-bytes') }),
    ).rejects.toThrow('OpenRouter 요청 한도 초과 (429)');
  });

  it('응답 본문에 b64_json 이 없으면 에러를 던진다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{}],
      }),
    });

    await expect(
      adapter.generateReference({ front: Buffer.from('front-bytes') }),
    ).rejects.toThrow('OpenRouter 응답에서 이미지 데이터를 추출하지 못했습니다.');
  });
});
