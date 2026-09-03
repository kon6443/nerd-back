/**
 * 프로세스 타임존을 부팅 최초에 UTC 로 고정한다.
 *
 * `Dockerfile` 의 `ENV TZ=UTC` 는 컨테이너를, `test/setup/setup-tz.ts` 는 jest 를 덮지만,
 * 개발자 노트북에서 `pnpm dev` 로 띄운 프로세스는 로컬(KST)로 뜬다. 여기서 한 번 더 고정해
 * 로컬·CI·컨테이너가 같은 답을 내게 한다. Node 13+ 는 런타임 `process.env.TZ` 변경을 반영한다
 * (2026-09-02 Node 22.21 실측: 대입 전 `new Date(0).getHours()` 9 → 후 0).
 *
 * ⚠️ `main.ts` 의 **첫 import** 여야 한다. 다른 모듈이 로드되기 전에 실행되어야
 *    모듈 초기화 시점에 Date 를 만드는 라이브러리까지 UTC 로 잡힌다.
 */
process.env.TZ = 'UTC';

export {};
