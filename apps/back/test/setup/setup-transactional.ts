/**
 * `@Transactional()` 의 컨텍스트 저장소를 테스트 프로세스에서도 초기화한다.
 *
 * `reflect-metadata` 와 같은 사유다 — `main.ts` 에서만 `initializeTransactionalContext()` 를
 * 부르면 테스트에서는 로드되지 않아, 데코레이터가 붙은 메서드가
 * "No storage driver defined in your app" 으로 터진다 (2026-09-11 실측).
 *
 * ⚠️ `jest.config.js` 와 `test/jest-e2e.js` **양쪽** setupFiles 에 있어야 한다.
 *    한쪽만 있으면 그쪽 테스트만 통과하고 다른 쪽이 조용히 깨진다 (forbid-db 와 같은 규율).
 */
import { StorageDriver, initializeTransactionalContext } from 'typeorm-transactional';

initializeTransactionalContext({ storageDriver: StorageDriver.ASYNC_LOCAL_STORAGE });

export {};
