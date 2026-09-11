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

  it('generatePageIllustration: baseImage 가 주어지면 baseImage 가 1번, 레퍼런스가 2번으로 주입되고 레거시 프롬프트는 태그 변수로 자동 치환된다', async () => {
    const mockBase64 = Buffer.from('custom-page-png').toString('base64');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{ b64_json: mockBase64, media_type: 'image/png' }],
        usage: { cost: 0.035 },
      }),
    });

    const customPrompt =
      '첫 번째 이미지는 수정할 동화 삽화이고, 두 번째 이미지는 주인공의 얼굴에 반영할 사용자 얼굴 사진입니다.\n\n표정 지시: 밝은 미소';

    const result = await adapter.generatePageIllustration({
      referenceImage: Buffer.from('user-face-bytes'),
      baseImage: Buffer.from('template-illustration-bytes'),
      prompt: customPrompt,
      aspectRatio: '4:3',
    });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.input_references).toHaveLength(2);
    // 1번: baseImage (동화 삽화)
    expect(body.input_references[0].image_url.url).toContain(
      Buffer.from('template-illustration-bytes').toString('base64'),
    );
    // 2번: referenceImage (사용자 얼굴)
    expect(body.input_references[1].image_url.url).toContain(
      Buffer.from('user-face-bytes').toString('base64'),
    );
    // 레거시 '첫 번째 이미지', '두 번째 이미지' 표현이 모델 인식용 태그 변수로 치환되어 전달됨
    expect(body.prompt).toContain('<base_scene_template>는 수정할 동화 삽화이고');
    expect(body.prompt).toContain('<protagonist_identity>는 주인공의 얼굴에 반영할');
    expect(result.toString('utf-8')).toBe('custom-page-png');
  });

  it('generatePageIllustration: 역할 태그로 구분한 편집 프롬프트는 추가 래핑 없이 전달한다', async () => {
    const mockBase64 = Buffer.from('identity-priority-page-png').toString('base64');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{ b64_json: mockBase64, media_type: 'image/png' }],
      }),
    });

    const customPrompt =
      '<task_specification>\n' +
      '<inputs>\n' +
      '<base_scene_template>The first attached image is the template.</base_scene_template>\n' +
      '<protagonist_identity>The second attached image is the sole identity source.</protagonist_identity>\n' +
      '</inputs>\n' +
      '</task_specification>';

    await adapter.generatePageIllustration({
      referenceImage: Buffer.from('user-face-bytes'),
      baseImage: Buffer.from('template-illustration-bytes'),
      prompt: customPrompt,
    });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.input_references).toHaveLength(2);
    expect(body.prompt).toBe(customPrompt);
    expect(body.prompt).not.toContain('<scene_story>');
  });

  it('generatePageIllustration: baseImage 가 주어지고 일반 본문 텍스트가 오면 명시적인 [IMAGE EDITING & COMPOSITION TASK] 지시문을 자동 생성한다', async () => {
    const mockBase64 = Buffer.from('edited-page-png').toString('base64');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{ b64_json: mockBase64, media_type: 'image/png' }],
        usage: { cost: 0.035 },
      }),
    });

    const result = await adapter.generatePageIllustration({
      referenceImage: Buffer.from('user-face-bytes'),
      baseImage: Buffer.from('template-illustration-bytes'),
      prompt: '빨간 모자가 늑대에게 오두막에 간다고 말했습니다.',
      characterPrompt: 'an iconic vibrant bright red hooded cape',
      aspectRatio: '4:3',
    });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.input_references).toHaveLength(2);
    expect(body.prompt).toContain('<task_specification>');
    expect(body.prompt).toContain('<base_scene_template>');
    expect(body.prompt).toContain('Attached Image 1 (first image)');
    expect(body.prompt).toContain('<protagonist_identity>');
    expect(body.prompt).toContain('Attached Image 2 (second image)');
    expect(body.prompt).toContain('PRESERVE 100% of the background environment');
    expect(body.prompt).toContain("Replace ONLY the protagonist's face and hair");
    expect(body.prompt).toContain('an iconic vibrant bright red hooded cape');
    expect(body.prompt).toContain('<scene_story>\n빨간 모자가 늑대에게 오두막에 간다고 말했습니다.\n</scene_story>');
    expect(result.toString('utf-8')).toBe('edited-page-png');
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
