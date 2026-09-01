/**
 * liveness — 프로세스가 살아 요청을 처리할 수 있는가만 본다.
 *
 * 🚫 **외부 의존을 검사하지 않는다.** 백엔드 API·Redis 같은 것을 여기서 확인하면
 *    그쪽 장애가 이 컨테이너를 unhealthy 로 만들어 재시작 루프에 빠지고,
 *    stack YAML 의 `failure_action: rollback` 이 배포까지 되돌린다.
 *    앱은 멀쩡한데 배포가 막히는 상황이 된다.
 *
 * Swarm 의 healthcheck 와 리버스 프록시가 이 경로를 본다.
 * ⚠️ 경로를 옮기면 `scripts/healthcheck.mjs` 의 PATH 도 함께 바꿔야 한다 —
 *    `scripts/check-health-path.mjs` 가 두 값의 대응을 CI 에서 고정한다.
 *
 * ⚠️ **경로가 `/api/` 로 시작한다.** 같은 도메인에서 Caddy 가 `/api/v2/*` 를
 *    백엔드로 분기하므로 지금은 겹치지 않는다. 하지만 그 규칙이 `/api/*` 로
 *    넓어지면 이 헬스체크가 **백엔드로 흘러가** 프론트 컨테이너가 영원히
 *    unhealthy 가 된다. Caddy matcher 는 반드시 `/api/v2/*` 로 좁게 유지한다.
 */

/**
 * 정적 프리렌더를 막는다.
 *
 * route handler 가 정적으로 굳으면 **앱이 반쯤 죽어도 캐시된 200 이 나간다.**
 * liveness 는 핸들러가 실제로 실행되는 것 자체가 신호이므로 매 요청 평가해야 한다.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "ok" },
    {
      /**
       * 중간 캐시가 이 응답을 보관하면 **이미 죽은 인스턴스가 살아 보인다.**
       * `force-dynamic` 은 서버의 렌더 방식만 정하고 캐시 헤더를 보장하지 않아
       * (2026-09-01 실측: 헤더가 비어 있었다) 여기서 직접 못 박는다.
       */
      headers: { "cache-control": "no-store" },
    },
  );
}
