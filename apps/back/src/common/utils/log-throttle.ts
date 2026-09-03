/**
 * 반복되는 로그를 간격 제한으로 줄인다.
 *
 * ## 왜 필요한가
 *
 * 외부 의존이 끊기면 클라이언트 라이브러리가 재연결을 계속 시도하고, 그 `error`
 * 이벤트마다 로그를 찍으면 **트래픽이 0이어도 로그가 쌓인다.**
 *
 * 실측: Redis 가 죽은 상태에서 요청 0건 · 60초 유휴 → 경고 29줄.
 * 하루 환산 41,760줄/레플리카, 레플리카 3개면 125,280줄/일.
 * 로그 수집 스택이 공유 자원이고 인제스트 한도가 낮으므로 그대로 두면 남의 조회까지 느려진다.
 *
 * ## 동작
 *
 * 첫 발생은 즉시 통과시킨다(장애를 늦게 알면 안 된다). 이후 `intervalMs` 동안은
 * 억제하며 개수만 센다. 다음 통과 시점에 **억제한 개수를 함께 돌려주고** 카운터를 비운다.
 * 억제된 건수를 로그 메시지에 넣으면 "조용해진 것"과 "억제된 것"을 구분할 수 있다.
 */
export interface LogThrottleDecision {
  /** 지금 로그를 남겨야 하는가. */
  log: boolean;
  /** 직전 통과 이후 억제된 건수. `log: false` 면 항상 0. */
  suppressed: number;
}

export interface LogThrottle {
  /** 판정하고 카운터를 갱신한다. 통과할 때 억제 카운터를 비운다. */
  consume(nowMs: number): LogThrottleDecision;
  /** 아직 보고되지 않은 억제 건수. 복구 시점에 함께 알리는 용도. */
  pending(): number;
  /** 상태 초기화. 의존이 복구됐을 때 호출한다. */
  reset(): void;
}

export function createLogThrottle(intervalMs: number): LogThrottle {
  let lastLoggedAt: number | null = null;
  let suppressed = 0;

  return {
    consume(nowMs: number): LogThrottleDecision {
      if (lastLoggedAt !== null && nowMs - lastLoggedAt < intervalMs) {
        suppressed += 1;
        return { log: false, suppressed: 0 };
      }

      lastLoggedAt = nowMs;
      const held = suppressed;
      suppressed = 0;
      return { log: true, suppressed: held };
    },

    pending(): number {
      return suppressed;
    },

    reset(): void {
      lastLoggedAt = null;
      suppressed = 0;
    },
  };
}
