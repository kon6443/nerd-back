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

/**
 * 신뢰할 리버스 프록시 홉 수 (`app.set('trust proxy', ...)`).
 *
 * **레이트리밋 키가 이 값에 달려 있다.** `req.ip` 는 이 숫자만큼의 홉을 신뢰해 건너뛰고
 * 나머지 중 가장 오른쪽 주소를 고른다. 프록시(Caddy)는 `X-Forwarded-For` 를 덮어쓰지 않고
 * **뒤에 붙이므로**, 이 값이 맞아야 위조된 앞쪽 값을 무시할 수 있다.
 *
 * ⚠️ 앞에 CDN 을 추가하면 이 숫자를 늘린다. 안 늘리면 스푸핑이 다시 열린다.
 * ⚠️ **프로덕션과 모든 E2E 앱이 이 상수를 쓴다.** 한쪽만 다르면 `req.ip` 가 다르게 계산되어
 *    테스트가 프로덕션과 다른 규칙을 검증한다 (실측: 미설정 시 `::ffff:127.0.0.1`).
 *    전역 ValidationPipe 를 공유하는 것과 같은 이유다.
 */
export const TRUST_PROXY_HOPS = 1;

/** 성공 응답의 code 값. 컨트롤러가 객체 리터럴로 직접 반환한다. */
export const SUCCESS_CODE = 'SUCCESS';
