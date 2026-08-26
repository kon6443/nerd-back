/**
 * 레이트리밋 2단 구성.
 *
 * `short` 는 순간 폭주(버튼 연타·스크립트)를, `long` 은 지속적인 남용을 막는다.
 * 두 개를 겹쳐야 "1초에 5번은 막지만 1분에 300번은 통과"하는 구멍이 생기지 않는다.
 *
 * ⚠️ 레플리카가 3개이므로 **스토리지가 Redis 여야 한다.**
 *    메모리 스토리지를 쓰면 레플리카별로 따로 세어 실효 한도가 3배가 된다.
 */
export const THROTTLE_SHORT = { name: 'short', ttl: 1_000, limit: 5 } as const;
export const THROTTLE_LONG = { name: 'long', ttl: 60_000, limit: 60 } as const;

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
