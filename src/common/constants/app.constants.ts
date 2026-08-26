/**
 * 전역 라우트 prefix. Swagger·헬스체크 경로 계산의 기준이다.
 *
 * ⚠️ 이 값을 바꾸면 `scripts/healthcheck.mjs` 의 경로도 함께 바꿔야 한다.
 *    그 스크립트는 TS 빌드 밖이라 이 상수를 import 할 수 없다.
 *    불일치를 막기 위해 `app.constants.spec.ts` 가 두 값을 대조한다.
 *
 * `api/v2` 인 이유: 지금은 이웃 프로젝트와 도메인을 공유하므로 경로 네임스페이스가
 * 겹치지 않아야 한다. 전용 도메인으로 분리하면 재검토한다.
 */
export const API_PREFIX = 'api/v2';

/** liveness — 외부 의존을 검사하지 않는다. Swarm healthcheck 와 리버스 프록시가 이 경로를 본다. */
export const HEALTH_PATH = `/${API_PREFIX}/health`;

/** readiness — 외부 의존(Redis 등)을 검사한다. 진단·수동 확인용. */
export const READY_PATH = `${HEALTH_PATH}/ready`;

export const DOCS_PATH = `/${API_PREFIX}/docs`;

/**
 * 로그를 남기지 않는 경로.
 * 헬스체크는 10~30초 간격으로 폴링되므로 그대로 두면 로그가 이것들로만 채워진다.
 */
export const LOG_IGNORED_PATHS: readonly string[] = [HEALTH_PATH, READY_PATH, DOCS_PATH];

/** 성공 응답의 code 값. 컨트롤러가 객체 리터럴로 직접 반환한다. */
export const SUCCESS_CODE = 'SUCCESS';
