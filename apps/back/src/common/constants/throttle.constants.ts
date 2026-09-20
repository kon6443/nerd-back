/**
 * 레이트리밋 2단 구성.
 *
 * `short` 는 순간 폭주(버튼 연타·스크립트)를, `long` 은 지속적인 남용을 막는다.
 * 두 개를 겹쳐야 "1초에 5번은 막지만 1분에 300번은 통과"하는 구멍이 생기지 않는다.
 *
 * ⚠️ 레플리카가 3개이므로 **스토리지가 Redis 여야 한다.**
 *    메모리 스토리지를 쓰면 레플리카별로 따로 세어 실효 한도가 3배가 된다.
 */
export const THROTTLE_SHORT = { name: 'short', ttl: 1_000, limit: 20 } as const;
export const THROTTLE_LONG = { name: 'long', ttl: 60_000, limit: 120 } as const;

/**
 * 엣지 백스톱 한도.
 *
 * Nest 가드(`APP_GUARD`)가 닿지 않는 경로를 덮는 마지막 그물이다. 실측으로 확인된 사각 3종:
 * `/api/v2/docs`(Swagger UI) · `/api/v2/docs-json`(스펙 전문) · 매칭되지 않는 경로(404).
 * 앞의 둘은 SwaggerModule 이 express 미들웨어로 마운트되어, 404 는 라우트 핸들러가 없어서
 * 가드가 실행되지 않는다.
 *
 * ⚠️ `long`(분당 60)보다 **의도적으로 느슨하다.** 가드가 커버하는 경로에서는 long 이 먼저
 *    걸리므로 이 한도는 사실상 가드 밖 경로에만 작용한다. 정상 트래픽이 여기 닿는다면
 *    한도가 잘못 잡힌 것이니 값을 올리기 전에 무엇이 그만큼 때리는지 먼저 본다.
 */
export const THROTTLE_EDGE = { name: 'edge', ttl: 60_000, limit: 300 } as const;

/**
 * 로그인 전용 한도. 전역 `long`(분당 60)으로는 **대입 공격을 막지 못한다** —
 * 분당 60번이면 하루 86,400번이다.
 *
 * ⚠️ IP 기준이라 같은 망에서 여러 사람이 로그인하면 함께 걸린다. 시연 환경에서 그 비용보다
 * 무차별 대입을 여는 비용이 크다고 봤다.
 */
export const THROTTLE_LOGIN = { ttl: 60_000, limit: 5 } as const;

/**
 * 게스트 체험 입장 전용 한도.
 *
 * ⚠️ 이 엔드포인트는 **한 번 호출될 때마다 계정 행이 하나 생긴다.**
 *
 * ### 왜 분당 120인가 (2026-09-20 실측 기반으로 10 → 120 상향)
 *
 * **자동 입장(`GUEST_AUTO_ENTER`)이 켜지면 버튼을 누른 사람이 아니라 방문자 전원이 이걸 부른다.**
 * 그래서 버튼 시절의 값(분당 10)으로는 정상 트래픽이 막힌다.
 *
 * - 한도는 **IP 기준**인데 모바일은 통신사 CGNAT 뒤에서 **수백~수천 명이 공인 IP 하나를 공유**한다.
 *   행사장·회사 망도 마찬가지다. 분당 10이면 같은 망의 11번째 방문자부터 조용히 실패한다.
 * - 비용 실측(로컬, 터널 DB): **1회 약 190ms** (scrypt + INSERT. `GET /health` 는 1.6ms).
 *   분당 120 = 초당 2회 = **코어 하나의 약 40%** 이고 레플리카가 3개라 실제로는 그보다 낮다.
 * - 순간 폭주는 이 값이 막지 않는다 — **전역 `short`(1초 20회)가 그대로 적용된다.**
 *   `@Throttle({ long: ... })` 는 `long` 만 덮어쓰기 때문이다.
 *
 * 🚫 이 값을 더 올리기 전에 **계정 정리 정책을 먼저 만든다.** 한도는 남용의 속도를 늦출 뿐
 *    쌓이는 행을 치우지 않는다.
 */
export const THROTTLE_GUEST = { ttl: 60_000, limit: 120 } as const;

/**
 * 피드백 전송 전용 한도 (분당 최대 5회).
 * 도배 및 디스코드 웹훅 스팸을 방지한다.
 */
export const THROTTLE_FEEDBACK = { ttl: 60_000, limit: 5 } as const;

/**
 * `@SkipThrottle()` 에 넘길 값.
 *
 * ⚠️ **인자 없는 `@SkipThrottle()` 은 우리 설정에서 동작하지 않는다.**
 * 기본값이 `{ default: true }` 인데 가드는 `THROTTLER_SKIP + <throttler 이름>` 키를
 * 조회한다. 우리 throttler 이름이 `short`·`long` 이므로 `default` 키는 아무것도 매칭하지 않고
 * 스로틀이 그대로 적용된다 (실측: health 5회 요청 → 스토리지 접근 5회).
 *
 * 그래서 이름을 위 상수에서 파생시킨다. throttler 를 추가하면 여기만 고치면 된다.
 */
export const SKIP_ALL_THROTTLERS = {
  [THROTTLE_SHORT.name]: true,
  [THROTTLE_LONG.name]: true,
} as const;
