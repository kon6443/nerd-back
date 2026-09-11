// ⚠️ 타임존은 **여기서**(설정 로드 시점 = 워커를 띄우기 전) 고정한다.
//    setupFiles 안에서 process.env.TZ 를 대입하면 샌드박스의 env 복사본에만 쓰여 V8 타임존이 바뀌지 않는다
//    (2026-09-02 실측: 대입 후에도 getHours 9 · Intl 'Asia/Seoul'). 워커는 이 프로세스의 env 를 상속한다.
//    test/setup/setup-tz.ts 가 이 고정이 실제로 먹었는지 매 테스트 파일 앞에서 검증한다.
process.env.TZ = 'UTC';

module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    // .ts 만 변환한다. .js 까지 넣으면 워크스페이스 패키지의 빌드 산출물을
    // 컴파일하려 해 경고가 난다.
    '^.+\\.ts$': 'ts-jest',
  },
  testEnvironment: 'node',

  // 각 테스트 후 spy·mock 을 자동 복원한다. 전역 객체(Logger.prototype 등)에 spy 를 걸고
  // afterEach 복원을 깜빡하면 같은 파일의 후속 테스트가 조용히 오염된다.
  // 개별 파일의 규율에 의존하지 않고 설정으로 보장한다.
  restoreMocks: true,

  collectCoverageFrom: ['**/*.(t|j)s'],
  // 테스트 코드 자체는 커버리지 분모에서 뺀다 — 넣으면 "무엇이 검증되지 않았는지"라는
  // 커버리지의 신호가 테스트 헬퍼의 미사용 라인에 묻혀 왜곡된다.
  coveragePathIgnorePatterns: ['/node_modules/', '\\.spec\\.ts$', '/__spec__/'],
  coverageDirectory: '../coverage',

  // reflect-metadata 는 데코레이터 메타데이터를 읽는 모든 코드(class-validator·class-transformer·
  // Nest DI)의 전제다. main.ts 에서만 import 하면 테스트에서는 로드되지 않아
  // "Reflect.getMetadata is not a function" 으로 터진다.
  setupFiles: [
    'reflect-metadata',
    '<rootDir>/../test/setup/setup-tz.ts',
    '<rootDir>/../test/setup/setup-transactional.ts',
  ],

  // ⚠️ tsconfig.json 의 paths 와 1:1 로 유지할 것.
  //    누락 시 해당 alias 를 쓰는 테스트가 모듈 해석에 실패한다.
  moduleNameMapper: {
    // 🚫 실 DB 접속 차단 — mysql2 를 던지는 스텁으로 바꾼다 (test/setup/forbid-db.ts). 양쪽 설정 세트.
    '^mysql2(/.*)?$': '<rootDir>/../test/setup/forbid-db.ts',
    // @nerd/contracts 는 **소스로** 해석한다. 빌드 산출물(dist)로 두면 두 가지 문제가 있다 —
    // (1) ts-jest 가 dist 의 .js 를 컴파일하려 해 경고가 뜨고,
    // (2) contracts 를 고치고 빌드를 안 하면 테스트가 **낡은 dist 를 검증**한다.
    //     `tsc`(build·check:types)는 package.json 의 main 을 따라 dist 를 본다 — ci:core 가
    //     contracts 를 먼저 빌드하므로(`--filter nerd-back...`) 그쪽은 항상 최신이다.
    '^@nerd/contracts$': '<rootDir>/../../../packages/contracts/src/index.ts',
    '^@common/(.*)$': '<rootDir>/common/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@entities/(.*)$': '<rootDir>/entities/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
};
