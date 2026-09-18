/**
 * `.sql` 파일 하나를 운영 DB 에 실행한다.
 *
 *   pnpm db:sql docs/sql/template-webp.up.sql
 *
 * ## 왜 파일로 받는가
 * 🚫 인라인 SQL 을 받지 않는다. 실행할 문장이 **저장소에 남아 리뷰·롤백 대상**이 되어야 한다.
 * 이 저장소는 전 환경이 같은 DB 를 공유하므로 실행은 **사람이** 한다 (`apps/back/CLAUDE.md`).
 *
 * ⚠️ `multipleStatements` 를 켠다. 이 값은 사용자가 고른 파일에만 적용되며,
 * 🚫 애플리케이션 코드의 커넥션에는 절대 켜지 않는다 (SQL 주입 경로가 열린다).
 *
 * 마이그레이션(DDL)은 이 스크립트가 아니라 `pnpm db:migrate:up` 이 맡는다 — 계정이 다르다
 * (앱 계정에는 DDL 권한이 없다).
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function resolveSqlPath(arg) {
  if (!arg) {
    console.error('사용법: pnpm db:sql <파일.sql>');
    process.exit(1);
  }
  // 저장소 루트에서 부르든 앱 디렉터리에서 부르든 같은 경로가 통하게 한다.
  for (const candidate of isAbsolute(arg) ? [arg] : [resolve(process.cwd(), arg), resolve(REPO_ROOT, arg)]) {
    try {
      return { path: candidate, sql: readFileSync(candidate, 'utf8') };
    } catch {
      /* 다음 후보 */
    }
  }
  console.error(`파일을 찾을 수 없다: ${arg}`);
  process.exit(1);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} 가 설정되지 않았다 (apps/back/.env)`);
    process.exit(1);
  }
  return value;
}

const { path, sql } = resolveSqlPath(process.argv[2]);

const connection = await mysql.createConnection({
  host: requireEnv('DB_HOST'),
  port: Number(requireEnv('DB_PORT')),
  user: requireEnv('DB_USER'),
  password: requireEnv('DB_PASSWORD'),
  database: requireEnv('DB_NAME'),
  timezone: 'Z',
  multipleStatements: true,
});

console.log(`실행: ${path}\n`);

/**
 * mysql2 의 반환 모양을 **결과 목록**으로 통일한다.
 *
 * ⚠️ 여러 문장이면 `[결과, 결과, …]` 지만 **SELECT 하나면 `[행, 행, …]`** 이 온다. 둘 다 배열이라
 * 겉모습으로는 구분되지 않는다. 예전에는 무조건 목록으로 보고 각 원소를 결과로 다뤄서,
 * 단일 SELECT 파일이 **아무것도 출력하지 않았다**(실측). 원소의 모양으로 판별한다.
 */
function toResultList(results) {
  if (!Array.isArray(results)) return [results];
  if (results.length === 0) return [[]];
  const looksLikeResultList = results.every(
    (item) => Array.isArray(item) || (item !== null && typeof item === 'object' && 'affectedRows' in item),
  );
  return looksLikeResultList ? results : [results];
}

try {
  const [results] = await connection.query(sql);
  for (const result of toResultList(results)) {
    if (Array.isArray(result)) {
      if (result.length === 0) {
        console.log('  (0행)');
      } else {
        console.table(result.map((row) => ({ ...row })));
      }
    } else if (result && typeof result.affectedRows === 'number') {
      console.log(`  변경된 행: ${result.affectedRows}`);
    }
  }
  console.log('\n완료.');
} catch (error) {
  // 트랜잭션 안에서 실패했으면 커밋되지 않은 채 커넥션이 닫히며 롤백된다.
  console.error(`\n실패: ${error.code ?? ''} ${error.sqlMessage ?? error.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
