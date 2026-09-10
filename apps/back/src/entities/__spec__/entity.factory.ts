import { StoryCharacter } from '../story-character.entity';
import { StoryPageCharacter } from '../story-page-character.entity';
import { StoryPage } from '../story-page.entity';
import { STORY_TEMPLATE_STATUS, StoryTemplate } from '../story-template.entity';
import { User } from '../user.entity';

/**
 * 엔티티 팩토리.
 *
 * spec 마다 객체 리터럴을 손으로 만들면 **컬럼 하나를 추가할 때 여러 spec 이 동시에 깨진다.**
 * 여기 4원칙을 지킨다.
 *
 * 1. **관계 프로퍼티는 `UNSET`** — 접근하면 터지는 게 의도다. 로드하지 않은 관계를 테스트가
 *    쓰고 있으면 즉시 드러난다.
 * 2. **시각은 `FIXED_DATE`** — 현재 시각을 쓰면 결과가 실행 시점에 따라 흔들린다.
 * 3. 🚫 **엔티티 전체를 캐스팅하지 않는다**(`{...} as Entity`). 필드가 빠져도 컴파일러가 못 잡는다.
 *    아래 팩토리들은 캐스팅 없이 타입을 만족한다 — 컬럼이 늘면 **여기서 먼저 깨진다.**
 * 4. 차이는 `overrides` 로만 표현한다.
 *
 * 🚫 커버리지 분모에서 제외된다 (`__spec__/`).
 */

/**
 * 로드하지 않은 관계. **접근하면 `undefined` 라 즉시 터진다** — 그게 목적이다.
 * 관계가 필요한 테스트는 `overrides` 로 명시해 "이 테스트는 이 관계를 쓴다"를 드러낸다.
 */
const UNSET = undefined as never;

/** 고정 시각. 🚫 `new Date()` 를 쓰지 않는다. */
export const FIXED_DATE = new Date('2026-01-01T00:00:00.000Z');

export const createStoryTemplate = (overrides: Partial<StoryTemplate> = {}): StoryTemplate => ({
  id: 1,
  slug: 'little-red-riding-hood',
  title: '빨간 모자',
  summary: '숲을 지나 할머니 댁으로',
  coverImageKey: 'covers/lrrh.png',
  status: STORY_TEMPLATE_STATUS.PUBLISHED,
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  ...overrides,
});

export const createStoryPage = (overrides: Partial<StoryPage> = {}): StoryPage => ({
  id: 31,
  templateId: 1,
  template: UNSET,
  pageNo: 1,
  branchKey: 'common',
  bodyText: '늑대가 숲에서 빨간 모자를 만났습니다.',
  baseImageKey: 'pages/lrrh-1.png',
  personaTargetRole: 'protagonist',
  illustrationPrompt: null,
  ...overrides,
});

export const createStoryCharacter = (overrides: Partial<StoryCharacter> = {}): StoryCharacter => ({
  id: 11,
  templateId: 1,
  template: UNSET,
  role: 'wolf',
  displayName: '늑대',
  // 🚫 엔티티에서 `select: false` 라 조회 결과에는 담기지 않는다. 팩토리는 저장 시점의
  //    전체 모습을 만들므로 값을 갖되, **응답에 새지 않는지**는 서비스 spec 이 본다.
  persona: '능글맞고 말이 많다.',
  ...overrides,
});

export const createStoryPageCharacter = (
  overrides: Partial<StoryPageCharacter> = {},
): StoryPageCharacter => ({
  id: 101,
  pageId: 31,
  page: UNSET,
  characterId: 11,
  character: UNSET,
  hitbox: { x: 0.4, y: 0.55, width: 0.2, height: 0.3 },
  ...overrides,
});

export const createUser = (overrides: Partial<User> = {}): User => ({
  id: 1,
  loginId: 'tester',
  // 실제 해시와 **같은 형식**을 쓴다. 그럴듯한 문자열이 아니라 형식이 맞아야
  // 파싱 경로를 지나는 테스트가 의미를 갖는다.
  passwordHash: 'scrypt$16384$8$1$00000000000000000000000000000000$0000',
  createdAt: FIXED_DATE,
  ...overrides,
});
