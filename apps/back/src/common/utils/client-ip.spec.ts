import { resolveClientIp } from './client-ip';

describe('resolveClientIp', () => {
  it('req.ip 를 그대로 쓴다', () => {
    expect(resolveClientIp({ ip: '203.0.113.9' })).toBe('203.0.113.9');
  });

  it('req.ip 가 없으면 unknown 을 쓴다', () => {
    // 키가 빈 문자열이 되면 모든 요청이 한 통에 들어간다.
    expect(resolveClientIp({})).toBe('unknown');
  });

  it('X-Forwarded-For 헤더를 직접 읽지 않는다 ⭐', () => {
    // 이 단정이 스푸핑 방어의 핵심이다. Caddy 는 XFF 를 append 하므로 첫 값은 공격자가
    // 정할 수 있다. 헤더를 직접 파싱하는 구현으로 되돌아가면 이 테스트가 깨진다.
    // (신뢰 경계 계산은 Express 의 trust proxy + proxy-addr 가 담당한다.)
    const spoofed = {
      ip: '203.0.113.9',
      headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.9' },
    } as unknown as Parameters<typeof resolveClientIp>[0];

    expect(resolveClientIp(spoofed)).toBe('203.0.113.9');
  });
});
