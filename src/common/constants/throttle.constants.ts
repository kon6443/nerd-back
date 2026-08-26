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
