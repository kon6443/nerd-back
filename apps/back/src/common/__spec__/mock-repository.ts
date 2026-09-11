import type { ObjectLiteral, Repository } from 'typeorm';

/**
 * TypeORM `Repository` 스텁.
 *
 * 서비스가 `@InjectRepository` 로 리포지토리를 직접 주입받으므로(code-patterns §1) 거의 모든
 * 서비스 spec 이 같은 스텁을 만든다. spec 마다 따로 두면 **메서드 하나를 새로 쓸 때마다 여러
 * 파일을 고치게 된다.**
 *
 * 🚫 커버리지 분모에서 제외된다 (`__spec__/`). 프로덕션 코드가 아니다.
 */

/**
 * 스텁이 제공하는 메서드. **지금 spec 이 실제로 호출하는 것만 둔다** (2026-09-04 실측:
 * `find` · `findOne` · `findOneBy` · `countBy` · `save` · `delete`). 🚫 `Repository<T>` 의 표면을 미리 흉내 내지
 * 않는다 — 쓰지 않는 스텁은 "이 스텁으로 뭘 검증할 수 있나"를 흐린다.
 *
 * 필요해지면 **두 곳(타입·팩토리)에 한 줄씩** 추가한다.
 */
interface MockedMethods {
  create: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  findOneBy: jest.Mock;
  countBy: jest.Mock;
  save: jest.Mock;
  delete: jest.Mock;
  createQueryBuilder: jest.Mock;
}

export type MockRepository<T extends ObjectLiteral> = MockedMethods & Partial<Repository<T>>;

export function createMockRepository<T extends ObjectLiteral>(): MockRepository<T> {
  return {
    create: jest.fn((entity?: unknown) => entity ?? {}) as unknown as jest.Mock,
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    countBy: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    // 기본값은 "1행을 집었다" — 조건부 UPDATE 를 쓰지 않는 spec 의 동작을 바꾸지 않는다.
    createQueryBuilder: jest.fn(() => mockUpdateQueryBuilder(1)) as unknown as jest.Mock,
  };
}

/**
 * `createQueryBuilder().update()…execute()` 체이닝 스텁.
 *
 * 조건부 UPDATE 로 동시성을 제어하는 코드(`StorySessionService.claimPage` 등)는
 * **`affected` 행 수가 곧 "내가 집었는가" 의 답**이다. 그 분기를 spec 에서 직접 조종하려면
 * 빌더를 흉내 내야 한다.
 */
export interface MockUpdateQueryBuilder {
  update: jest.Mock;
  set: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  execute: jest.Mock;
}

export function mockUpdateQueryBuilder(affected: number): MockUpdateQueryBuilder {
  // 타입을 명시해야 한다 — 체이닝이라 `builder` 가 자기 초기화식을 참조해 추론이 any 로 떨어진다.
  const builder: MockUpdateQueryBuilder = {
    update: jest.fn(() => builder),
    set: jest.fn(() => builder),
    where: jest.fn(() => builder),
    andWhere: jest.fn(() => builder),
    execute: jest.fn(() => Promise.resolve({ affected })),
  };
  return builder;
}

/**
 * 스텁을 서비스 생성자에 넘길 때 쓴다.
 *
 * 이중 캐스팅(`as unknown as Repository<T>`)을 spec 마다 반복하지 않기 위한 것이다 —
 * 주입 지점이 4개면 그 캐스팅도 4번 나온다.
 */
export function asRepository<T extends ObjectLiteral>(mock: MockRepository<T>): Repository<T> {
  return mock as unknown as Repository<T>;
}
