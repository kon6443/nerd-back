#!/usr/bin/env node
/**
 * `scripts/healthcheck.mjs` 의 PATH 가 실제 route handler 와 대응하는지 확인한다.
 *
 * App Router 는 **파일 경로가 곧 URL 경로**다 (`app/health/route.ts` → `/health`).
 * 디렉터리를 옮기거나 이름을 바꾸면 healthcheck.mjs 는 그대로 남아 404 를 받고,
 * Swarm 이 컨테이너를 unhealthy 로 판정해 **재시작 루프 + 배포 롤백**에 빠진다.
 *
 * 두 파일 어디에도 에러가 없어 보인다는 것이 이 종류의 함정이다 —
 * 배포해 봐야 드러난다. 그래서 CI 에서 고정한다.
 *
 * 백엔드는 `app.constants.spec.ts` 가 같은 대조를 하지만, 프론트는 테스트
 * 프레임워크가 없어 독립 스크립트로 둔다.
 */
import { existsSync, readFileSync } from 'node:fs';

const HEALTHCHECK_FILE = 'scripts/healthcheck.mjs';

const source = readFileSync(HEALTHCHECK_FILE, 'utf8');
const matched = source.match(/^const PATH = '([^']+)';/m);

if (!matched) {
  console.error(`check:health-path — ${HEALTHCHECK_FILE} 에서 PATH 상수를 찾지 못했다.`);
  console.error("  형식을 바꿨다면 이 스크립트의 정규식도 함께 고친다.");
  process.exit(1);
}

const urlPath = matched[1];

// App Router 규칙으로 역산한다. `/health` → `app/health/route.ts`
const routeFile = `app${urlPath}/route.ts`;

if (!existsSync(routeFile)) {
  console.error(`check:health-path — 불일치\n`);
  console.error(`  ${HEALTHCHECK_FILE} 의 PATH : '${urlPath}'`);
  console.error(`  기대되는 route handler      : ${routeFile}  ← 없다\n`);
  console.error('  헬스체크 경로를 옮겼다면 두 곳을 함께 고친다.');
  process.exit(1);
}

console.log(`check:health-path — 통과 ('${urlPath}' ↔ ${routeFile})`);
