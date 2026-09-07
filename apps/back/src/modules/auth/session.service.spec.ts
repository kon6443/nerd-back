import { Redis } from 'ioredis';
import { SESSION_TTL_SECONDS, SessionService } from './session.service';

function createRedis() {
  return { set: jest.fn(), get: jest.fn(), del: jest.fn() };
}

describe('SessionService', () => {
  let redis: ReturnType<typeof createRedis>;
  let service: SessionService;

  beforeEach(() => {
    redis = createRedis();
    service = new SessionService(redis as unknown as Redis);
  });

  describe('create', () => {
    it('TTL 과 함께 저장한다', async () => {
      await service.create(7);

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^sess:/),
        '7',
        'EX',
        SESSION_TTL_SECONDS,
      );
    });

    it('세션 id 가 매번 다르다 ⭐', async () => {
      const [a, b] = await Promise.all([service.create(1), service.create(1)]);

      expect(a).not.toBe(b);
      // 32바이트를 base64url 로 — 추측 가능한 길이가 아니어야 한다.
      expect(a.length).toBeGreaterThanOrEqual(40);
    });
  });

  describe('resolveUserId', () => {
    it('저장된 사용자 id 를 돌려준다', async () => {
      redis.get.mockResolvedValue('7');

      await expect(service.resolveUserId('sid')).resolves.toBe(7);
    });

    it('없는 세션은 null 이다', async () => {
      redis.get.mockResolvedValue(null);

      await expect(service.resolveUserId('sid')).resolves.toBeNull();
    });

    it('숫자가 아닌 값은 null 이다', async () => {
      redis.get.mockResolvedValue('not-a-number');

      await expect(service.resolveUserId('sid')).resolves.toBeNull();
    });

    it('Redis 장애면 **거절한다** — fail-closed ⭐', async () => {
      // 레이트리밋은 fail-open 이지만 인증은 반대다. 이 방향이 뒤집히면
      // Redis 장애가 곧 전면 인증 우회가 된다.
      redis.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.resolveUserId('sid')).resolves.toBeNull();
    });
  });

  describe('destroy', () => {
    it('키를 지운다', async () => {
      await service.destroy('sid');

      expect(redis.del).toHaveBeenCalledWith('sess:sid');
    });

    it('Redis 장애여도 던지지 않는다 — 로그아웃 응답까지 실패시키지 않는다', async () => {
      redis.del.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.destroy('sid')).resolves.toBeUndefined();
    });
  });
});
