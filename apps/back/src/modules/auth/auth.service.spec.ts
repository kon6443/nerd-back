import { HttpStatus } from '@nestjs/common';
import { expectDomainError } from '@common/__spec__/expect-domain-error';
import {
  type MockRepository,
  asRepository,
  createMockRepository,
} from '@common/__spec__/mock-repository';
import { createUser } from '@entities/__spec__/entity.factory';
import type { User } from '@entities/user.entity';
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
  let sessions: { create: jest.Mock; destroy: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    users = createMockRepository<User>();
    passwords = { hash: jest.fn().mockResolvedValue('scrypt$hash'), verify: jest.fn() };
    sessions = { create: jest.fn().mockResolvedValue('sid-1'), destroy: jest.fn() };

    service = new AuthService(
      asRepository(users),
      passwords as unknown as PasswordService,
      sessions as unknown as SessionService,
    );
  });

  describe('signup', () => {
    it('해시해서 저장하고 세션을 만든다', async () => {
      users.save.mockResolvedValue(createUser({ id: 9 }));

      await expect(service.signup({ loginId: 'tester', password: 'pw12345678' })).resolves.toBe(
        'sid-1',
      );

      expect(passwords.hash).toHaveBeenCalledWith('pw12345678');
      // 🚫 평문이 저장 경로에 들어가지 않는다.
      expect(users.save).toHaveBeenCalledWith({ loginId: 'tester', passwordHash: 'scrypt$hash' });
      expect(sessions.create).toHaveBeenCalledWith(9);
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

    it('중복이 아닌 DB 오류는 삼키지 않는다 ⭐', async () => {
      // 모든 저장 실패를 409 로 바꾸면 진짜 장애가 "아이디 중복" 으로 위장된다.
      users.save.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.signup({ loginId: 'tester', password: 'pw12345678' })).rejects.toThrow(
        'ECONNREFUSED',
      );
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

      await expect(service.login({ loginId: 'tester', password: 'pw' })).resolves.toBe('sid-1');
      expect(sessions.create).toHaveBeenCalledWith(3);
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

      expect(sessions.create).not.toHaveBeenCalled();
    });
  });

  it('로그아웃은 세션을 파기한다', async () => {
    await service.logout('sid-1');

    expect(sessions.destroy).toHaveBeenCalledWith('sid-1');
  });
});
