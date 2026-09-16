import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { StoragePort } from '../port/storage.port';

/**
 * 확장자 → Data URL 미디어 타입.
 *
 * ⚠️ 이 어댑터는 낭독 mp3·캐릭터 답변 음성도 서빙한다. 예전에는 SVG 가 아니면 전부
 * `image/png` 로 내보내서, **로컬 개발 전 구간에서 `<audio>` 재생이 조용히 실패했다**
 * (`STORAGE_PROVIDER` 기본값이 `local` 이다).
 */
const MEDIA_TYPE_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
};

/** 확장자를 모르면 브라우저가 스스로 판별하게 둔다 — 틀린 타입을 단정하는 것보다 낫다. */
const FALLBACK_MEDIA_TYPE = 'application/octet-stream';

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
      const ext = path.extname(safeKey).toLowerCase();

      // SVG 는 확장자가 없어도 본문으로 알아볼 수 있어 예외로 먼저 본다.
      // 🚫 `.mp3` 같은 이진 파일에는 이 검사를 돌리지 않는다 — utf-8 로 읽는 비용이 헛되고,
      //    운 나쁘게 `<svg` 바이트열이 섞이면 오판한다.
      if (ext === '.svg' || (ext === '' && buffer.toString('utf-8').includes('<svg'))) {
        return `data:image/svg+xml;utf8,${encodeURIComponent(buffer.toString('utf-8'))}`;
      }

      const mediaType = MEDIA_TYPE_BY_EXT[ext] ?? FALLBACK_MEDIA_TYPE;
      return `data:${mediaType};base64,${buffer.toString('base64')}`;
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
