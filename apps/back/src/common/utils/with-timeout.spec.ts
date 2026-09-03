import { withTimeout } from './with-timeout';

describe('withTimeout', () => {
  it('제한 안에 끝나면 값을 그대로 돌려준다', async () => {
    await expect(withTimeout(Promise.resolve(42), 100, 'x')).resolves.toBe(42);
  });

  it('제한을 넘기면 label 을 담아 reject 한다', async () => {
    const never = new Promise<number>(() => undefined);

    await expect(withTimeout(never, 10, 'DB 핑')).rejects.toThrow('DB 핑 10ms 초과');
  });

  it('원래 프로미스의 실패는 그대로 전달한다', async () => {
    await expect(withTimeout(Promise.reject(new Error('원인')), 100, 'x')).rejects.toThrow('원인');
  });
});
