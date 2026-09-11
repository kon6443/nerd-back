import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StoragePort } from '../port/storage.port';

@Injectable()
export class S3StorageAdapter implements StoragePort {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly keyPrefix: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');

    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME') || 'nerd-storage';
    this.keyPrefix = this.configService.get<string>('STORAGE_KEY_PREFIX') || 'dev/';

    this.s3Client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: true, // MinIO 호환성 필수
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const fullKey = `${this.keyPrefix}${key.replace(/^\/+/, '')}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fullKey,
        Body: buffer,
        ContentType: mimeType,
        CacheControl: 'private, max-age=86400, no-transform',
      }),
    );

    this.logger.log(`S3 객체 업로드 완료: ${fullKey}`);
    return fullKey;
  }

  async getPresignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    // MinIO 서명 URL 함정 대응: S3_PUBLIC_URL 이 있으면 내부 DNS 호스트를 외부 호스트로 치환
    const publicUrl = this.configService.get<string>('S3_PUBLIC_URL');
    const endpoint = this.configService.get<string>('S3_ENDPOINT');

    if (publicUrl && endpoint) {
      return signedUrl.replace(endpoint, publicUrl);
    }

    return signedUrl;
  }

  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    const response = await this.s3Client.send(command);
    const byteArray = await response.Body?.transformToByteArray();
    return Buffer.from(byteArray ?? []);
  }

  async delete(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }),
    );
    this.logger.log(`S3 객체 삭제 완료: ${key}`);
  }
}
