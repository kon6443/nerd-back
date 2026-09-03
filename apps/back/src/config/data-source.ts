import { DataSource } from 'typeorm';
import { buildMysqlConnectionOptions } from '../common/database/typeorm.options';
import { validateDbEnv } from './env.validation';

/**
 * TypeORM CLI 전용 DataSource — 마이그레이션 생성·실행에만 쓴다. **앱 부팅 경로에서 import 하지 않는다.**
 *
 * 실행은 빌드 산출물 기준이다 (ts-node 미도입):
 *   pnpm migration:show | migration:run | migration:revert | migration:generate src/migrations/<이름>
 * → `node --env-file=.env.migration node_modules/typeorm/cli.js -d dist/config/data-source.js ...`
 *
 * 접속 변수는 앱과 같은 DB_* 이지만 **계정은 nerd_migrator** 다 — 앱 계정(nerd_app)에는 DDL 권한이 없다.
 * 🚫 마이그레이션 실행은 사람이 한다 (CLAUDE.md Never). 전 환경이 같은 DB 라 실행이 곧 상용 적용이다.
 *
 * 이 파일이 alias(@common/…) 대신 상대 경로를 쓰는 이유: CLI 를 tsconfig-paths 없이 돌리기 위해서다.
 */
const env = validateDbEnv(process.env);

export default new DataSource({
  ...buildMysqlConnectionOptions(env),
  // dist 기준 glob — CLI 는 빌드 산출물로 실행된다. 엔티티는 `*.entity.ts` 규약을 따른다.
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
});
