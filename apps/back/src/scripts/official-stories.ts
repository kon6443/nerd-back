import type { StoryCharacterHitbox } from '@nerd/contracts';

export interface StoryCharacterData {
  role: string;
  displayName: string;
  persona: string;
}

export interface StoryPageCharacterData {
  role: string;
  hitbox: StoryCharacterHitbox | null;
}

export interface StoryPageData {
  pageNo: number;
  bodyText: string;
  baseImageKey?: string | null;
  personaTargetRole: string | null;
  characters: StoryPageCharacterData[];
}

export interface OfficialStoryData {
  slug: string;
  title: string;
  summary: string;
  coverImageKey?: string | null;
  characters: StoryCharacterData[];
  pages: StoryPageData[];
}

export const JACK_AND_BEANSTALK_STORY: OfficialStoryData = {
  slug: 'jack-and-beanstalk',
  title: '잭과 콩나무',
  summary: '마법의 콩을 심고 구름 위 거인의 성으로 떠나는 잭의 용감한 모험 이야기',
  characters: [
    {
      role: 'jack',
      displayName: '잭',
      persona:
        '호기심 많고 용감한 소년. 가난한 집안이지만 항상 밝고 씩씩하며 모험을 두려워하지 않는다. ' +
        '짧고 활기찬 말투로 말하며 감탄사를 자주 쓴다. ' +
        '🚫 앞으로 일어날 일을 미리 말하지 않는다 — 지금 페이지에서 본 것만 안다.',
    },
    {
      role: 'mother',
      displayName: '엄마',
      persona:
        '잭을 깊이 사랑하지만 생활고에 지쳐 엄격하고 걱정이 많은 어머니. ' +
        '다정하면서도 잔소리가 섞인 현실적인 말투를 쓴다. ' +
        '🚫 잭의 안전을 최우선으로 생각한다.',
    },
    {
      role: 'giant',
      displayName: '거인',
      persona:
        '구름 위 거대한 성에 사는 무시무시하고 우렁찬 거인. ' +
        '굵고 쩌렁쩌렁한 목소리로 화를 내며, 자신의 보물을 지키려 한다. ' +
        '🚫 단순하고 우직한 말투를 쓴다.',
    },
    {
      role: 'magical-goose',
      displayName: '요술 거위',
      persona:
        '황금 알과 별빛 씨앗을 낳는 신비한 거위. ' +
        '부드러운 날갯짓과 울음소리로 감정을 표현하며, 잭을 진정한 친구로 믿고 따른다.',
    },
  ],
  pages: [
    // [본편: 1~4장]
    {
      pageNo: 1,
      bodyText:
        '가난하지만 호기심 많은 잭은 마지막 남은 젖소를 팔러 장터로 향했어요.\n' +
        '길에서 만난 신비한 노인이 반짝이는 콩을 건네며 속삭였지요.\n' +
        '"이건 밤새 자라는 마법의 콩이란다."\n' +
        '잭은 두 눈을 반짝이며 젖소와 마법의 콩을 맞바꾸었어요.',
      personaTargetRole: 'jack',
      characters: [{ role: 'jack', hitbox: { x: 0.35, y: 0.38, width: 0.28, height: 0.48 } }],
    },
    {
      pageNo: 2,
      bodyText:
        '엄마가 던져버린 콩은 하룻밤 새 구름을 뚫고 하늘 끝까지 자라났어요!\n' +
        '잭은 굵은 줄기를 타고 용감하게 하늘 높이 올라갔지요.\n' +
        '안개 낀 꼭대기에는 땅에서는 본 적도 없는 거대하고 신비로운 거인의 성이 솟아 있었답니다.',
      personaTargetRole: 'jack',
      characters: [{ role: 'jack', hitbox: { x: 0.3, y: 0.34, width: 0.26, height: 0.5 } }],
    },
    {
      pageNo: 3,
      bodyText:
        '성 안으로 몰래 들어간 잭은 황금 알을 낳는 요술 거위를 발견했어요.\n' +
        '잭이 조심스레 거위를 품에 안는 순간, 요술 하프가 외쳤어요!\n' +
        '"도둑이야!"\n' +
        '번쩍 눈을 뜬 무시무시한 거인이 쿵쾅거리며 쫓아오기 시작했어요.',
      personaTargetRole: 'jack',
      characters: [
        { role: 'jack', hitbox: { x: 0.22, y: 0.4, width: 0.25, height: 0.46 } },
        { role: 'giant', hitbox: { x: 0.58, y: 0.2, width: 0.36, height: 0.62 } },
      ],
    },
    {
      pageNo: 4,
      bodyText:
        '번개처럼 땅에 내려온 잭은 도끼로 콩나무 밑동을 힘차게 내리찍었어요!\n' +
        '거대한 콩나무가 쓰러지며 거인은 깊은 땅속으로 사라졌지요.\n' +
        '위기를 이겨낸 잭은 달려 나온 엄마를 꼭 끌어안으며 환하게 웃었답니다.',
      personaTargetRole: 'jack',
      characters: [
        { role: 'jack', hitbox: { x: 0.3, y: 0.36, width: 0.28, height: 0.48 } },
        { role: 'mother', hitbox: { x: 0.64, y: 0.34, width: 0.26, height: 0.5 } },
      ],
    },
    // [비하인드: 5~6장]
    {
      pageNo: 5,
      bodyText:
        '모두가 잠든 고요한 밤, 잭의 침대 옆에서 잠자던 요술 거위가 반짝이는 깃털을 퍼덕이며 잭을 가만히 깨웠어요.\n' +
        '거위의 둥지에는 황금 알 대신 밤하늘의 별처럼 영롱하게 빛나는 "별빛 씨앗"이 놓여 있었지요.',
      personaTargetRole: 'jack',
      characters: [
        { role: 'jack', hitbox: { x: 0.28, y: 0.34, width: 0.28, height: 0.48 } },
        { role: 'magical-goose', hitbox: { x: 0.65, y: 0.48, width: 0.22, height: 0.36 } },
      ],
    },
    {
      pageNo: 6,
      bodyText:
        '잭은 마당으로 나가 별빛 씨앗을 밤하늘을 향해 높이 날려 보냈어요.\n' +
        '씨앗은 은은한 빛을 내며 하늘 높이 떠올라 잭의 집을 따뜻하게 비추는 작은 별이 되었답니다.\n' +
        '"고마워, 내 작은 친구야!"',
      personaTargetRole: 'jack',
      characters: [{ role: 'jack', hitbox: { x: 0.38, y: 0.34, width: 0.26, height: 0.5 } }],
    },
  ],
};

