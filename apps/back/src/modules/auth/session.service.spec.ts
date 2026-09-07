import { SESSION_TTL_SECONDS, SessionService } from './session.service';

/**
 * 서명 쿠키 세션.
 *
 * ⚠️ **서명 자체는 여기서 검증하지 않는다.** HMAC 은 `cookie-parser`(cookie-signature)가 하고,
 * 그 라이브러리는 HMAC-SHA256 + `crypto.timingSafeEqual` 이다. 여기서 검증하는 것은 **우리가 쓴
 * 부분** — 값 형식과 만료 판정이다. 서명이 실제로 붙는지는 E2E(`auth.e2e-spec.ts`)가 고정한다.
 */
describe('SessionService', () => {
  const service = new SessionService();

  describe('issue', () => {
    it('`<userId>:<만료 epoch>` 형식이다', () => {
      const value = service.issue(42);
      const [userId, expiresAt] = value.split(':');

      expect(userId).toBe('42');
      expect(Number(expiresAt)).toBeGreaterThan(Date.now());
    });

    it('만료가 TTL 만큼 뒤다', () => {
      const before = Date.now();
      const expiresAt = Number(service.issue(1).split(':')[1]);

      // 실행 시간 오차를 감안해 범위로 본다. 🚫 정확한 값을 기대하지 않는다 — 그러면
      // 느린 CI 에서 간헐적으로 깨지는 테스트가 된다.
      expect(expiresAt).toBeGreaterThanOrEqual(before + SESSION_TTL_SECONDS * 1000);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + SESSION_TTL_SECONDS * 1000);
    });
  });

  describe('resolveUserId', () => {
    it('방금 발급한 값에서 사용자 id 를 되찾는다', () => {
      expect(service.resolveUserId(service.issue(42))).toBe(42);
    });

    it('만료된 값은 거절한다 ⭐', () => {
      // 🚫 쿠키의 maxAge 에 기대지 않는다 — 그건 브라우저에게 주는 힌트일 뿐이라
      //    만료된 쿠키를 계속 보내는 클라이언트를 서버가 막지 못한다.
      const expired = `42:${Date.now() - 1}`;

      expect(service.resolveUserId(expired)).toBeNull();
    });

    it.each([
      ['없음(undefined)', undefined],
      ['서명 위조 — cookie-parser 가 false 를 준다 ⭐', false],
      ['빈 문자열', ''],
      ['구분자 없음', '42'],
      ['userId 가 숫자가 아님', 'abc:9999999999999'],
      ['userId 가 0 — Number("") 가 0 이 되는 경로', ':9999999999999'],
      ['userId 가 음수', '-1:9999999999999'],
      ['userId 가 소수', '1.5:9999999999999'],
      ['만료가 숫자가 아님', '42:abc'],
      ['만료가 비어 있음', '42:'],
    ])('%s → null', (_label, value) => {
      expect(service.resolveUserId(value)).toBeNull();
    });
  });
});
