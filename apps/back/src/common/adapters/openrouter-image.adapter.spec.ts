import { ConfigService } from '@nestjs/config';
import { OpenRouterImageAdapter } from './openrouter-image.adapter';
import type { NotificationPort } from '../port/notification.port';

describe('OpenRouterImageAdapter', () => {
  let configService: ConfigService;
  let adapter: OpenRouterImageAdapter;
  let notifications: { notify: jest.Mock };
  const originalFetch = global.fetch;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'OPENROUTER_API_KEY') return 'test-key';
        if (key === 'OPENROUTER_IMAGE_MODEL') return 'test-model';
        return undefined;
      }),
    } as unknown as ConfigService;

    notifications = { notify: jest.fn() };
    adapter = new OpenRouterImageAdapter(configService, notifications as NotificationPort);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('API 키가 없으면 에러를 던진다', async () => {
    const noKeyConfig = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const noKeyAdapter = new OpenRouterImageAdapter(noKeyConfig, notifications as NotificationPort);

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

  it('generatePageIllustration: 비율을 생략하면 PNG 템플릿의 세로 비율을 사용한다', async () => {
    const mockBase64 = Buffer.from('portrait-page-png').toString('base64');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{ b64_json: mockBase64, media_type: 'image/png' }],
      }),
    });

    const portraitPng = Buffer.alloc(24);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(portraitPng);
    portraitPng.writeUInt32BE(1024, 16);
    portraitPng.writeUInt32BE(1536, 20);

    await adapter.generatePageIllustration({
      referenceImage: Buffer.from('user-face-bytes'),
      baseImage: portraitPng,
      prompt:
        '<base_scene_template>template</base_scene_template><protagonist_identity>portrait</protagonist_identity>',
    });

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.aspect_ratio).toBe('2:3');
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

  // ⭐ 이 에러 메시지는 `session_page_images.error_message` 에 저장되어
  //    `GET /sessions/:id/pages` 의 **성공 응답 본문**으로 사용자 브라우저까지 나간다.
  //    전역 필터를 거치지 않으므로 필터 4단의 방어가 닿지 않는다 —
  //    그래서 "던진다" 가 아니라 **"원문이 섞이지 않는다"** 를 고정한다.
  it.each([
    ['402 크레딧 부족', 402, 'Insufficient credits'],
    ['429 한도 초과', 429, 'Rate limit exceeded'],
  ])('%s 시 provider 원문을 감춘 사용자 문구로 던진다 ⭐', async (_label, status, providerMsg) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status,
      json: jest.fn().mockResolvedValue({ error: { message: providerMsg, code: status } }),
    });

    // `toMatchObject` 로 **정확 일치**를 요구한다 — `toThrow` 의 부분 일치로는
    // 뒤에 원문이 덧붙어도 통과해 버려 이 테스트의 목적을 놓친다.
    await expect(
      adapter.generateReference({ front: Buffer.from('front-bytes') }),
    ).rejects.toMatchObject({
      message: '그림을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
    });
    // 위 정확 일치가 성립하면 provider 원문(`providerMsg`)과 상태코드(`status`)는
    // 메시지에 들어 있을 수 없다.
  });

  // ⭐ 크레딧 부족은 **사람이 결제하지 않으면 영구히 복구되지 않는** 유일한 실패다.
  //    로그에만 남기면 아무도 모르는 채로 동화가 한 장도 안 만들어진다.
  it('402 면 운영 알림을 보낸다 ⭐', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: jest.fn().mockResolvedValue({ error: { message: 'Insufficient credits' } }),
    });

    await adapter
      .generateReference({ front: Buffer.from('front-bytes') })
      .catch(() => undefined);

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'critical',
        dedupeKey: 'openrouter:credit-exhausted',
      }),
    );
  });

  it('429 면 경고 등급으로 알린다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: jest.fn().mockResolvedValue({ error: { message: 'Rate limited' } }),
    });

    await adapter
      .generateReference({ front: Buffer.from('front-bytes') })
      .catch(() => undefined);

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warning', dedupeKey: 'openrouter:rate-limited' }),
    );
  });

  // ⭐ 알림은 외부 채널로 나간다. provider 원문이 섞이면 응답 본문 유출과 같은 문제가 된다.
  it('알림 본문에 provider 오류 원문을 담지 않는다 ⭐', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: jest.fn().mockResolvedValue({ error: { message: 'Insufficient credits for org-xyz' } }),
    });

    await adapter
      .generateReference({ front: Buffer.from('front-bytes') })
      .catch(() => undefined);

    const sent = JSON.stringify(notifications.notify.mock.calls[0][0]);
    expect(sent).not.toContain('Insufficient credits');
    expect(sent).not.toContain('org-xyz');
  });

  it('성공하면 알림을 보내지 않는다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{ b64_json: Buffer.from('ok').toString('base64') }],
      }),
    });

    await adapter.generateReference({ front: Buffer.from('front-bytes') });

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('응답 본문에 b64_json 이 없으면 사용자 문구로 던진다', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{}],
      }),
    });

    await expect(
      adapter.generateReference({ front: Buffer.from('front-bytes') }),
    ).rejects.toThrow('그림을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
  });

  // ⭐ `signal` 이 없으면 업스트림이 매달릴 때 호출측의 `await Promise.all(chunk)` 가
  //    풀리지 않아 남은 청크와 완료 판정이 통째로 멈춘다. 회귀하면 여기서 깨진다.
  it('요청에 타임아웃 시그널을 붙인다 ⭐', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: [{ b64_json: Buffer.from('ok-png').toString('base64') }],
      }),
    });
    global.fetch = fetchMock;

    await adapter.generateReference({ front: Buffer.from('front-bytes') });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('타임아웃이면 그 사실을 알리는 사용자 문구로 던진다', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    global.fetch = jest.fn().mockRejectedValue(timeoutError);

    await expect(
      adapter.generateReference({ front: Buffer.from('front-bytes') }),
    ).rejects.toThrow('그림 만들기가 오래 걸려 중단했어요. 다시 시도해 주세요.');
  });
});
