/**
 * 테스트 프로세스의 타임존이 정말 UTC 인지 **검증**한다 — 고정은 여기서 하지 않는다.
 *
 * ⚠️ setupFiles 는 jest 샌드박스 안에서 돈다. 여기서 `process.env.TZ` 를 대입하면 샌드박스의
 *    env 복사본에만 쓰여 V8 의 타임존은 바뀌지 않는다 (2026-09-02 실측: 대입 후에도
 *    `getHours` 9 · Intl `'Asia/Seoul'`). 이 파일이 원래 그 방식이었고, 문서에는 ✅ 로 적혀 있었다.
 *
 *    고정은 워커를 띄우기 전인 `jest.config.js` · `test/jest-e2e.js` **상단**에서 한다.
 *    이 파일은 그 고정이 깨지면 모든 테스트를 첫 줄에서 실패시켜, 날짜 테스트가 KST 로
 *    조용히 통과하는 일을 막는다. (test/ 에서는 로컬 TZ 메서드 린트가 꺼져 있다.)
 */
const offsetMinutes = new Date(0).getTimezoneOffset();
if (offsetMinutes !== 0) {
  throw new Error(
    `테스트 프로세스 타임존이 UTC 가 아니다 (offset ${offsetMinutes}분). ` +
      'jest.config.js / test/jest-e2e.js 상단의 process.env.TZ 고정을 확인하세요.',
  );
}

export {};
