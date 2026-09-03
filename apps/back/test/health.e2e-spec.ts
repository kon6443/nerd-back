import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { HEALTH_PATH, READY_PATH } from '@common/constants/app.constants';
import { createE2eApp } from './helpers/e2e-app';

function server(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

describe('헬스체크 (E2E)', () => {
  describe('liveness — 외부 의존과 무관하게 200 이어야 한다', () => {
    let app: INestApplication;

    afterEach(async () => {
      await app.close();
    });

    it('Redis 가 정상이면 200', async () => {
      app = await createE2eApp();

      const res = await request(server(app)).get(HEALTH_PATH).expect(200);

      expect(res.body).toMatchObject({ status: 'ok' });
    });

    it('Redis 가 죽어도 200 이다 ⭐', async () => {
      // 이게 이 엔드포인트의 존재 이유다. Swarm healthcheck 가 이 경로를 보므로
      // 외부 의존 장애로 200 이 깨지면 컨테이너가 재시작 루프에 빠지고 배포가 롤백된다.
      app = await createE2eApp({
        redisPing: () => Promise.reject(new Error('연결 거부')),
      });

      const res = await request(server(app)).get(HEALTH_PATH).expect(200);

      expect(res.body).toMatchObject({ status: 'ok' });
    });

    it('DB 가 죽어도 200 이다 ⭐', async () => {
      // DB 는 핵심 의존이지만 liveness 에는 넣지 않는다. 넣으면 DB 재시작 30초에 앱 3개가
      // 재시작되고, 배포 중이면 롤백된다 (CLAUDE.md Never).
      app = await createE2eApp({
        dbQuery: () => Promise.reject(new Error('ECONNREFUSED')),
      });

      const res = await request(server(app)).get(HEALTH_PATH).expect(200);

      expect(res.body).toMatchObject({ status: 'ok' });
    });
  });

  describe('readiness — 외부 의존을 반영한다', () => {
    let app: INestApplication;

    afterEach(async () => {
      await app.close();
    });

    it('Redis 가 정상이면 200 이고 redis up 을 보고한다', async () => {
      app = await createE2eApp();

      const res = await request(server(app)).get(READY_PATH).expect(200);

      expect(res.body).toMatchObject({
        status: 'ok',
        details: { redis: { status: 'up' }, db: { status: 'up' } },
      });
    });

    it('DB 가 죽으면 503 이고 db down 과 사유를 담는다', async () => {
      app = await createE2eApp({
        dbQuery: () => Promise.reject(new Error('ECONNREFUSED')),
      });

      const res = await request(server(app)).get(READY_PATH).expect(503);

      expect(res.body).toMatchObject({
        status: 'error',
        details: { db: { status: 'down', message: 'ECONNREFUSED' } },
      });
    });

    it('DB 핑이 매달리면 시간 제한으로 down 처리한다', async () => {
      app = await createE2eApp({ dbQuery: () => new Promise(() => undefined) });

      const res = await request(server(app)).get(READY_PATH).expect(503);

      expect(res.body).toMatchObject({ details: { db: { status: 'down' } } });
      expect(res.body.details.db.message).toMatch(/초과/);
    }, 10_000);

    it('Redis 가 죽으면 503 이고 사유를 담는다', async () => {
      app = await createE2eApp({
        redisPing: () => Promise.reject(new Error('연결 거부')),
      });

      const res = await request(server(app)).get(READY_PATH).expect(503);

      expect(res.body).toMatchObject({
        status: 'error',
        details: { redis: { status: 'down', message: '연결 거부' } },
      });
    });

    it('PONG 이 아닌 응답도 down 으로 본다', async () => {
      app = await createE2eApp({ redisPing: () => Promise.resolve('WEIRD') });

      const res = await request(server(app)).get(READY_PATH).expect(503);

      expect(res.body).toMatchObject({ details: { redis: { status: 'down' } } });
    });
  });
});
