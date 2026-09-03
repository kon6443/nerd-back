import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { API_PREFIX, DOCS_PATH, HEALTH_PATH, LOG_IGNORED_PATHS, READY_PATH } from './app.constants';

const HEALTHCHECK_SCRIPT = join(__dirname, '../../../scripts/healthcheck.mjs');

describe('app.constants', () => {
  describe('경로 파생', () => {
    it('모든 경로가 API_PREFIX 에서 파생된다', () => {
      expect(HEALTH_PATH).toBe(`/${API_PREFIX}/health`);
      expect(READY_PATH).toBe(`/${API_PREFIX}/health/ready`);
      expect(DOCS_PATH).toBe(`/${API_PREFIX}/docs`);
    });

    it('로그 제외 목록에 헬스체크와 문서 경로가 모두 들어 있다', () => {
      expect(LOG_IGNORED_PATHS).toEqual(
        expect.arrayContaining([HEALTH_PATH, READY_PATH, DOCS_PATH]),
      );
    });
  });

  /**
   * scripts/healthcheck.mjs 는 TS 빌드 밖의 독립 스크립트라 이 상수를 import 할 수 없다.
   * 그래서 경로가 리터럴로 중복되어 있고, 그게 드리프트 지점이다.
   *
   * prefix 를 바꾸고 스크립트를 잊으면 Swarm healthcheck 가 404 를 받아 컨테이너를
   * unhealthy 로 판정하고, 재시작 루프에 빠지며 롤링 업데이트가 롤백된다.
   * 리터럴을 없애는 대신(헬스체크는 의존이 적어야 한다) 여기서 대조해 CI 에서 잡는다.
   */
  describe('scripts/healthcheck.mjs 와의 정합성 ⭐', () => {
    const source = readFileSync(HEALTHCHECK_SCRIPT, 'utf8');

    it('스크립트가 HEALTH_PATH 와 같은 경로를 찌른다', () => {
      const match = /const PATH = '([^']+)'/.exec(source);

      expect(match).not.toBeNull();
      expect(match?.[1]).toBe(HEALTH_PATH);
    });

    it('스크립트가 readiness 를 찌르지 않는다 — 외부 의존 검사는 배포를 막는다', () => {
      expect(source).not.toContain(READY_PATH);
    });
  });
});
