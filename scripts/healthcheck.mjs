#!/usr/bin/env node
/**
 * 컨테이너 헬스체크. Swarm 의 healthcheck 가 이 스크립트를 실행한다.
 *
 * curl 을 쓰지 않는 이유: slim 베이스 이미지에 curl 이 없고, 그것만을 위해
 * apt 레이어를 추가하면 이미지가 커진다. Node 는 어차피 있다.
 *
 * ⚠️ **liveness 경로만 찌른다.** 외부 의존을 검사하는 readiness 를 여기에 쓰면
 * Redis·DB 장애가 컨테이너를 unhealthy 로 만들어 재시작 루프와 배포 롤백을 유발한다.
 */
import { get } from 'node:http';

const PORT = Number(process.env.PORT ?? 5501);
const PATH = '/api/v1/health';
const TIMEOUT_MS = 4000;

const request = get({ host: '127.0.0.1', port: PORT, path: PATH, timeout: TIMEOUT_MS }, (res) => {
  // 본문을 소비하지 않으면 소켓이 열린 채로 남는다.
  res.resume();
  process.exit(res.statusCode === 200 ? 0 : 1);
});

request.on('timeout', () => {
  request.destroy();
  process.exit(1);
});

request.on('error', () => process.exit(1));
