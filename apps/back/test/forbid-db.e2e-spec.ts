import * as mysql from 'mysql2';

/**
 * E2E 설정의 forbid-db 매퍼가 살아 있는지. 단위 설정 쪽은 src/common/database/forbid-db.spec.ts 가 본다 —
 * 두 설정의 moduleNameMapper 는 세트이고, 한쪽만 깨지면 그쪽만 조용히 보호가 풀린다.
 */
describe('DB 접속 차단 가드 (E2E 설정)', () => {
  it('mysql2 드라이버를 들면 즉시 이유를 담아 실패한다', () => {
    expect(() => mysql.createPool({})).toThrow(/DB 접속은 금지/);
  });
});
