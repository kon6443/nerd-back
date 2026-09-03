import { AppEnv, isEdgeThrottleEnabled, validateDbEnv, validateEnv } from './env.validation';

const DB_MINIMAL = {
  DB_HOST: '127.0.0.1',
  DB_USER: 'nerd_app',
  DB_PASSWORD: 'secret',
  DB_NAME: 'nerd',
};

const MINIMAL = {
  ENV: 'LOCAL',
  REDIS_HOST: '127.0.0.1',
  ...DB_MINIMAL,
};

describe('validateEnv', () => {
  it('최소 설정을 통과시키고 기본값을 채운다', () => {
    const result = validateEnv({ ...MINIMAL });

    expect(result.ENV).toBe(AppEnv.LOCAL);
    expect(result.PORT).toBe(5501);
    expect(result.REDIS_PORT).toBe(6379);
    expect(result.TASK_SLOT).toBe(1);
    expect(result.DB_PORT).toBe(3306);
    expect(result.DB_POOL_SIZE).toBe(10);
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

  describe('DB', () => {
    it.each(['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'])('%s 가 없으면 던진다', (key) => {
      const rest = Object.fromEntries(Object.entries(MINIMAL).filter(([k]) => k !== key));
      expect(() => validateEnv(rest)).toThrow(new RegExp(key));
    });

    it('비밀번호가 빈 문자열이면 던진다 — .env 에 빈 줄만 남는 실수를 잡는다', () => {
      expect(() => validateEnv({ ...MINIMAL, DB_PASSWORD: '' })).toThrow(/DB_PASSWORD/);
    });

    it('풀 크기 상한(30)을 넘으면 던진다 — 레플리카 3 × 풀이 max_connections 를 넘지 않게', () => {
      expect(() => validateEnv({ ...MINIMAL, DB_POOL_SIZE: '31' })).toThrow(/DB_POOL_SIZE/);
    });
  });

  describe('validateDbEnv — 마이그레이션 CLI 용', () => {
    it('DB 변수만으로 통과한다 (Redis 등 앱 변수 불필요)', () => {
      const result = validateDbEnv({ ...DB_MINIMAL });
      expect(result.DB_PORT).toBe(3306);
    });

    it('안내 파일이 .env.migration.example 이다', () => {
      expect(() => validateDbEnv({})).toThrow(/\.env\.migration\.example/);
    });
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
