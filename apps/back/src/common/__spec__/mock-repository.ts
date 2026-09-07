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
 * `find` · `findOne` · `findOneBy` · `countBy` · `save`). 🚫 `Repository<T>` 의 표면을 미리 흉내 내지
 * 않는다 — 쓰지 않는 스텁은 "이 스텁으로 뭘 검증할 수 있나"를 흐린다.
 *
 * 필요해지면 **두 곳(타입·팩토리)에 한 줄씩** 추가한다.
 */
interface MockedMethods {
  find: jest.Mock;
  findOne: jest.Mock;
  findOneBy: jest.Mock;
  countBy: jest.Mock;
  save: jest.Mock;
}

export type MockRepository<T extends ObjectLiteral> = MockedMethods & Partial<Repository<T>>;

export function createMockRepository<T extends ObjectLiteral>(): MockRepository<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    countBy: jest.fn(),
    save: jest.fn(),
  };
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
