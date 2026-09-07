import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * scrypt 파라미터.
 *
 * `node:crypto` 표준 라이브러리만 쓴다 — bcrypt·argon2 를 들이지 않는다. 새 의존성 없이
 * 메모리 하드 해시를 얻을 수 있고, 네이티브 빌드가 없어 컨테이너 빌드도 단순해진다.
 *
 * ⚠️ `maxmem` 을 명시한다. scrypt 메모리 사용량은 대략 `128 * N * r`(여기서는 16MB)인데
 * Node 기본 상한이 32MB 라 파라미터를 조금만 올려도 **런타임에 조용히 실패**한다.
 */
const PARAMS = { N: 16_384, r: 8, p: 1, keylen: 32, maxmem: 64 * 1024 * 1024 } as const;
const SALT_BYTES = 16;

/** 저장 형식. 파라미터를 함께 담아 **나중에 값을 올려도 옛 해시를 계속 검증**할 수 있다. */
const PREFIX = 'scrypt';

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const derived = await scryptAsync(password, salt, PARAMS.keylen, PARAMS);

    return [
      PREFIX,
      PARAMS.N,
      PARAMS.r,
      PARAMS.p,
      salt.toString('base64url'),
      derived.toString('base64url'),
    ].join('$');
  }

  /**
   * ⚠️ 실패를 **예외로 던지지 않고 `false` 로 답한다.** 형식이 깨진 해시와 비밀번호 불일치를
   * 호출부가 구분하지 못하게 하려는 것이다 — 구분하면 그 차이가 곧 계정 상태의 신호가 된다.
   */
  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== PREFIX) return false;

    const [, n, r, p, saltB64, hashB64] = parts;
    const params = { N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem };
    if (!Number.isInteger(params.N) || !Number.isInteger(params.r) || !Number.isInteger(params.p)) {
      return false;
    }

    const expected = Buffer.from(hashB64, 'base64url');
    if (expected.length === 0) return false;

    const derived = await scryptAsync(
      password,
      Buffer.from(saltB64, 'base64url'),
      expected.length,
      params,
    );

    // 🚫 `===` 로 비교하지 않는다. 길이가 같을 때만 쓸 수 있으므로 위에서 keylen 을 맞췄다.
    return timingSafeEqual(derived, expected);
  }
}
