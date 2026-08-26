import { AppEnv, validateEnv } from './env.validation';

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
});
