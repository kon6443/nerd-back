import { Injectable } from '@nestjs/common';

/**
 * 세션 — **서명 쿠키**. 서버측 저장소를 쓰지 않는다.
 *
 * 2026-09-07 에 Redis 저장 방식에서 바꿨다. Redis 가 사주는 유일한 것은 **서버측 강제 만료**인데
 * 그것을 쓰는 기능이 하나도 없었다 — 로그아웃은 쿠키 삭제로 사용자 경험이 같고, 비밀번호 변경도
 * 관리자 차단도 계획에 없다. **쓰지 않는 능력 때문에 인증이 외부 시스템에 묶여 있었다.**
 *
 * 바꿔서 얻은 것:
 * - 로컬 개발에 Redis 가 필요 없다 (셋업 장애물 하나 제거)
 * - Redis 장애가 인증을 멈추지 않는다
 * - ⭐ **가입의 두 저장소 문제가 사라진다.** 예전에는 계정(MySQL) 저장 후 세션(Redis) 생성이
 *   실패하면 계정만 남아 재시도 시 409 였다. 쿠키 발급은 실패할 수 없어 되돌릴 것이 없다.
 *
 * 잃은 것 — **서버측 강제 만료.** 훔친 쿠키는 만료까지 유효하다(훔친 sid 도 같았다는 점에서
 * 탈취 위험 자체는 변하지 않는다).
 * 🚫 **강제 로그아웃·기기 관리·비밀번호 변경이 필요해지면 서버측 세션으로 돌아온다.**
 * 그때는 이 파일의 이전 버전(git 이력)이 그대로 근거다.
 *
 * **서명은 `cookie-parser` 가 한다** (`res.cookie(..., { signed: true })`).
 * 🚫 HMAC 을 직접 구현하지 않는다 — `cookie-signature` 는 HMAC-SHA256 + `crypto.timingSafeEqual`
 * 이다(2026-09-07 설치본 확인). 직접 짜면 비교를 타이밍 안전하게 하는 것부터 다시 해야 한다.
 */

/**
 * 세션 수명. 시연·체험용이라 재로그인 부담을 줄이는 쪽으로 잡았다.
 * ⚠️ 늘리면 탈취된 쿠키의 유효 기간도 같이 늘어난다. **취소 수단이 없으므로** 예전보다 더 그렇다.
 */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/** 쿠키 이름. 프론트가 직접 읽지 않는다(httpOnly) — 서버만 쓴다. */
export const SESSION_COOKIE = 'sid';

/**
 * 쿠키에 담기는 평문 부분. `<userId>:<만료 epoch ms>`.
 *
 * ⚠️ **만료를 값 안에 넣는다.** 쿠키의 `maxAge` 는 브라우저에게 주는 힌트일 뿐이라, 만료된 쿠키를
 * 계속 보내는 클라이언트를 서버가 막지 못한다. 서명 안에 넣어야 위조 없이 서버가 판정할 수 있다.
 */
const SEPARATOR = ':';

@Injectable()
export class SessionService {
  /**
   * 쿠키에 담을 값을 만든다. **동기이고 실패하지 않는다** — 외부 시스템을 쓰지 않는다.
   * 서명은 호출부가 `signed: true` 로 위임한다.
   */
  issue(userId: number): string {
    const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
    return `${userId}${SEPARATOR}${expiresAt}`;
  }

  /**
   * `req.signedCookies[SESSION_COOKIE]` 값을 받아 사용자 id 를 돌려준다.
   *
   * ⚠️ **`cookie-parser` 는 서명이 깨지면 `false` 를 준다** — 없을 때(`undefined`)와 다른 값이다.
   * 둘 다 거절이지만 타입이 갈리므로 `unknown` 으로 받아 좁힌다.
   *
   * 🚫 실패 사유를 구분해 돌려주지 않는다. 위조·만료·형식오류가 호출부에서 같은 401 이어야 한다.
   */
  resolveUserId(signedValue: unknown): number | null {
    if (typeof signedValue !== 'string' || signedValue.length === 0) return null;

    const separatorAt = signedValue.indexOf(SEPARATOR);
    if (separatorAt < 0) return null;

    const userId = Number(signedValue.slice(0, separatorAt));
    const expiresAt = Number(signedValue.slice(separatorAt + 1));

    // 🚫 `Number()` 는 빈 문자열을 0 으로, 공백을 무시한다. 정수·양수까지 확인해야
    //    `":123"` 같은 값이 userId 0 으로 통과하지 않는다.
    if (!Number.isInteger(userId) || userId <= 0) return null;
    if (!Number.isInteger(expiresAt) || expiresAt <= Date.now()) return null;

    return userId;
  }
}
