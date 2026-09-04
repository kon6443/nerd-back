import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { API_PREFIX } from '@common/constants/app.constants';
import { REDIS_CLIENT } from '@common/redis/redis.module';
import { AuthGuard } from '@common/guards/auth.guard';
import { User } from '@entities/user.entity';
import { AuthController } from '@modules/auth/auth.controller';
import { AuthService } from '@modules/auth/auth.service';
import { PasswordService } from '@modules/auth/password.service';
import { SessionService } from '@modules/auth/session.service';
import { createE2eApp } from './helpers/e2e-app';

function server(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

/**
 * Redis·DB 를 **메모리로 대체**해 가입 → 쿠키 → 인증까지 한 흐름으로 검증한다.
 * 스텁이 아니라 흐름이 목적이라 상태를 실제로 들고 있게 만든다.
 */
function createStores() {
  const redis = new Map<string, string>();
  const rows: User[] = [];
  let nextId = 1;

  return {
    redis: {
      ping: () => Promise.resolve('PONG'),
      set: (k: string, v: string) => Promise.resolve(redis.set(k, v) && 'OK'),
      get: (k: string) => Promise.resolve(redis.get(k) ?? null),
      del: (k: string) => Promise.resolve(redis.delete(k) ? 1 : 0),
    },
    users: {
      save: (input: Partial<User>) => {
        // DB UNIQUE 제약을 흉내 낸다 — 앱이 그 위반을 409 로 옮기는 경로를 검증하려면 필요하다.
        if (rows.some((r) => r.loginId === input.loginId)) {
          return Promise.reject(
            Object.assign(new Error('duplicate'), { driverError: { errno: 1062 } }),
          );
        }
        const row = { ...input, id: nextId++, createdAt: new Date() } as User;
        rows.push(row);
        return Promise.resolve(row);
      },
      findOne: ({ where }: { where: { loginId: string } }) =>
        Promise.resolve(rows.find((r) => r.loginId === where.loginId) ?? null),
      findOneBy: ({ id }: { id: number }) => Promise.resolve(rows.find((r) => r.id === id) ?? null),
    },
    rowCount: () => rows.length,
  };
}

const SIGNUP = { loginId: 'tester', password: 'pw12345678' };

describe('인증 (E2E)', () => {
  let app: INestApplication;
  let stores: ReturnType<typeof createStores>;

  beforeEach(async () => {
    stores = createStores();
    app = await createE2eApp({
      controllers: [AuthController],
      providers: [
        AuthService,
        PasswordService,
        SessionService,
        AuthGuard,
        { provide: ConfigService, useValue: { get: () => 'LOCAL' } },
        { provide: REDIS_CLIENT, useValue: stores.redis },
        { provide: getRepositoryToken(User), useValue: stores.users },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  /** ⚠️ `async` 를 붙이지 않는다 — Promise 로 감싸면 supertest 의 `.expect()` 체이닝이 끊긴다. */
  function signup() {
    return request(server(app)).post(`/${API_PREFIX}/auth/signup`).send(SIGNUP);
  }

  describe('가입', () => {
    it('201 로 만들고 httpOnly 세션 쿠키를 심는다 ⭐', async () => {
      const res = await signup().expect(201);

      expect(res.body).toEqual({ code: 'SUCCESS', data: { loginId: 'tester' }, message: '' });

      const cookie = res.headers['set-cookie'][0];
      // 🚫 httpOnly 가 빠지면 XSS 하나로 세션이 통째로 털린다.
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      // 로컬(ENV=LOCAL)은 http 라 Secure 를 켜면 쿠키가 아예 안 실린다.
      expect(cookie).not.toContain('Secure');
    });

    it('응답에 비밀번호 흔적이 없다 ⭐', async () => {
      const res = await signup();

      expect(JSON.stringify(res.body)).not.toContain('password');
      expect(JSON.stringify(res.body)).not.toContain('scrypt');
    });

    it('짧은 비밀번호는 400 · VALIDATION_FAILED 다', async () => {
      const res = await request(server(app))
        .post(`/${API_PREFIX}/auth/signup`)
        .send({ loginId: 'tester', password: 'short' })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(stores.rowCount()).toBe(0);
    });

    it('아이디 중복은 409 다', async () => {
      await signup().expect(201);

      const res = await signup().expect(409);
      expect(res.body.code).toBe('LOGIN_ID_TAKEN');
    });
  });

  describe('로그인', () => {
    it('성공하면 200 과 쿠키를 준다', async () => {
      await signup();

      const res = await request(server(app))
        .post(`/${API_PREFIX}/auth/login`)
        .send(SIGNUP)
        .expect(200);

      expect(res.body.data).toEqual({ loginId: 'tester' });
      expect(res.headers['set-cookie'][0]).toContain('HttpOnly');
    });

    it.each([
      ['비밀번호가 틀림', { loginId: 'tester', password: 'wrongpassword' }],
      ['없는 아이디', { loginId: 'nobody', password: 'pw12345678' }],
    ])('%s → 401 · 같은 코드 ⭐', async (_label, body) => {
      // 코드가 갈리면 그 차이가 곧 계정 존재 여부다.
      await signup();

      const res = await request(server(app)).post(`/${API_PREFIX}/auth/login`).send(body).expect(401);

      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /auth/me', () => {
    it('쿠키 없이는 401 이다', async () => {
      const res = await request(server(app)).get(`/${API_PREFIX}/auth/me`).expect(401);

      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('세션 쿠키로 200 이다 ⭐', async () => {
      // 이게 통과해야 @CurrentUser() 가 전역 파이프에 막히지 않는다는 뜻이다 —
      // strictSchemaDeclaration 예외가 없으면 여기서 500 이 난다.
      const created = await signup();
      const cookie = created.headers['set-cookie'];

      const res = await request(server(app))
        .get(`/${API_PREFIX}/auth/me`)
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.data).toEqual({ loginId: 'tester' });
    });

    it('위조한 쿠키는 401 이다', async () => {
      const res = await request(server(app))
        .get(`/${API_PREFIX}/auth/me`)
        .set('Cookie', ['sid=made-up-value'])
        .expect(401);

      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('로그아웃', () => {
    it('204 를 주고 세션을 무효화한다 ⭐', async () => {
      const created = await signup();
      const cookie = created.headers['set-cookie'];

      await request(server(app))
        .post(`/${API_PREFIX}/auth/logout`)
        .set('Cookie', cookie)
        .expect(204);

      // 같은 쿠키로 다시 접근하면 이제 막혀야 한다.
      await request(server(app)).get(`/${API_PREFIX}/auth/me`).set('Cookie', cookie).expect(401);
    });

    it('쿠키 없이도 204 다 — 멱등이라 재시도가 안전하다', async () => {
      await request(server(app)).post(`/${API_PREFIX}/auth/logout`).expect(204);
    });
  });
});
