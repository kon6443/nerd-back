#!/usr/bin/env node
/**
 * 미완성 코드와 격리 실행 잔존을 CI 에서 차단한다.
 *
 * - 스텁 마커(TODO / FIXME / XXX / HACK): 미완성 코드가 머지되는 것을 막는다.
 * - `.only(`: 남아 있으면 나머지 테스트가 **조용히 스킵되고 전체 통과로 보인다.**
 *   이게 가장 위험하다 — 실패가 아니라 "통과"로 위장되기 때문이다.
 *
 * 정당한 사유가 있으면 해당 줄에 `check-stubs-ignore` 주석을 남긴다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const TARGET_DIRS = ['src', 'test'];
const EXTENSIONS = new Set(['.ts', '.mts', '.cts']);
const IGNORE_MARKER = 'check-stubs-ignore';

const RULES = [
  { name: '스텁 마커', pattern: /\b(TODO|FIXME|XXX|HACK)\b/ },
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

for (const dir of TARGET_DIRS) {
  for (const file of collectFiles(dir)) {
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

if (violations.length === 0) {
  console.log('check:stubs — 통과 (스텁 마커 0건, .only 0건)');
  process.exit(0);
}

console.error(`check:stubs — ${violations.length}건 발견\n`);
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.rule}]  ${v.text.slice(0, 120)}`);
}
console.error('\n머지 전에 처리하거나, 정당한 사유가 있으면 해당 줄에 check-stubs-ignore 주석을 남기세요.');
process.exit(1);
