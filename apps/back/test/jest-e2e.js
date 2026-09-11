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
    // .ts 만 변환한다. .js 까지 넣으면 워크스페이스 패키지의 빌드 산출물을
    // 컴파일하려 해 경고가 난다.
    '^.+\\.ts$': 'ts-jest',
  },
  restoreMocks: true,
  setupFiles: [
    'reflect-metadata',
    '<rootDir>/setup/setup-tz.ts',
    '<rootDir>/setup/setup-transactional.ts',
  ],

  // ⚠️ jest.config.js 의 moduleNameMapper · tsconfig.json 의 paths 와 1:1 로 유지할 것.
  moduleNameMapper: {
    // 🚫 실 DB 접속 차단 — mysql2 를 던지는 스텁으로 바꾼다 (test/setup/forbid-db.ts). 양쪽 설정 세트.
    '^mysql2(/.*)?$': '<rootDir>/setup/forbid-db.ts',
    // @nerd/contracts 는 **소스로** 해석한다. 빌드 산출물(dist)로 두면 두 가지 문제가 있다 —
    // (1) ts-jest 가 dist 의 .js 를 컴파일하려 해 경고가 뜨고,
    // (2) contracts 를 고치고 빌드를 안 하면 테스트가 **낡은 dist 를 검증**한다.
    //     `tsc`(build·check:types)는 package.json 의 main 을 따라 dist 를 본다 — ci:core 가
    //     contracts 를 먼저 빌드하므로(`--filter nerd-back...`) 그쪽은 항상 최신이다.
    '^@nerd/contracts$': '<rootDir>/../../../packages/contracts/src/index.ts',
    '^@common/(.*)$': '<rootDir>/../src/common/$1',
    '^@config/(.*)$': '<rootDir>/../src/config/$1',
    '^@entities/(.*)$': '<rootDir>/../src/entities/$1',
    '^@modules/(.*)$': '<rootDir>/../src/modules/$1',
    '^@/(.*)$': '<rootDir>/../src/$1',
  },
};
