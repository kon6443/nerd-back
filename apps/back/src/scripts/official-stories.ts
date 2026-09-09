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
  illustrationPrompt?: string | null;
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

export const buildJackPrompt = (sceneStory: string, expressionInstruction: string): string =>
  `<inputs>\n` +
  `  <base_scene_template>배경과 구도, 소년 잭의 의상을 완벽히 유지할 원본 동화 템플릿 삽화 (Attached Image 1)</base_scene_template>\n` +
  `  <protagonist_identity>주인공 얼굴에 반영할 인물 레퍼런스 (사용자의 실제 얼굴 사진 또는 사전 제작된 캐릭터 디자인 시트) (Attached Image 2)</protagonist_identity>\n` +
  `</inputs>\n\n` +
  `<instructions>\n` +
  `1. [필수 - 템플릿 이목구비 완전 삭제 및 얼굴 교체]: <base_scene_template>에 이미 그려진 서양 만화 캐릭터의 큰 눈망울, 코, 입, 얼굴 윤곽선을 100% 완전히 지워내세요. 템플릿 원본의 가상 캐릭터 생김새가 조금이라도 남아있으면 안 됩니다. 소년 잭의 얼굴 전체(눈매, 쌍꺼풀 유무, 눈 크기 및 눈꼬리 모양, 눈썹, 콧대, 입술, 턱선, 얼굴형)를 <protagonist_identity> 속 인물의 실제 고유한 생김새로 100% 확실하게 교체해야 합니다. (엄마, 노인, 거인 등 다른 등장인물의 얼굴과 요술 거위는 절대 변경하지 마세요.)\n` +
  `2. [3D 각도 회전 & 시선 맞춤 필수]: <protagonist_identity>의 인물이 정면 사진이더라도, 이를 3차원 공간에서 회전시켜 <base_scene_template>의 고개 각도(정면, 3/4 측면, 반측면 등)와 시선 방향에 맞추어 새로 그려야 합니다. 각도가 돌아가더라도 <protagonist_identity> 인물 고유의 이목구비 정체성을 잃지 않아야 합니다.\n` +
  `3. [화풍 일치]: 얼굴 이목구비의 정체성은 <protagonist_identity>를 그대로 구현하되, 채색 질감만 <base_scene_template> 원본 삽화의 따뜻한 수채화·과슈 동화 일러스트 질감으로 조화롭게 일치시켜주세요.\n` +
  `4. [보존 및 블렌딩 영역]: 소년 잭의 모자, 의상, 체형, 자세, 손, 소품 및 모든 배경 풍경은 <base_scene_template> 그대로 완벽하게 유지해주세요. 모자 안쪽의 얼굴 전체는 <protagonist_identity>의 인물 특징으로 완전히 대체하되, 얼굴과 목·모자 경계는 자연스럽게 블렌딩해주세요.\n` +
  `5. 현재 장면 스토리: ${sceneStory}\n` +
  `6. 장면별 각도 및 표정 지시: ${expressionInstruction}\n` +
  `7. 빛의 방향, 색온도, 명암은 <base_scene_template> 원본 장면에 맞춰 조화롭게 합성해주세요.\n` +
  `8. <base_scene_template>의 가로세로 비율과 구도를 유지하고, 글자, 로고, 워터마크를 추가하지 마세요.\n` +
  `</instructions>`;

