import type { StoryCharacterHitbox } from '@nerd/contracts';

/**
 * 개발용 더미 동화 — **자체 창작**이다.
 *
 * 왜 있는가: 저작권(D5)이 열려 있어 실제 동화를 넣을 수 없는데, 프론트·백은 그 전에
 * 「서재 → 상세 → 리더」 전 플로우를 끝까지 돌려 봐야 한다. 실제 동화가 아니므로 저작권 무관이고,
 * D5 가 풀리면 이 픽스처는 그대로 두고 실 콘텐츠를 따로 넣는다.
 *
 * 🚫 **이 데이터를 마이그레이션에 넣지 않는다.** 마이그레이션은 스키마만 다룬다 —
 * 픽스처가 섞이면 상용에도 들어가고, 되돌릴 방법이 스키마 롤백밖에 없어진다.
 *
 * 데이터를 러너(`seed-dev-fixture.ts`)와 분리한 이유: **DB 없이 정합성을 검사하기 위해서다.**
 * `personaTargetRole` 은 FK 가 없어(복합키를 단일 컬럼으로 못 가리킨다) 오타가 나도 DB 가 막지
 * 못한다. `dev-fixture.spec.ts` 가 그 자리를 대신한다.
 */

export interface DevFixtureCharacter {
  /** 배역 키. 개인화 대상과 대화 API 경로가 참조하는 **계약**이다 (표시 이름과 분리). */
  role: string;
  displayName: string;
  /** 🚫 응답에 나가지 않는다 (`select: false`). 프롬프트 설계가 노출되면 스포일러의 재료가 된다. */
  persona: string;
}

export interface DevFixturePageCharacter {
  role: string;
  /** 0~1 로 정규화된 비율. 🚫 픽셀로 두면 삽화 해상도를 바꾸는 순간 전부 어긋난다. */
  hitbox: StoryCharacterHitbox | null;
}

export interface DevFixturePage {
  pageNo: number;
  bodyText: string;
  /** 이 페이지에서 사용자 얼굴로 개인화할 배역. `null` = 주인공이 없는 장면. */
  personaTargetRole: string | null;
  characters: DevFixturePageCharacter[];
}

export interface DevFixtureStory {
  slug: string;
  title: string;
  summary: string;
  characters: DevFixtureCharacter[];
  pages: DevFixturePage[];
}

/**
 * slug 접두사. **공개 콘텐츠와 한눈에 구분되어야 한다** — 전 환경이 같은 DB 를 쓰므로
 * 실수로 상용에 남아도 이 접두사로 찾아 지울 수 있다.
 */
export const DEV_FIXTURE_SLUG_PREFIX = 'dev-';

const PROTAGONIST = 'protagonist';
const LAMP_KEEPER = 'lamp-keeper';

export const DEV_FIXTURE_STORY: DevFixtureStory = {
  slug: 'dev-cloud-village',
  title: '구름 마을의 작은 등불',
  summary: '밤이 오면 등불을 켜는 아이의 이야기 (개발용 더미 동화)',

  characters: [
    {
      role: PROTAGONIST,
      displayName: '루미',
      persona:
        '여덟 살 아이. 호기심이 많고 겁도 조금 있지만 결국 스스로 앞으로 나선다. ' +
        '짧고 밝은 문장으로 말하고 감탄사를 자주 쓴다. ' +
        '🚫 앞으로 일어날 일을 미리 말하지 않는다 — 지금 페이지에서 본 것만 안다.',
    },
    {
      role: LAMP_KEEPER,
      displayName: '등불지기 할아버지',
      persona:
        '구름 마을의 등불을 오래 지켜 온 노인. 느리고 다정한 말투로, 답을 바로 주지 않고 ' +
        '수수께끼처럼 돌려 말한다. ' +
        '🚫 아이가 스스로 답을 찾도록 힌트까지만 준다. 결말을 대신 말하지 않는다.',
    },
  ],

  pages: [
    {
      pageNo: 1,
      bodyText:
        '구름 마을에는 이상한 규칙이 하나 있었어요.\n' +
        '해가 지면 누군가 언덕 위 등불을 켜야 한다는 것.\n' +
        '오늘 밤은 루미의 차례였습니다.',
      personaTargetRole: PROTAGONIST,
      characters: [{ role: PROTAGONIST, hitbox: { x: 0.38, y: 0.42, width: 0.24, height: 0.4 } }],
    },
    {
      pageNo: 2,
      bodyText:
        '"혼자서도 할 수 있어."\n' +
        '루미는 그렇게 말했지만, 언덕은 생각보다 훨씬 어두웠어요.\n' +
        '발밑에서 구름이 폭신폭신 밟혔습니다.',
      personaTargetRole: PROTAGONIST,
      characters: [{ role: PROTAGONIST, hitbox: { x: 0.3, y: 0.36, width: 0.26, height: 0.46 } }],
    },
    {
      pageNo: 3,
      bodyText:
        '언덕 중턱에서 루미는 등불지기 할아버지를 만났어요.\n' +
        '"등불은 어떻게 켜요?"\n' +
        '할아버지는 빙그레 웃기만 했습니다.',
      personaTargetRole: PROTAGONIST,
      characters: [
        { role: PROTAGONIST, hitbox: { x: 0.22, y: 0.4, width: 0.22, height: 0.42 } },
        { role: LAMP_KEEPER, hitbox: { x: 0.56, y: 0.34, width: 0.26, height: 0.5 } },
      ],
    },
    {
      pageNo: 4,
      // 주인공이 등장하지 않는 장면이라 개인화 대상이 없다. `null` 이 그 사실을 표현한다.
      bodyText:
        '할아버지는 오래된 성냥갑을 만지작거렸어요.\n' +
        '그 안에는 성냥이 딱 한 개비 남아 있었습니다.\n' +
        '"이건 내가 켤 수 없는 불이란다."',
      personaTargetRole: null,
      characters: [{ role: LAMP_KEEPER, hitbox: { x: 0.4, y: 0.3, width: 0.3, height: 0.52 } }],
    },
    {
      pageNo: 5,
      bodyText:
        '루미는 성냥을 받아 들었어요.\n' +
        '손이 조금 떨렸지만, 숨을 크게 들이쉬었습니다.\n' +
        '치익 — 작은 불꽃이 피어올랐어요.',
      personaTargetRole: PROTAGONIST,
      characters: [
        { role: PROTAGONIST, hitbox: { x: 0.34, y: 0.32, width: 0.3, height: 0.5 } },
        { role: LAMP_KEEPER, hitbox: { x: 0.68, y: 0.4, width: 0.22, height: 0.42 } },
      ],
    },
    {
      pageNo: 6,
      bodyText:
        '등불이 켜지자 구름 마을 전체가 환해졌어요.\n' +
        '아래에서 사람들이 손을 흔들었습니다.\n' +
        '"오늘 밤은 네가 켰구나."',
      personaTargetRole: PROTAGONIST,
      characters: [{ role: PROTAGONIST, hitbox: { x: 0.42, y: 0.3, width: 0.24, height: 0.44 } }],
    },
  ],
};