export const RED_RIDING_HOOD_STORY: OfficialStoryData = {
  slug: 'red-riding-hood',
  title: '빨간 모자',
  summary: '착하고 순수한 빨간 모자가 깊은 숲속 할머니 댁을 찾아가며 겪는 아슬아슬한 모험 이야기',
  coverImageKey: 'templates/red-riding-hood/page-1.png',
  characters: [
    {
      role: 'red-hood',
      displayName: '빨간 모자',
      persona:
        '빨간 두건을 쓴 천진난만하고 다정한 소녀. 세상을 따뜻하게 바라보며 호기심이 많지만 다소 순진하다. ' +
        '귀엽고 솔직한 말투를 쓴다. ' +
        '🚫 앞으로 일어날 일을 미리 말하지 않는다 — 지금 페이지에서 본 것만 안다.',
    },
    {
      role: 'wolf',
      displayName: '늑대',
      persona:
        '숲속에 숨어 기회를 엿보는 교활한 늑대. ' +
        '겉으로는 매우 상냥하고 부드럽게 말을 건네지만 속에는 엉큼한 생각을 품고 있다. ' +
        '능글맞고 달콤한 어조로 유혹한다.',
    },
    {
      role: 'grandmother',
      displayName: '할머니',
      persona:
        '깊은 숲속 오두막에 사는 빨간 모자의 인자한 할머니. ' +
        '손녀를 끔찍이 아끼며 따뜻하고 포근한 말투를 쓴다.',
    },
    {
      role: 'hunter',
      displayName: '사냥꾼',
      persona:
        '숲을 순찰하며 동물과 사람들을 지키는 든든하고 용감한 사냥꾼. ' +
        '굵직하고 신뢰감 넘치는 목소리와 듬직한 태도로 말한다.',
    },
  ],
  pages: [
    // [본편: 1~4장]
    {
      pageNo: 1,
      bodyText:
        '햇살이 눈부신 아침, 빨간 모자는 편찮으신 할머니를 위해 길을 나섰어요.\n' +
        '바구니에는 갓 구운 달콤한 빵과 버터가 가득했지요.\n' +
        '"절대로 다른 길로 새면 안 된다!"\n' +
        '엄마의 당부를 되새기며 빨간 모자는 씩씩하게 숲길을 걸어갔어요.',
      baseImageKey: 'templates/red-riding-hood/page-1.png',
      personaTargetRole: 'red-hood',
      characters: [{ role: 'red-hood', hitbox: { x: 0.36, y: 0.36, width: 0.26, height: 0.48 } }],
    },
    {
      pageNo: 2,
      bodyText:
        '알록달록한 들꽃에 마음을 빼앗긴 빨간 모자 앞에 잿빛 늑대가 슬그머니 나타났어요.\n' +
        '"귀여운 꼬마야, 어디 가니?"\n' +
        '상냥한 척하는 목소리에 속은 빨간 모자는 깊은 숲속 할머니 오두막에 간다는 사실을 순진하게 털어놓고 말았어요.',
      baseImageKey: 'templates/red-riding-hood/page-2.png',
      personaTargetRole: 'red-hood',
      characters: [
        { role: 'red-hood', hitbox: { x: 0.26, y: 0.4, width: 0.24, height: 0.46 } },
        { role: 'wolf', hitbox: { x: 0.6, y: 0.3, width: 0.32, height: 0.54 } },
      ],
    },
    {
      pageNo: 3,
      bodyText:
        '할머니 오두막에 도착해 침대를 본 빨간 모자는 고개를 갸웃했어요.\n' +
        '"할머니, 귀가 왜 이리 크세요?"\n' +
        '"네 목소리를 잘 들으려고 그렇단다."\n' +
        '"그런데 입은 왜 이렇게 커요?"\n' +
        '"그건 널 꿀꺽 삼키기 위해서지!"\n' +
        '늑대가 이불을 걷어차며 사납게 달려들었어요!',
      baseImageKey: 'templates/red-riding-hood/page-3.png',
      personaTargetRole: 'red-hood',
      characters: [
        { role: 'red-hood', hitbox: { x: 0.24, y: 0.42, width: 0.26, height: 0.46 } },
        { role: 'wolf', hitbox: { x: 0.56, y: 0.26, width: 0.36, height: 0.58 } },
      ],
    },
    {
      pageNo: 4,
      bodyText:
        '"어림없다, 못된 늑대야!"\n' +
        '비명을 듣고 달려온 용감한 사냥꾼이 늑대를 단숨에 제압하고 벽장 속 할머니를 무사히 구해냈어요.\n' +
        '빨간 모자는 할머니의 품에 안겨 다시는 한눈팔지 않겠다고 눈물을 글썽이며 굳게 약속했답니다.',
      baseImageKey: 'templates/red-riding-hood/page-4.png',
      personaTargetRole: 'red-hood',
      characters: [
        { role: 'red-hood', hitbox: { x: 0.28, y: 0.4, width: 0.24, height: 0.46 } },
        { role: 'grandmother', hitbox: { x: 0.54, y: 0.36, width: 0.24, height: 0.48 } },
        { role: 'hunter', hitbox: { x: 0.74, y: 0.24, width: 0.22, height: 0.6 } },
      ],
    },
    // [비하인드: 5~6장]
    {
      pageNo: 5,
      bodyText:
        '소동이 지나간 뒤, 오두막 창가로 아기 다람쥐와 새들이 쪼르르 찾아왔어요.\n' +
        '늑대가 사라진 숲은 평화를 되찾았고, 동물 친구들은 빨간 모자에게 감사의 뜻으로 향긋한 산딸기와 솔방울을 건넸지요.',
      baseImageKey: 'templates/red-riding-hood/page-5.png',
      personaTargetRole: 'red-hood',
      characters: [{ role: 'red-hood', hitbox: { x: 0.36, y: 0.34, width: 0.28, height: 0.5 } }],
    },
    {
      pageNo: 6,
      bodyText:
        '사냥꾼 아저씨와 함께 집으로 돌아오는 길, 빨간 모자는 이제 숲의 모든 길을 씩씩하게 기억할 수 있게 되었어요.\n' +
        '"앞으로는 내가 할머니와 숲을 지키는 용감한 파수꾼이 될래요!"',
      baseImageKey: 'templates/red-riding-hood/page-6.png',
      personaTargetRole: 'red-hood',
      characters: [
        { role: 'red-hood', hitbox: { x: 0.3, y: 0.36, width: 0.26, height: 0.5 } },
        { role: 'hunter', hitbox: { x: 0.64, y: 0.26, width: 0.26, height: 0.6 } },
      ],
    },
  ],
};

export const OFFICIAL_STORIES: OfficialStoryData[] = [
  JACK_AND_BEANSTALK_STORY,
  RED_RIDING_HOOD_STORY,
];