export const buildRedRidingHoodPrompt = (sceneStory: string, expressionInstruction: string): string =>
  `<inputs>\n` +
  `  <base_scene_template>배경과 구도, 빨간 두건과 의상을 완벽히 유지할 원본 동화 템플릿 삽화 (Attached Image 1)</base_scene_template>\n` +
  `  <protagonist_identity>주인공 얼굴에 반영할 인물 레퍼런스 (사용자의 실제 얼굴 사진 또는 사전 제작된 캐릭터 디자인 시트) (Attached Image 2)</protagonist_identity>\n` +
  `</inputs>\n\n` +
  `<instructions>\n` +
  `1. [필수 - 템플릿 이목구비 완전 삭제 및 얼굴 교체]: <base_scene_template>에 이미 그려진 서양 만화 캐릭터의 큰 눈망울, 코, 입, 얼굴 윤곽선을 100% 완전히 지워내세요. 템플릿 원본의 가상 캐릭터 생김새가 조금이라도 남아있으면 안 됩니다. 빨간 두건을 쓴 소녀의 얼굴 전체(눈매, 쌍꺼풀 유무, 눈 크기 및 눈꼬리 모양, 눈썹, 콧대, 입술, 턱선, 얼굴형)를 <protagonist_identity> 속 인물의 실제 고유한 생김새로 100% 확실하게 교체해야 합니다. (할머니, 사냥꾼 등 다른 등장인물의 얼굴은 절대 변경하지 마세요.)\n` +
  `2. [3D 각도 회전 & 시선 맞춤 필수]: <protagonist_identity>의 인물이 정면 사진이더라도, 이를 3차원 공간에서 회전시켜 <base_scene_template>의 고개 각도(정면, 3/4 측면, 반측면 등)와 시선 방향에 맞추어 새로 그려야 합니다. 각도가 돌아가더라도 <protagonist_identity> 인물 고유의 이목구비 정체성을 잃지 않아야 합니다.\n` +
  `3. [화풍 일치]: 얼굴 이목구비의 정체성은 <protagonist_identity>를 그대로 구현하되, 채색 질감만 <base_scene_template> 원본 삽화의 따뜻한 수채화·과슈 동화 일러스트 질감으로 조화롭게 일치시켜주세요.\n` +
  `4. [보존 및 블렌딩 영역]: 빨간 두건, 의상, 체형, 자세, 손, 바구니 및 모든 숲 배경 풍경은 <base_scene_template> 그대로 완벽하게 유지해주세요. 두건 안쪽의 얼굴 전체는 <protagonist_identity>의 인물 특징으로 완전히 대체하되, 얼굴과 목·두건 경계는 자연스럽게 블렌딩해주세요.\n` +
  `5. 현재 장면 스토리: ${sceneStory}\n` +
  `6. 장면별 각도 및 표정 지시: ${expressionInstruction}\n` +
  `7. 빛의 방향, 밝기, 색감은 <base_scene_template> 원본 장면에 맞춰 조화롭게 합성해주세요.\n` +
  `8. <base_scene_template>의 가로세로 비율과 구도를 유지하고, 글자·로고·워터마크를 추가하지 마세요.\n` +
  `</instructions>`;

