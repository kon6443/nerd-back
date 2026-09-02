/**
 * 테스트에서 실제 DB 접속을 차단한다.
 *
 * `jest.config.js` · `test/jest-e2e.js` 의 moduleNameMapper 가 `mysql2` 를 이 모듈로 바꾼다.
 * TypeORM 의 MysqlDriver 는 `require('mysql2')` 로 드라이버를 들기 때문에, 어떤 경로로든
 * `DataSource.initialize()` 에 도달하면 여기서 **즉시, 이유와 대안을 담아** 실패한다.
 *
 * 이유: 전 환경이 같은 서버 DB 를 공유한다 — 테스트의 접속이 곧 상용 접속이다 (code-patterns §9).
 * ⚠️ 두 jest 설정에 같은 매퍼가 있어야 한다. 한쪽만 있으면 그쪽 테스트만 조용히 보호된다.
 */
const REASON =
  '테스트에서 DB 접속은 금지다 — 전 환경이 같은 DB 를 공유한다. ' +
  'Repository 를 mock 하거나 E2E 헬퍼(createE2eApp)의 dbQuery 스텁을 쓰세요 (test/setup/forbid-db.ts).';

function forbid(): never {
  throw new Error(REASON);
}

export const createPool = forbid;
export const createConnection = forbid;
export const createPoolCluster = forbid;

export default { createPool, createConnection, createPoolCluster };
