import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { StoragePort } from '../port/storage.port';

/**
 * 개발/테스트 전용 로컬 파일 스토리지 어댑터.
 * 별도 S3/MinIO 컨테이너 실행 없이도 uploads 디렉터리에 안전하게 저장하고 Data URL 또는 상대 경로로 서빙한다.
 */
@Injectable()
export class LocalStorageAdapter implements StoragePort {
  private readonly logger = new Logger(LocalStorageAdapter.name);
  private readonly baseDir = path.resolve(process.cwd(), 'uploads');

  constructor() {
    fs.mkdir(this.baseDir, { recursive: true }).catch(() => {});
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const safeKey = key.replace(/^\/+/, '');
    const fullPath = path.join(this.baseDir, safeKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
    this.logger.log(`로컬 파일 스토리지 저장: ${safeKey}`);
    return safeKey;
  }

  async getPresignedUrl(key: string, _expiresInSeconds = 3600): Promise<string> {
    const safeKey = key.replace(/^\/+/, '');
    const fullPath = path.join(this.baseDir, safeKey);
    try {
      const buffer = await fs.readFile(fullPath);
      const str = buffer.toString('utf-8');
      if (safeKey.endsWith('.svg') || str.includes('<svg')) {
        return `data:image/svg+xml;utf8,${encodeURIComponent(str)}`;
      }
      return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch {
      return `/uploads/${safeKey}`;
    }
  }

  async download(key: string): Promise<Buffer> {
    const safeKey = key.replace(/^\/+/, '');
    const fullPath = path.join(this.baseDir, safeKey);
    return fs.readFile(fullPath);
  }

  async delete(key: string): Promise<void> {
    const safeKey = key.replace(/^\/+/, '');
    const fullPath = path.join(this.baseDir, safeKey);
    try {
      await fs.unlink(fullPath);
    } catch {
      // 무시
    }
  }
}
