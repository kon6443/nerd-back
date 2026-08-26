import { createLogThrottle } from './log-throttle';

const INTERVAL = 60_000;

describe('createLogThrottle', () => {
  it('첫 발생은 즉시 통과시킨다 — 장애를 늦게 알면 안 된다', () => {
    const throttle = createLogThrottle(INTERVAL);

    expect(throttle.consume(0)).toEqual({ log: true, suppressed: 0 });
  });

  it('간격 안의 반복은 억제한다', () => {
    const throttle = createLogThrottle(INTERVAL);

    throttle.consume(0);

    expect(throttle.consume(1_000).log).toBe(false);
    expect(throttle.consume(30_000).log).toBe(false);
    expect(throttle.consume(59_999).log).toBe(false);
    expect(throttle.pending()).toBe(3);
  });

  it('간격이 지나면 통과시키고 억제 건수를 함께 돌려준다', () => {
    const throttle = createLogThrottle(INTERVAL);

    throttle.consume(0);
    throttle.consume(1_000);
    throttle.consume(2_000);

    // 억제된 2건을 이 시점에 보고하고 카운터를 비운다.
    expect(throttle.consume(60_000)).toEqual({ log: true, suppressed: 2 });
    expect(throttle.pending()).toBe(0);
  });

  it('억제 중에는 suppressed 를 노출하지 않는다 — 통과 시점에만 보고한다', () => {
    const throttle = createLogThrottle(INTERVAL);

    throttle.consume(0);

    expect(throttle.consume(1_000).suppressed).toBe(0);
    expect(throttle.consume(2_000).suppressed).toBe(0);
  });

  it('reset 후에는 첫 발생처럼 즉시 통과시킨다', () => {
    const throttle = createLogThrottle(INTERVAL);

    throttle.consume(0);
    expect(throttle.consume(1_000).log).toBe(false);

    throttle.reset();

    expect(throttle.consume(2_000)).toEqual({ log: true, suppressed: 0 });
    expect(throttle.pending()).toBe(0);
  });

  it('실측 시나리오 — 2초 간격 재연결 60초분이 1줄로 줄어든다 ⭐', () => {
    const throttle = createLogThrottle(INTERVAL);
    let logged = 0;

    // 실측된 발생 빈도: 60초에 29건 (약 2초 간격)
    for (let ms = 0; ms < 60_000; ms += 2_069) {
      if (throttle.consume(ms).log) logged += 1;
    }

    expect(logged).toBe(1);
    expect(throttle.pending()).toBe(28);
  });
});