export const JACK_AND_BEANSTALK_STORY: OfficialStoryData = {
  slug: 'jack-and-beanstalk',
  title: '잭과 콩나무',
  summary: '마법의 콩을 심고 구름 위 거인의 성으로 떠나는 잭의 용감한 모험 이야기',
  coverImageKey: 'templates/jack-and-beanstalk/page-1.png',
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
      illustrationPrompt: buildJackPrompt(
        '가난하지만 호기심 많은 잭이 마지막 남은 젖소를 팔러 장터로 가던 중 신비한 노인의 마법의 콩과 맞바꾸는 장면',
        '[정면 및 아래 시선]: 손바닥의 콩을 내려다보는 호기심과 기대감. <protagonist_identity> 인물의 고유 눈매를 살려 눈을 생기 있게 뜨고 눈썹을 살짝 올린 밝은 미소. 아래를 보는 원본 시선 유지.',
      ),
      baseImageKey: 'templates/jack-and-beanstalk/page-1.png',
      personaTargetRole: 'jack',
      characters: [{ role: 'jack', hitbox: { x: 0.35, y: 0.38, width: 0.28, height: 0.48 } }],
    },
    {
      pageNo: 2,
      bodyText:
        '엄마가 던져버린 콩은 하룻밤 새 구름을 뚫고 하늘 끝까지 자라났어요!\n' +
        '잭은 굵은 줄기를 타고 용감하게 하늘 높이 올라갔지요.\n' +
        '안개 낀 꼭대기에는 땅에서는 본 적도 없는 거대하고 신비로운 거인의 성이 솟아 있었답니다.',
      illustrationPrompt: buildJackPrompt(
        '하늘 끝까지 자라난 거대한 콩나무 줄기를 타고 올라가 구름 위 신비로운 거인의 성을 발견한 장면',
        '[3/4 측면 각도 회전 필수]: 콩나무 줄기에 매달려 고개를 위로 45도 돌려 거인의 성을 올려다보는 3/4 쿼터 뷰 각도로 새로 그려야 합니다. 템플릿의 만화 눈을 완전히 지우고, <protagonist_identity> 인물의 실제 눈매(무쌍, 눈 크기, 눈꼬리 형태), 콧날, 입술로 거대한 성을 발견한 경이로움과 감탄의 미소를 표현하세요.',
      ),
      baseImageKey: 'templates/jack-and-beanstalk/page-2.png',
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
      illustrationPrompt: buildJackPrompt(
        '황금 알을 낳는 요술 거위를 품에 안고, 뒤쫓아오는 무시무시한 거인을 피해 필사적으로 달아나는 장면',
        '[반측면 긴박한 도망 필수]: 거위를 안고 고개를 뒤로 돌려 거인을 확인하는 반측면(Semi-profile, 60도) 각도로 회전시켜 그려야 합니다. 템플릿의 서양 만화 눈을 완전히 지우고, <protagonist_identity> 인물 고유의 실제 눈매와 눈썹, 얼굴형을 정확히 유지하면서 눈을 크게 뜨고 눈썹을 긴장시킨 다급함과 공포 표정을 표현하세요.',
      ),
      baseImageKey: 'templates/jack-and-beanstalk/page-3.png',
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
      illustrationPrompt: buildJackPrompt(
        '콩나무를 쓰러뜨려 위기를 넘긴 후, 마당으로 달려 나온 엄마를 끌어안고 안도하는 장면',
        '[정면 포옹]: 엄마를 안으며 짓는 환한 기쁨과 안도의 웃음. <protagonist_identity> 인물의 이목구비로 눈가의 긴장이 풀리고 입가가 크게 올라간 뿌듯한 표정. 엄마의 얼굴과 포옹 자세는 그대로 유지.',
      ),
      baseImageKey: 'templates/jack-and-beanstalk/page-4.png',
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
      illustrationPrompt: buildJackPrompt(
        '한밤중 잠에서 깨어 요술 거위의 둥지에 놓인 영롱한 별빛 씨앗을 신비롭게 내려다보는 장면',
        '[내려다보는 시선]: 둥지를 내려다보며 신비한 씨앗을 발견한 순수한 놀라움. <protagonist_identity> 인물의 눈매로 반짝이는 눈과 조용히 감탄하듯 열린 입과 부드러운 미소.',
      ),
      baseImageKey: 'templates/jack-and-beanstalk/page-5.png',
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
      illustrationPrompt: buildJackPrompt(
        '마당으로 나가 별빛 씨앗을 밤하늘로 날려 보내고, 밤하늘에 떠오른 따뜻한 별을 바라보는 장면',
        '[밤하늘 올려다보기]: 밤하늘로 떠오른 별을 올려다보는 경이로움과 고마움. <protagonist_identity> 인물의 고개 각도와 밝은 눈빛, 입을 자연스럽게 연 행복한 미소.',
      ),
      baseImageKey: 'templates/jack-and-beanstalk/page-6.png',
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
      illustrationPrompt: buildRedRidingHoodPrompt(
        '빨간 모자가 할머니에게 드릴 달콤한 빵과 버터가 든 바구니를 들고 씩씩하게 꽃길을 걸어가는 장면',
        '[정면 뷰]: 정면을 바라보는 밝고 씩씩한 미소. <protagonist_identity> 인물의 고유 눈매와 입매를 그대로 살려 기대감으로 눈이 반짝이고, 눈썹과 입가가 자연스럽게 올라간 표정.',
      ),
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
      illustrationPrompt: buildRedRidingHoodPrompt(
        '들꽃에 마음을 빼앗긴 빨간 모자 앞에 나타난 상냥한 척하는 늑대에게 순진하게 할머니 댁을 말해주는 장면',
        '[3/4 측면 각도 회전 필수]: 고개를 오른쪽 위로 45도 돌려 늑대를 올려다보는 3/4 쿼터 뷰 각도로 새로 그려야 합니다. 템플릿의 동그랗고 큰 서양 만화 눈을 완전히 지우고, <protagonist_identity> 인물 고유의 실제 눈매(무쌍, 눈 크기, 눈꼬리 형태), 콧날, 입술로 늑대를 순진하게 바라보는 천진난만한 미소를 지어주세요.',
      ),
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
      illustrationPrompt: buildRedRidingHoodPrompt(
        '할머니 오두막 침대에서 이불을 걷어차며 달려드는 늑대를 보고 깜짝 놀라는 장면',
        '[반측면 공포 표정 변환 필수]: 몸은 앞으로 피하며 고개를 오른쪽 뒤로 60도 돌려 늑대를 돌아보는 반측면(Semi-profile) 각도로 회전시켜 그려야 합니다. 템플릿의 서양 만화식 동그란 왕눈이를 절대 남기지 말고, <protagonist_identity> 인물 고유의 실제 눈매와 짙은 눈썹, 얼굴형을 정확히 유지하면서 늑대를 보고 소스라치게 놀라 눈을 치켜뜨고 입을 벌린 생생한 공포·경악 표정을 지어주세요.',
      ),
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
      illustrationPrompt: buildRedRidingHoodPrompt(
        '용감한 사냥꾼이 늑대를 제압한 뒤, 빨간 모자가 안전하게 구출된 할머니 품에 안겨 안도하는 장면',
        '[정면/반측면 포옹]: <protagonist_identity> 인물의 이목구비로 할머니 품에 안겨 안도하는 따뜻하고 편안한 미소. 정면을 응시하며 두려움이 사라지고 안심한 미소에 진심 어린 다짐이 담긴 표정.',
      ),
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
      illustrationPrompt: buildRedRidingHoodPrompt(
        '평화를 되찾은 숲에서 동물 친구들이 빨간 모자에게 감사의 선물로 산딸기와 솔방울을 건네는 장면',
        '[3/4 측면 창가]: <protagonist_identity> 인물의 이목구비로 창가 동물 친구들을 부드럽게 바라보는 다정하고 감탄 어린 미소. 선물에 기뻐 눈이 반짝이고 감탄과 고마움이 담긴 표정.',
      ),
      baseImageKey: 'templates/red-riding-hood/page-5.png',
      personaTargetRole: 'red-hood',
      characters: [{ role: 'red-hood', hitbox: { x: 0.36, y: 0.34, width: 0.28, height: 0.5 } }],
    },
    {
      pageNo: 6,
      bodyText:
        '사냥꾼 아저씨와 함께 집으로 돌아오는 길, 빨간 모자는 이제 숲의 모든 길을 씩씩하게 기억할 수 있게 되었어요.\n' +
        '"앞으로는 내가 할머니와 숲을 지키는 용감한 파수꾼이 될래요!"',
      illustrationPrompt: buildRedRidingHoodPrompt(
        '사냥꾼 아저씨와 함께 집으로 돌아오며 용감하게 숲을 지키는 파수꾼이 되겠다고 다짐하는 장면',
        '[정면 전신 행진]: <protagonist_identity> 인물의 이목구비로 사냥꾼 아저씨와 함께 숲길을 씩씩하게 걸어가는 밝고 희망찬 미소. 또렷한 눈빛과 자연스럽게 올라간 입가로 용기와 뿌듯함을 표현.',
      ),
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
