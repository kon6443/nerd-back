import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { S3StorageAdapter } from './s3-storage.adapter';

describe('S3StorageAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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

    const key = await adapter.upload('personalizations/session-1/page-1.webp', buffer, 'image/webp');

    expect(key).toBe('test/personalizations/session-1/page-1.webp');
    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect((command as PutObjectCommand).input).toEqual({
      Bucket: 'test-bucket',
      Key: 'test/personalizations/session-1/page-1.webp',
      Body: buffer,
      ContentType: 'image/webp',
      CacheControl: 'private, max-age=86400, no-transform',
    });
  });
});
