// ⚠️ 타임존은 **여기서**(설정 로드 시점 = 워커를 띄우기 전) 고정한다. jest.config.js 와 같은 이유 —
//    setupFiles 안의 process.env.TZ 대입은 샌드박스 env 에만 쓰여 V8 타임존이 바뀌지 않는다 (2026-09-02 실측).
//    JSON 이던 이 파일을 JS 로 바꾼 이유가 이 한 줄이다.
process.env.TZ = 'UTC';

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  restoreMocks: true,
  setupFiles: ['reflect-metadata', '<rootDir>/setup/setup-tz.ts'],

  // ⚠️ jest.config.js 의 moduleNameMapper · tsconfig.json 의 paths 와 1:1 로 유지할 것.
  moduleNameMapper: {
    // 🚫 실 DB 접속 차단 — mysql2 를 던지는 스텁으로 바꾼다 (test/setup/forbid-db.ts). 양쪽 설정 세트.
    '^mysql2(/.*)?$': '<rootDir>/setup/forbid-db.ts',
    '^@common/(.*)$': '<rootDir>/../src/common/$1',
    '^@config/(.*)$': '<rootDir>/../src/config/$1',
    '^@entities/(.*)$': '<rootDir>/../src/entities/$1',
    '^@modules/(.*)$': '<rootDir>/../src/modules/$1',
    '^@/(.*)$': '<rootDir>/../src/$1',
  },
};
