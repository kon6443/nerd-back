/**
 * 레이트리밋 키로 쓸 요청 식별자.
 *
 * **Express 의 `req.ip` 를 그대로 쓴다.** XFF 헤더를 직접 파싱하지 않는다.
 *
 * ⚠️ **직접 파싱하면 스푸핑된다.** Caddy 의 `reverse_proxy` 는 `X-Forwarded-For` 를
 *    덮어쓰지 않고 **뒤에 붙인다(append)**. 그래서 공격자가 `X-Forwarded-For: 1.2.3.4` 를
 *    보내면 앱에는 `1.2.3.4, <실제IP>` 가 도착하고, **첫 값을 쓰면 공격자가 정한 값**이 된다.
 *    헤더를 매 요청 바꾸면 한도가 무력화된다.
 *
 *    `req.ip` 는 `proxy-addr` 가 오른쪽에서 왼쪽으로 훑으며 **신뢰 홉만 건너뛰어** 계산하므로
 *    위조 값을 무시한다 (실측 2026-08-28, `trust proxy: 1`):
 *      XFF `1.2.3.4, 203.0.113.9`            → `req.ip` = 203.0.113.9  (우리 옛 구현은 1.2.3.4)
 *      XFF `1.2.3.4, 5.6.7.8, 203.0.113.9`   → `req.ip` = 203.0.113.9
 *
 *    `@nestjs/throttler` 의 `ThrottlerGuard` 기본 구현도 `return req.ip` 다. 우리는 한동안
 *    그 기본값을 "프록시 뒤라서" 라는 잘못된 이유로 덮어써 두고 있었다.
 *
 * 🚫 **전제: 신뢰 프록시 홉 수는 `TRUST_PROXY_HOPS` 가 소유한다** (`@common/constants/app.constants`).
 *    프로덕션과 모든 E2E 앱이 그 상수를 쓴다. CDN 추가 시 그 값만 늘리면 전부 따라온다.
 *
 * 이 함수를 남겨 두는 이유: 레이트리밋 가드와 엣지 백스톱이 **같은 키 체계**를 쓰게 하는
 * 단일 지점이다. 인증이 도입되면 로그인 사용자를 `user-{id}` 로 바꾸는데, 그때 여기만 고치면
 * 두 한도가 함께 바뀐다 (IP 를 공유하는 환경에서 서로를 막지 않게).
 */
export interface IpBearingRequest {
  ip?: string;
}

export function resolveClientIp(req: IpBearingRequest): string {
  return req.ip ?? 'unknown';
}
