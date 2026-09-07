import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('해시한 비밀번호를 검증한다', async () => {
    const hash = await service.hash('correct horse battery');

    await expect(service.verify('correct horse battery', hash)).resolves.toBe(true);
  });

  it('틀린 비밀번호는 거절한다', async () => {
    const hash = await service.hash('correct horse battery');

    await expect(service.verify('wrong', hash)).resolves.toBe(false);
  });

  it('같은 비밀번호도 매번 다른 해시가 된다 ⭐', async () => {
    // salt 가 고정이면 같은 비밀번호를 쓰는 계정들이 한 번에 드러난다.
    const [a, b] = await Promise.all([service.hash('same'), service.hash('same')]);

    expect(a).not.toBe(b);
  });

  it('저장 형식에 파라미터를 담는다 — 나중에 값을 올려도 옛 해시를 검증할 수 있게 ⭐', async () => {
    const hash = await service.hash('pw12345678');

    expect(hash.split('$').slice(0, 4)).toEqual(['scrypt', '16384', '8', '1']);
    expect(hash.split('$')).toHaveLength(6);
  });

  it.each([
    ['빈 문자열', ''],
    ['구분자 부족', 'scrypt$16384$8$1$salt'],
    ['다른 알고리즘', 'bcrypt$16384$8$1$c2FsdA$aGFzaA'],
    ['파라미터가 숫자가 아님', 'scrypt$x$8$1$c2FsdA$aGFzaA'],
    ['해시가 빔', 'scrypt$16384$8$1$c2FsdA$'],
  ])('형식이 깨진 해시(%s)는 던지지 않고 false 다 ⭐', async (_label, stored) => {
    // 던지면 500 이 되고, 그 500 이 곧 "이 계정의 해시가 이상하다" 는 신호가 된다.
    await expect(service.verify('anything', stored)).resolves.toBe(false);
  });
});
