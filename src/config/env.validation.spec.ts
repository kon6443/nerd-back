import { AppEnv, isEdgeThrottleEnabled, validateEnv } from './env.validation';

const MINIMAL = {
  ENV: 'LOCAL',
  REDIS_HOST: '127.0.0.1',
};

describe('validateEnv', () => {
  it('최소 설정을 통과시키고 기본값을 채운다', () => {
    const result = validateEnv({ ...MINIMAL });

    expect(result.ENV).toBe(AppEnv.LOCAL);
    expect(result.PORT).toBe(5501);
    expect(result.REDIS_PORT).toBe(6379);
    expect(result.TASK_SLOT).toBe(1);
  });

  it('문자열로 들어온 숫자를 number 로 변환한다', () => {
    const result = validateEnv({ ...MINIMAL, PORT: '5501', TASK_SLOT: '2' });

    expect(result.PORT).toBe(5501);
    expect(result.TASK_SLOT).toBe(2);
  });

  it('필수 값이 없으면 던진다 — 런타임에 undefined 로 새지 않게', () => {
    expect(() => validateEnv({ ENV: 'LOCAL' })).toThrow(/REDIS_HOST/);
  });

  it('ENV 가 허용 값이 아니면 던진다', () => {
    expect(() => validateEnv({ ...MINIMAL, ENV: 'STAGING' })).toThrow(/ENV/);
  });

  it('포트 범위를 벗어나면 던진다', () => {
    expect(() => validateEnv({ ...MINIMAL, PORT: '70000' })).toThrow(/PORT/);
  });

  it('에러 메시지에 .env.example 안내를 포함한다', () => {
    expect(() => validateEnv({})).toThrow(/\.env\.example/);
  });

  describe('EDGE_THROTTLE_ENABLED', () => {
    it('지정하지 않으면 꺼진 상태다 ⭐', () => {
      // 이 기본값이 "배포·로컬 영향 0" 의 근거다. 켜는 것은 운영이 명시적으로 한다.
      const result = validateEnv({ ...MINIMAL });

      expect(result.EDGE_THROTTLE_ENABLED).toBe('false');
      expect(isEdgeThrottleEnabled(result.EDGE_THROTTLE_ENABLED)).toBe(false);
    });

    it("문자열 'false' 가 truthy 로 뒤집히지 않는다 ⭐", () => {
      // boolean 으로 선언했다면 enableImplicitConversion 이 'false' 를 true 로 바꿨을 것이다.
      const result = validateEnv({ ...MINIMAL, EDGE_THROTTLE_ENABLED: 'false' });

      expect(isEdgeThrottleEnabled(result.EDGE_THROTTLE_ENABLED)).toBe(false);
    });

    it("'true' 면 켜진다", () => {
      const result = validateEnv({ ...MINIMAL, EDGE_THROTTLE_ENABLED: 'true' });

      expect(isEdgeThrottleEnabled(result.EDGE_THROTTLE_ENABLED)).toBe(true);
    });

    it('허용 값이 아니면 던진다 — 오타가 조용히 꺼진 상태로 남지 않게', () => {
      expect(() => validateEnv({ ...MINIMAL, EDGE_THROTTLE_ENABLED: 'yes' })).toThrow(
        /EDGE_THROTTLE_ENABLED/,
      );
    });
  });
});
