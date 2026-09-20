import { HttpStatus } from '@nestjs/common';
import { loginIdSchema } from '@nerd/contracts';
import { expectDomainError } from '@common/__spec__/expect-domain-error';
import {
  type MockRepository,
  asRepository,
  createMockRepository,
} from '@common/__spec__/mock-repository';
import { createUser } from '@entities/__spec__/entity.factory';
import type { User } from '@entities/user.entity';
import type { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

function duplicateKeyError() {
  // TypeORM 이 드라이버 오류를 감싼 모양. 실 DB 없이 이 분기를 검증하려면 형태를 흉내 내야 한다.
  return Object.assign(new Error('duplicate'), {
    driverError: { errno: 1062, code: 'ER_DUP_ENTRY' },
  });
}

describe('AuthService', () => {
  let users: MockRepository<User>;
  let passwords: { hash: jest.Mock; verify: jest.Mock };
  let sessions: { issue: jest.Mock };
  let config: { get: jest.Mock };
  let cleanupHandler: jest.Mock;
  let service: AuthService;

  beforeEach(() => {
    users = createMockRepository<User>();
    passwords = { hash: jest.fn().mockResolvedValue('scrypt$hash'), verify: jest.fn() };
    sessions = { issue: jest.fn().mockReturnValue('42:9999999999999') };
    cleanupHandler = jest.fn().mockResolvedValue(undefined);
    config = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'ENV') return 'LOCAL';
        return undefined;
      }),
    };

    service = new AuthService(
      asRepository(users),
      passwords as unknown as PasswordService,
      sessions as unknown as SessionService,
      config as unknown as ConfigService,
    );
  });

  describe('signup', () => {
    it('해시해서 저장하고 세션을 만든다', async () => {
      users.save.mockResolvedValue(createUser({ id: 9 }));

      await expect(service.signup({ loginId: 'tester', password: 'pw12345678' })).resolves.toBe(
        '42:9999999999999',
      );

      expect(passwords.hash).toHaveBeenCalledWith('pw12345678');
      // 🚫 평문이 저장 경로에 들어가지 않는다.
      expect(users.save).toHaveBeenCalledWith({ loginId: 'tester', passwordHash: 'scrypt$hash' });
      expect(sessions.issue).toHaveBeenCalledWith(9);
    });

    it('아이디 중복은 409 · LOGIN_ID_TAKEN 이다 ⭐', async () => {
      // 🚫 "먼저 조회해서 없으면 저장" 으로 막지 않는다 — 동시 요청 둘이 모두 통과한다.
      //    DB UNIQUE 위반을 409 로 옮기는 이 경로가 최종 방어선이다.
      users.save.mockRejectedValue(duplicateKeyError());

      await expectDomainError(
        service.signup({ loginId: 'tester', password: 'pw12345678' }),
        'LOGIN_ID_TAKEN',
        HttpStatus.CONFLICT,
      );
    });

    it('PROD 환경에서도 기본값으로 가입이 허용된다 ⭐', async () => {
      // 2026-09-20 정책 전환 — 환경변수 누락이 곧 "가입 차단" 이 되지 않게 기본값을 열었다.
      //    차단 경로의 커버리지는 아래 `SIGNUP_ENABLED=false` 케이스가 계속 지킨다.
      config.get.mockImplementation((key: string) => {
        if (key === 'ENV') return 'PROD';
        return undefined;
      });
      users.save.mockResolvedValue(createUser({ id: 9 }));

      await expect(service.signup({ loginId: 'tester', password: 'pw12345678' })).resolves.toBe(
        '42:9999999999999',
      );
    });

    it('SIGNUP_ENABLED=false 오버라이드 시 LOCAL 환경이어도 차단된다', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'ENV') return 'LOCAL';
        if (key === 'SIGNUP_ENABLED') return 'false';
        return undefined;
      });

      await expectDomainError(
        service.signup({ loginId: 'tester', password: 'pw12345678' }),
        'SIGNUP_DISABLED',
        HttpStatus.FORBIDDEN,
      );
      expect(users.save).not.toHaveBeenCalled();
    });

    it('PROD 환경이라도 SIGNUP_ENABLED=true 오버라이드 시 가입이 허용된다', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'ENV') return 'PROD';
        if (key === 'SIGNUP_ENABLED') return 'true';
        return undefined;
      });
      users.save.mockResolvedValue(createUser({ id: 9 }));

      await expect(service.signup({ loginId: 'tester', password: 'pw12345678' })).resolves.toBe(
        '42:9999999999999',
      );
    });

    it('중복이 아닌 DB 오류는 삼키지 않는다 ⭐', async () => {
      // 모든 저장 실패를 409 로 바꾸면 진짜 장애가 "아이디 중복" 으로 위장된다.
      users.save.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.signup({ loginId: 'tester', password: 'pw12345678' })).rejects.toThrow(
        'ECONNREFUSED',
      );
    });
  });

  describe('createGuest', () => {
    /** save 에 실제로 넘어간 인자들. 닉네임이 매번 다시 뽑히는지 보려면 원본이 필요하다. */
    function savedInputs(): Partial<User>[] {
      return users.save.mock.calls.map(([input]) => input as Partial<User>);
    }

    it('입력 없이 계정을 만들고 세션을 발급한다 ⭐', async () => {
      users.save.mockResolvedValue(createUser({ id: 9 }));

      await expect(service.createGuest()).resolves.toEqual({
        sid: '42:9999999999999',
        loginId: expect.stringMatching(/^guest_[a-z0-9]{10}$/),
      });
      expect(sessions.issue).toHaveBeenCalledWith(9);
    });

    it('서버가 만든 닉네임도 사람이 만든 닉네임과 같은 규칙을 통과한다 ⭐', async () => {
      // 규칙을 벗어난 값을 서버만 예외로 저장하면, 나중에 규칙이 좁아질 때 그 계정들만 조용히 깨진다.
      users.save.mockResolvedValue(createUser({ id: 9 }));

      const { loginId } = await service.createGuest();

      expect(loginIdSchema.safeParse(loginId).success).toBe(true);
    });

    it('비밀번호는 해시만 저장하고 원문을 남기지 않는다 ⭐', async () => {
      users.save.mockResolvedValue(createUser({ id: 9 }));

      await service.createGuest();

      const plain = passwords.hash.mock.calls[0][0] as string;
      expect(plain.length).toBeGreaterThanOrEqual(32);
      expect(savedInputs()[0]).toEqual({
        loginId: expect.any(String),
        passwordHash: 'scrypt$hash',
      });
      expect(JSON.stringify(savedInputs()[0])).not.toContain(plain);
    });

    it('닉네임이 충돌하면 새로 뽑아 다시 시도한다 ⭐', async () => {
      users.save
        .mockRejectedValueOnce(duplicateKeyError())
        .mockResolvedValueOnce(createUser({ id: 9 }));

      await expect(service.createGuest()).resolves.toMatchObject({ sid: '42:9999999999999' });

      // 🚫 같은 닉네임으로 재시도하면 영원히 충돌한다 — 다시 뽑았는지가 이 재시도의 핵심이다.
      const [first, second] = savedInputs();
      expect(users.save).toHaveBeenCalledTimes(2);
      expect(first.loginId).not.toBe(second.loginId);
    });

    it('GUEST_ACCESS_ENABLED=false 면 403 · GUEST_ACCESS_DISABLED 다 ⭐', async () => {
      config.get.mockImplementation((key: string) => {
        if (key === 'GUEST_ACCESS_ENABLED') return 'false';
        return undefined;
      });

      await expectDomainError(service.createGuest(), 'GUEST_ACCESS_DISABLED', HttpStatus.FORBIDDEN);
      expect(users.save).not.toHaveBeenCalled();
    });

    it('중복이 아닌 DB 오류는 재시도하지 않고 그대로 올린다 ⭐', async () => {
      // 재시도로 감싸면 진짜 장애가 "닉네임 충돌" 로 위장되고 시도 횟수만큼 지연된다.
      users.save.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.createGuest()).rejects.toThrow('ECONNREFUSED');
      expect(users.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('select: false 인 passwordHash 를 명시적으로 가져온다 ⭐', async () => {
      // 빠뜨리면 해시가 undefined 로 와서 **모든 로그인이 실패**한다.
      users.findOne.mockResolvedValue(createUser({ id: 3, passwordHash: 'stored' }));
      passwords.verify.mockResolvedValue(true);

      await service.login({ loginId: 'tester', password: 'pw' });

      expect(users.findOne).toHaveBeenCalledWith({
        where: { loginId: 'tester' },
        select: { id: true, passwordHash: true },
      });
    });

    it('성공하면 세션을 만든다', async () => {
      users.findOne.mockResolvedValue(createUser({ id: 3 }));
      passwords.verify.mockResolvedValue(true);

      await expect(service.login({ loginId: 'tester', password: 'pw' })).resolves.toBe('42:9999999999999');
      expect(sessions.issue).toHaveBeenCalledWith(3);
    });

    it('비밀번호가 틀리면 401 · INVALID_CREDENTIALS 다', async () => {
      users.findOne.mockResolvedValue(createUser());
      passwords.verify.mockResolvedValue(false);

      await expectDomainError(
        service.login({ loginId: 'tester', password: 'wrong' }),
        'INVALID_CREDENTIALS',
        HttpStatus.UNAUTHORIZED,
      );
    });

    it('없는 아이디도 **같은 코드**로 답한다 ⭐', async () => {
      // 코드를 나누면 그 차이가 곧 "그 아이디는 존재한다" 는 신호다.
      users.findOne.mockResolvedValue(null);

      await expectDomainError(
        service.login({ loginId: 'nobody', password: 'pw' }),
        'INVALID_CREDENTIALS',
        HttpStatus.UNAUTHORIZED,
      );
    });

    it('없는 아이디에도 해시 검증을 **실제로 수행**한다 — 타이밍 오라클 방지 ⭐', async () => {
      // 응답 코드를 통일해도 "없을 때만 빠른" 응답 시간이 존재를 알려준다.
      users.findOne.mockResolvedValue(null);

      await service.login({ loginId: 'nobody', password: 'pw' }).catch(() => undefined);

      expect(passwords.verify).toHaveBeenCalledTimes(1);
      expect(passwords.verify).toHaveBeenCalledWith('pw', expect.stringMatching(/^scrypt\$/));
    });

    it('실패해도 세션을 만들지 않는다', async () => {
      users.findOne.mockResolvedValue(null);

      await service.login({ loginId: 'nobody', password: 'pw' }).catch(() => undefined);

      expect(sessions.issue).not.toHaveBeenCalled();
    });
  });

  describe('withdraw', () => {
    it('사용자가 존재하면 등록된 정리 핸들러들을 호출하고 계정을 삭제한다 ⭐', async () => {
      users.findOne.mockResolvedValue(createUser({ id: 42 }));
      service.registerCleanupHandler(cleanupHandler);

      await service.withdraw(42);

      expect(users.findOne).toHaveBeenCalledWith({ where: { id: 42 } });
      expect(cleanupHandler).toHaveBeenCalledWith(42);
      expect(users.delete).toHaveBeenCalledWith({ id: 42 });
    });

    it('사용자가 존재하지 않으면 정리 핸들러나 계정 삭제를 수행하지 않는다', async () => {
      users.findOne.mockResolvedValue(null);
      service.registerCleanupHandler(cleanupHandler);

      await service.withdraw(999);

      expect(cleanupHandler).not.toHaveBeenCalled();
      expect(users.delete).not.toHaveBeenCalled();
    });
  });

  // 🚫 로그아웃 테스트가 없다. 서버측 세션 상태가 없어 AuthService 가 하는 일이 없다 —
  //    쿠키 삭제는 컨트롤러의 일이고 E2E 가 고정한다.
});
