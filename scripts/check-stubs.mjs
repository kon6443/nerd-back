#!/usr/bin/env node
/**
 * 미완성 코드와 격리 실행 잔존을 CI 에서 차단한다.
 *
 * - 스텁 마커(TODO / FIXME / XXX / HACK): 미완성 코드가 머지되는 것을 막는다. check-stubs-ignore
 * - `.only(`: 남아 있으면 나머지 테스트가 **조용히 스킵되고 전체 통과로 보인다.**
 *   이게 가장 위험하다 — 실패가 아니라 "통과"로 위장되기 때문이다.
 *   지금은 테스트 프레임워크가 없어 실효가 없지만, 도입 시 바로 동작하도록 남겨둔다.
 *
 * 정당한 사유가 있으면 해당 줄에 `check-stubs-ignore` 주석을 남긴다.
 *
 * ⚠️ 백엔드(`nerd-back`)에서 이식하면서 **두 곳을 바꿨다.**
 *    원본은 `['src', 'test']` + `.ts/.mts/.cts` 라 프론트에 그대로 쓰면
 *    **매칭되는 파일이 0개**가 되어 "통과 (0건)"을 출력하며 조용히 넘어간다.
 *    검사가 없는 것보다 검사하는 척하는 것이 더 나쁘다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const TARGET_DIRS = ['app', 'scripts'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.mjs']);
const IGNORE_MARKER = 'check-stubs-ignore';

const RULES = [
  { name: '스텁 마커', pattern: /\b(TODO|FIXME|XXX|HACK)\b/ }, // check-stubs-ignore
  { name: '격리 실행 잔존', pattern: /\b(describe|it|test)\.only\s*\(/ },
];

/** @param {string} dir @returns {string[]} */
function collectFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectFiles(full);
    return EXTENSIONS.has(extname(full)) ? [full] : [];
  });
}

const violations = [];
let scanned = 0;

for (const dir of TARGET_DIRS) {
  for (const file of collectFiles(dir)) {
    scanned += 1;
    const lines = readFileSync(file, 'utf8').split('\n');

    lines.forEach((line, index) => {
      if (line.includes(IGNORE_MARKER)) return;

      for (const rule of RULES) {
        if (rule.pattern.test(line)) {
          violations.push({ file, line: index + 1, rule: rule.name, text: line.trim() });
        }
      }
    });
  }
}

// 검사 대상이 0개면 규칙이 아니라 설정이 잘못된 것이다. 조용히 통과시키지 않는다.
if (scanned === 0) {
  console.error(`check:stubs — 검사 대상 파일이 0개다. TARGET_DIRS/EXTENSIONS 설정을 확인하세요.`);
  console.error(`  TARGET_DIRS: ${TARGET_DIRS.join(', ')}`);
  console.error(`  EXTENSIONS : ${[...EXTENSIONS].join(', ')}`);
  process.exit(1);
}

if (violations.length === 0) {
  console.log(`check:stubs — 통과 (${scanned}개 파일, 스텁 마커 0건, .only 0건)`);
  process.exit(0);
}

console.error(`check:stubs — ${violations.length}건 발견\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.text.slice(0, 120)}`);
}
console.error('\n머지 전에 처리하거나, 정당한 사유가 있으면 해당 줄에 check-stubs-ignore 주석을 남기세요.');
process.exit(1);
