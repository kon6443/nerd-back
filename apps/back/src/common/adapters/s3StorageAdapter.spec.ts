import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { S3StorageAdapter } from './s3-storage.adapter';

describe('S3StorageAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('공개 표지의 고정 서명 시각은 같은 URL을 만들고 기본 서명은 현재 시각을 쓴다', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-17T13:01:00Z') });
    const values: Record<string, string> = {
      S3_ENDPOINT: 'https://storage.test',
      S3_REGION: 'us-east-1',
      S3_BUCKET_NAME: 'test-bucket',
      S3_ACCESS_KEY_ID: 'test-access-key',
      S3_SECRET_ACCESS_KEY: 'test-secret-key',
    };
    const adapter = new S3StorageAdapter({ get: (key: string) => values[key] } as ConfigService);
    const signingDate = new Date('2026-09-17T13:00:00Z');
    const first = await adapter.getPresignedUrl('covers/book.webp', 3600, signingDate);
    const privateFirst = await adapter.getPresignedUrl('personalizations/page.webp');
    jest.setSystemTime(new Date('2026-09-17T13:04:59Z'));
    const second = await adapter.getPresignedUrl('covers/book.webp', 3600, signingDate);
    const privateSecond = await adapter.getPresignedUrl('personalizations/page.webp');

    expect(second).toBe(first);
    expect(new URL(first).searchParams.get('X-Amz-Date')).toBe('20260917T130000Z');
    expect(new URL(first).searchParams.get('X-Amz-Expires')).toBe('3600');
    expect(privateSecond).not.toBe(privateFirst);
    expect(new URL(privateSecond).searchParams.get('X-Amz-Date')).toBe('20260917T130459Z');
  });

  it('업로드 객체에 private 캐시 정책과 콘텐츠 타입을 지정한다', async () => {
    const send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          S3_REGION: 'ap-northeast-2',
          S3_BUCKET_NAME: 'test-bucket',
          STORAGE_KEY_PREFIX: 'test/',
        };
        return values[key];
      }),
    } as unknown as ConfigService;
    const adapter = new S3StorageAdapter(configService);
    const buffer = Buffer.from('webp-bytes');

    const key = await adapter.upload(
      'personalizations/session-1/page-1.webp',
      buffer,
      'image/webp',
    );

    expect(key).toBe('test/personalizations/session-1/page-1.webp');
    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0];
    const options = send.mock.calls[0][1];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toEqual({
      Bucket: 'test-bucket',
      Key: 'test/personalizations/session-1/page-1.webp',
      Body: buffer,
      ContentType: 'image/webp',
      CacheControl: 'private, max-age=86400, no-transform',
    });
    expect(options).toMatchObject({
      abortSignal: expect.any(AbortSignal),
    });
  });

  it('다운로드 및 삭제 요청에 AbortSignal 타임아웃을 전달한다', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValueOnce({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array([1, 2, 3])),
        },
      } as never)
      .mockResolvedValueOnce({} as never);

    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          S3_REGION: 'ap-northeast-2',
          S3_BUCKET_NAME: 'test-bucket',
        };
        return values[key];
      }),
    } as unknown as ConfigService;
    const adapter = new S3StorageAdapter(configService);

    const downloaded = await adapter.download('test-key');
    expect(downloaded).toEqual(Buffer.from([1, 2, 3]));
    expect(send).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
    );

    await adapter.delete('test-key');
    expect(send).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
    );
  });
});
