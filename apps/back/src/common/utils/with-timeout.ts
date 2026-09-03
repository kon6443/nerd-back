/**
 * 프로미스에 시간 제한을 건다. 초과하면 `label` 을 담은 Error 로 reject 한다.
 *
 * 원래 프로미스는 취소되지 않는다 — 나중에 settle 되어도 `Promise.race` 가 이미 핸들러를 붙여 두었으므로
 * unhandled rejection 이 되지 않는다.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} ${ms}ms 초과`)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
