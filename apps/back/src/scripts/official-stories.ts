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

export type StoryBranchKey = 'a' | 'b';

export interface AfterStoryChoiceData {
  branchKey: StoryBranchKey;
  title: string;
  description: string;
  page: StoryPageData;
}

export interface AfterStoryData {
  choices: readonly [AfterStoryChoiceData, AfterStoryChoiceData];
}

export interface OfficialStoryData {
  slug: string;
  title: string;
  summary: string;
  coverImageKey?: string | null;
  characters: StoryCharacterData[];
  /** 공통 본편. 비하인드 선택 UI는 페이지가 아니므로 여기에 넣지 않는다. */
  pages: StoryPageData[];
  /** A/B 결과 페이지와 선택지 메타데이터. */
  afterStory: AfterStoryData;
}

export const buildJackPrompt = (sceneStory: string, expressionInstruction: string): string =>
  `<task_specification>\n` +
  `<priority>IDENTITY FIDELITY TO <protagonist_identity> IS THE HIGHEST PRIORITY inside the editable face-and-hair region. The result must be immediately recognizable as the real person in <protagonist_identity>, not as the original template character.</priority>\n\n` +
  `<inputs>\n` +
  `  <base_scene_template>The first attached image is the original storybook illustration to edit. Use it only for the canvas, composition, Jack's body and clothing, pose, head position, expression, gaze, occlusion, lighting, and illustration style. Do not use Jack's original face or hair as an identity source.</base_scene_template>\n` +
  `  <protagonist_identity>The second attached image is the user's real portrait photo. It is the sole source of facial identity, facial geometry, skin tone, and hairstyle.</protagonist_identity>\n` +
  `</inputs>\n\n` +
  `<edit_target>Jack is the main protagonist wearing a moss-green vest, cream shirt, and rust-brown trousers. Replace Jack only. Never alter another child, adult, or animal.</edit_target>\n\n` +
  `<identity_transfer>\n` +
  `- Completely replace Jack's original face and hair. Do not retain any identity-defining facial feature or hairstyle from <base_scene_template>.\n` +
  `- Preserve the exact relative geometry and distinctive traits from <protagonist_identity>: face shape, forehead, cheek and jaw proportions, eye shape and spacing, eyelids, eyebrows, nose shape and width, lips, skin tone, and natural asymmetry.\n` +
  `- Preserve the recognizable hairstyle from <protagonist_identity>: hair color, hairline, parting, bangs, length, texture, curl pattern, volume, and overall silhouette. Rotate it naturally to Jack's existing head angle without reverting to the template hairstyle.\n` +
  `- Do not blend, average, interpolate, beautify, genericize, simplify, or combine the face or hairstyle from the two inputs. Scale the transferred face and hair only as needed to fit Jack's existing head. Do not deliberately make the identity younger or older.\n` +
  `</identity_transfer>\n\n` +
  `<expression_and_style>Preserve Jack's expression, emotion, gaze, head angle, and perspective from <base_scene_template>; do not copy them from the portrait. Render the transferred identity with the template's warm watercolor and gouache technique, soft outlines, brushwork, paper texture, shading, and scene lighting. Style adaptation may change the rendering medium, but it must not change or simplify identity-defining facial geometry or hairstyle. No photorealistic patches, seams, or pasted-on appearance.</expression_and_style>\n\n` +
  `<preservation>Change only Jack's face, hair, and the smallest surrounding area required for a seamless blend. Preserve his body, pose, hands, clothing, boots, placement, and every other character, animal, object, background element, composition, color, and original image dimensions. Add no text, border, logo, watermark, or new element.</preservation>\n\n` +
  `<consistency>Use the same recognizable identity, hairstyle, skin tone, and apparent age from <protagonist_identity> across every page.</consistency>\n\n` +
  `<scene_reference>This text identifies the existing target and must not be used to redesign or regenerate the scene: ${sceneStory}</scene_reference>\n` +
  `<appearance_to_preserve>${expressionInstruction}</appearance_to_preserve>\n\n` +
  `<output>Return one edited illustration only.</output>\n` +
  `</task_specification>`;

export const buildRedRidingHoodPrompt = (sceneStory: string, expressionInstruction: string): string =>
  `<task_specification>\n` +
  `<priority>IDENTITY FIDELITY TO <protagonist_identity> IS THE HIGHEST PRIORITY inside the editable face-and-hair region. The result must be immediately recognizable as the real person in <protagonist_identity>, not as the original template character.</priority>\n\n` +
  `<inputs>\n` +
  `  <base_scene_template>The first attached image is the original Little Red Riding Hood storybook illustration to edit. Use it only for the canvas, composition, protagonist's body and clothing, pose, head position, expression, gaze, occlusion, lighting, and illustration style. Do not use the protagonist's original face or hair as an identity source.</base_scene_template>\n` +
  `  <protagonist_identity>The second attached image is the user's real portrait photo. It is the sole source of facial identity, facial geometry, skin tone, and hairstyle.</protagonist_identity>\n` +
  `</inputs>\n\n` +
  `<edit_target>Replace only Little Red Riding Hood, the main protagonist wearing the red hood or cape. Never alter the grandmother, huntsman, wolf, squirrels, birds, or any other character.</edit_target>\n\n` +
  `<identity_transfer>\n` +
  `- Completely replace the protagonist's original face and visible hair. Do not retain any identity-defining facial feature or hairstyle from <base_scene_template>.\n` +
  `- Preserve the exact relative geometry and distinctive traits from <protagonist_identity>: face shape, forehead, cheek and jaw proportions, eye shape and spacing, eyelids, eyebrows, nose shape and width, lips, skin tone, and natural asymmetry.\n` +
  `- Preserve the recognizable hairstyle from <protagonist_identity>: hair color, hairline, parting, bangs, length, texture, curl pattern, volume, and overall silhouette. Rotate it naturally to the protagonist's existing head angle without reverting to the template hairstyle.\n` +
  `- Do not blend, average, interpolate, beautify, genericize, simplify, or combine the face or hairstyle from the two inputs. Scale the transferred face and hair only as needed to fit the protagonist's existing head. Do not deliberately make the identity younger or older.\n` +
  `</identity_transfer>\n\n` +
  `<hood_preservation>Preserve the original red hood or cape, including its exact shape, position, folds, and size. Place the transferred hairstyle naturally inside and around the hood while respecting every existing overlap and occlusion made by the hood, hair, hands, or other objects. Never remove, resize, reshape, or reposition the hood.</hood_preservation>\n\n` +
  `<expression_and_style>Preserve the protagonist's expression, emotion, gaze, head angle, and perspective from <base_scene_template>; do not copy them from the portrait. Render the transferred identity with the template's warm watercolor and colored-pencil technique, linework, brushwork, paper texture, shading, and scene lighting. Style adaptation may change the rendering medium, but it must not change or simplify identity-defining facial geometry or hairstyle. No photorealistic patches, seams, or pasted-on appearance.</expression_and_style>\n\n` +
  `<preservation>Change only the protagonist's face, hair, and the smallest surrounding area required for a seamless blend. Preserve the red hood, cape, clothing, body, pose, hands, placement, and every other character, animal, object, background element, composition, framing, color, and original image dimensions. Add no text, border, logo, watermark, or new object.</preservation>\n\n` +
  `<consistency>Use the same recognizable identity, hairstyle, skin tone, and apparent age from <protagonist_identity> across every page.</consistency>\n\n` +
  `<scene_reference>This text identifies the existing target and must not be used to redesign or regenerate the scene: ${sceneStory}</scene_reference>\n` +
  `<appearance_to_preserve>${expressionInstruction}</appearance_to_preserve>\n\n` +
  `<output>Return one edited illustration only.</output>\n` +
  `</task_specification>`;

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
    // [본편: 1~5장]
    {
      pageNo: 1,
      bodyText:
        '가난하지만 호기심 많은 잭은 마지막 남은 젖소를 팔러 장터로 갔어요.\n' +
        '가는 길에 신비한 노인이 반짝이는 콩 몇 알을 내밀었지요.\n' +
        '"이건 밤새 자라는 마법의 콩이란다."\n' +
        '잭은 젖소와 콩을 바꾸었어요.',
      illustrationPrompt: buildJackPrompt(
        '젖소를 데리고 장터로 가던 잭이 시골길에서 신비한 노인이 내민 반짝이는 마법의 콩을 받는 장면',
        '[오른쪽 위 시선]: 노인의 손바닥 위 콩을 올려다보는 호기심과 기대감. 원본의 오른쪽을 향한 고개와 손 뻗는 자세를 유지.',
      ),
      baseImageKey: 'templates/jack-and-beanstalk/page-1.png',
      personaTargetRole: 'jack',
      characters: [{ role: 'jack', hitbox: { x: 0.29, y: 0.31, width: 0.31, height: 0.6 } }],
    },
    {
      pageNo: 2,
      bodyText:
        '엄마가 창밖으로 던진 콩은 하룻밤 새 하늘 끝까지 자라났어요.\n' +
        '잭은 굵은 콩나무 줄기를 타고 구름 위로 올라갔지요.\n' +
        '안개 너머에는 아주 크고 낯선 성이 서 있었답니다.',
      illustrationPrompt: buildJackPrompt(
        '하늘 끝까지 자라난 거대한 콩나무 줄기를 타고 올라가 구름 위 신비로운 거인의 성을 발견한 장면',
        '[왼쪽 위 시선]: 콩나무를 붙잡은 채 구름 위 성을 올려다보는 경이롭고 들뜬 미소. 원본의 왼쪽 배치와 위로 향한 시선을 유지.',
      ),
      baseImageKey: 'templates/jack-and-beanstalk/page-2.png',
      personaTargetRole: 'jack',
      characters: [{ role: 'jack', hitbox: { x: 0.12, y: 0.18, width: 0.42, height: 0.62 } }],
    },
    {
      pageNo: 3,
      bodyText:
        '성 안에서 잭은 황금 알을 낳는 요술 거위를 만났어요.\n' +
        '잭이 거위를 조심스레 안아 드는 순간, 요술 하프가 큰 소리로 외쳤지요.\n' +
        '"도둑이야!"\n' +
        '잠에서 깬 거인이 쿵쾅거리며 잭을 뒤쫓기 시작했어요.',
      illustrationPrompt: buildJackPrompt(
        '황금 알을 낳는 요술 거위를 품에 안고, 뒤쫓아오는 무시무시한 거인을 피해 필사적으로 달아나는 장면',
        '[오른쪽 뒤 시선]: 거위를 안고 달아나며 뒤의 거인을 돌아보는 다급하고 놀란 표정. 원본의 오른쪽 아래로 달리는 자세를 유지.',
      ),
      baseImageKey: 'templates/jack-and-beanstalk/page-3.png',
      personaTargetRole: 'jack',
      characters: [
        { role: 'jack', hitbox: { x: 0.48, y: 0.38, width: 0.34, height: 0.5 } },
        { role: 'giant', hitbox: { x: 0.26, y: 0.09, width: 0.42, height: 0.48 } },
      ],
    },
    {
      pageNo: 4,
      bodyText:
        '잭은 콩나무를 타고 번개처럼 내려왔어요.\n' +
        '그리고 도끼를 들어 콩나무 밑동을 힘껏 내리쳤지요.\n' +
        '쿵!\n' +
        '콩나무가 쓰러지자 거인은 더는 마을로 내려올 수 없었어요.',
      illustrationPrompt: buildJackPrompt(
        '집 앞 언덕에서 잭이 도끼로 거대한 콩나무 밑동을 힘껏 내리치는 장면',
        '[힘주는 표정]: 양손으로 도끼를 잡고 콩나무를 향해 내리치며 굳게 다문 입과 결연한 눈빛. 원본의 왼쪽 아래 자세와 도끼를 유지.',
      ),
      baseImageKey: 'templates/jack-and-beanstalk/page-4.png',
      personaTargetRole: 'jack',
      characters: [
        { role: 'jack', hitbox: { x: 0.15, y: 0.36, width: 0.32, height: 0.44 } },
      ],
    },
    {
      pageNo: 5,
      bodyText:
        '엄마는 무사히 돌아온 잭을 꼭 안아 주었어요.\n' +
        '요술 거위도 잭 곁에서 날개를 퍼덕였지요.\n' +
        '잭은 황금 알을 혼자 가지지 않았어요.\n' +
        '마을 사람들과 나누며, 이제는 서로 도우며 살겠다고 약속했답니다.',
      illustrationPrompt: buildJackPrompt(
        '엄마와 요술 거위 곁에서 마을 사람들과 황금 알을 나누며 서로 돕겠다고 약속하는 장면',
        '[정면의 따뜻한 미소]: 황금 알을 두 손으로 건네며 엄마와 마을 사람들을 바라보는 뿌듯하고 기쁜 표정. 원본의 중앙 배치와 손 자세를 유지.',
      ),
      baseImageKey: 'templates/jack-and-beanstalk/page-5.png',
      personaTargetRole: 'jack',
      characters: [
        { role: 'jack', hitbox: { x: 0.3, y: 0.31, width: 0.29, height: 0.48 } },
        { role: 'magical-goose', hitbox: { x: 0.03, y: 0.47, width: 0.27, height: 0.34 } },
      ],
    },
  ],
  afterStory: {
    choices: [
      {
        branchKey: 'a', title: '별빛 씨앗을 하늘로 돌려보내요', description: '거위의 둥지에서 발견한 반짝이는 씨앗을 밤하늘에 띄워 보내요.',
        page: { pageNo: 6, bodyText: '그날 밤, 요술 거위의 둥지에서 별빛 씨앗 하나가 반짝였어요.\n잭은 씨앗을 두 손에 올리고 하늘을 향해 살며시 불었지요.\n씨앗은 별이 되어 마을 위에 머물렀어요.\n늦은 밤 길을 걷는 사람들은 그 별을 보며 집으로 돌아갈 수 있었답니다.', illustrationPrompt: buildJackPrompt('밤의 집 앞에서 잭이 두 손의 별빛 씨앗을 하늘로 불어 보내고, 곁의 요술 거위가 이를 바라보는 장면', '[오른쪽 위 시선]: 손 위의 빛과 밤하늘을 올려다보는 경이롭고 따뜻한 미소. 원본의 두 손과 옆의 거위 위치를 유지.'), baseImageKey: 'templates/jack-and-beanstalk/page-6-a.png', personaTargetRole: 'jack', characters: [{ role: 'jack', hitbox: { x: 0.2, y: 0.3, width: 0.3, height: 0.54 } }, { role: 'magical-goose', hitbox: { x: 0.42, y: 0.53, width: 0.2, height: 0.31 } }] },
      },
      {
        branchKey: 'b', title: '별빛 씨앗을 마을에 심어요', description: '마을 사람들이 함께 볼 수 있는 작은 빛을 키워요.',
        page: { pageNo: 6, bodyText: '잭은 별빛 씨앗을 마을 한가운데에 심었어요.\n다음 날, 작은 싹이 돋더니 밤마다 은은한 빛을 내기 시작했지요.\n사람들은 그 나무 아래에 모여 이야기를 나눴어요.\n요술 거위는 날개를 퍼덕이며, 환한 마을을 바라보았답니다.', illustrationPrompt: buildJackPrompt('밤의 마을 광장에서 별빛 씨앗이 환하게 빛나는 큰 나무가 되고, 잭과 요술 거위, 마을 사람들이 그 아래 모인 장면', '[위쪽 시선]: 빛나는 나무를 올려다보는 기쁘고 편안한 미소. 원본의 나무 아래 중앙 배치와 앉은 자세를 유지.'), baseImageKey: 'templates/jack-and-beanstalk/page-6-b.png', personaTargetRole: 'jack', characters: [{ role: 'jack', hitbox: { x: 0.35, y: 0.42, width: 0.2, height: 0.27 } }, { role: 'magical-goose', hitbox: { x: 0.05, y: 0.61, width: 0.29, height: 0.3 } }] },
      },
    ],
  },
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
    // [본편: 1~5장]
    {
      pageNo: 1,
      bodyText:
        '햇살이 눈부신 아침, 빨간 모자는 편찮으신 할머니 댁으로 길을 나섰어요.\n' +
        '바구니에는 갓 구운 달콤한 빵과 버터가 가득했지요.\n' +
        '"절대로 다른 길로 새면 안 된다!"\n' +
        '엄마의 당부를 되새기며 빨간 모자는 씩씩하게 숲길을 걸어갔어요.',
      illustrationPrompt: buildRedRidingHoodPrompt(
        '빨간 모자가 할머니에게 드릴 달콤한 빵과 버터가 든 바구니를 들고 씩씩하게 꽃길을 걸어가는 장면',
        '[정면 뷰]: 정면을 바라보는 밝고 씩씩한 미소. <protagonist_identity> 인물의 고유 눈매와 입매를 그대로 살려 기대감으로 눈이 반짝이고, 눈썹과 입가가 자연스럽게 올라간 표정.',
      ),
      baseImageKey: 'templates/red-riding-hood/page-1.png',
      personaTargetRole: 'red-hood',
      characters: [{ role: 'red-hood', hitbox: { x: 0.21, y: 0.2, width: 0.36, height: 0.61 } }],
    },
    {
      pageNo: 2,
      bodyText:
        '알록달록한 들꽃을 구경하던 빨간 모자 앞에 잿빛 늑대가 나타났어요.\n' +
        '"귀여운 꼬마야, 어디 가니?"\n' +
        '늑대의 다정한 목소리에 빨간 모자는 할머니 댁으로 간다고 말해 버렸어요.\n' +
        '늑대는 씩 웃으며 숲속으로 사라졌지요.',
      illustrationPrompt: buildRedRidingHoodPrompt(
        '들꽃에 마음을 빼앗긴 빨간 모자 앞에 나타난 상냥한 척하는 늑대에게 순진하게 할머니 댁을 말해주는 장면',
        '[오른쪽 위 시선]: 커다란 늑대를 올려다보며 순진하게 말을 건네는 천진난만한 미소. 원본의 왼쪽 배치와 바구니 든 손을 유지.',
      ),
      baseImageKey: 'templates/red-riding-hood/page-2.png',
      personaTargetRole: 'red-hood',
      characters: [
        { role: 'red-hood', hitbox: { x: 0.15, y: 0.25, width: 0.34, height: 0.61 } },
        { role: 'wolf', hitbox: { x: 0.46, y: 0.13, width: 0.48, height: 0.7 } },
      ],
    },
    {
      pageNo: 3,
      bodyText:
        '할머니 오두막에 도착한 빨간 모자는 침대에 누운 할머니를 보고 고개를 갸웃했어요.\n' +
        '"할머니, 귀가 왜 이렇게 크세요?"\n' +
        '"네 목소리를 잘 들으려고 그렇단다."\n' +
        '"그런데 입은 왜 이렇게 커요?"\n' +
        '"그건 널 꿀꺽 삼키기 위해서지!"\n' +
        '늑대가 이불을 걷어차며 사납게 달려들었어요!',
      illustrationPrompt: buildRedRidingHoodPrompt(
        '할머니 오두막 침대에서 이불을 걷어차며 달려드는 늑대를 보고 깜짝 놀라는 장면',
        '[오른쪽 위 시선]: 침대에서 몸을 일으킨 늑대를 올려다보며 눈을 크게 뜨고 입을 벌린 깜짝 놀란 표정. 원본의 침대 왼쪽에 서 있는 자세, 가슴 앞으로 모은 손과 바구니 위치를 유지.',
      ),
      baseImageKey: 'templates/red-riding-hood/page-3.png',
      personaTargetRole: 'red-hood',
      characters: [
        { role: 'red-hood', hitbox: { x: 0.07, y: 0.22, width: 0.37, height: 0.59 } },
        { role: 'wolf', hitbox: { x: 0.46, y: 0.11, width: 0.49, height: 0.64 } },
      ],
    },
    {
      pageNo: 4,
      bodyText:
        '빨간 모자가 소리치자 사냥꾼 아저씨가 오두막으로 달려왔어요.\n' +
        '사냥꾼은 늑대를 쫓아내고 벽장에 갇혀 있던 할머니를 구해 주었지요.\n' +
        '빨간 모자는 할머니 품에 꼭 안겼어요.\n' +
        '"이제 낯선 사람 말은 쉽게 믿지 않을게요."',
      illustrationPrompt: buildRedRidingHoodPrompt(
        '용감한 사냥꾼이 늑대를 제압한 뒤, 빨간 모자가 안전하게 구출된 할머니 품에 안겨 안도하는 장면',
        '[왼쪽을 향한 안도]: 할머니와 꼭 안겨 눈을 감고 환하게 웃는 안도한 표정. 원본의 포옹 자세와 열린 문 쪽으로 나가는 사냥꾼·늑대를 유지.',
      ),
      baseImageKey: 'templates/red-riding-hood/page-4.png',
      personaTargetRole: 'red-hood',
      characters: [
        { role: 'red-hood', hitbox: { x: 0.17, y: 0.25, width: 0.34, height: 0.56 } },
        { role: 'grandmother', hitbox: { x: 0.24, y: 0.18, width: 0.4, height: 0.66 } },
        { role: 'hunter', hitbox: { x: 0.57, y: 0.1, width: 0.31, height: 0.52 } },
        { role: 'wolf', hitbox: { x: 0.75, y: 0.29, width: 0.15, height: 0.28 } },
      ],
    },
    {
      pageNo: 5,
      bodyText:
        '소동이 지나간 뒤, 숲의 동물 친구들이 오두막 창가로 찾아왔어요.\n' +
        '다람쥐는 산딸기를, 작은 새는 솔방울을 선물했지요.\n' +
        '빨간 모자는 할머니와 동물 친구들에게 고맙다고 인사했어요.\n' +
        '그리고 숲길을 걸을 때는 늘 조심하고, 도움이 필요한 친구는 살피겠다고 약속했답니다.',
      illustrationPrompt: buildRedRidingHoodPrompt(
        '평화를 되찾은 오두막에서 빨간 모자가 할머니와 함께 창가를 찾아온 다람쥐와 새들에게 고마워하는 장면',
        '[왼쪽을 향한 다정한 미소]: 할머니와 함께 창가 동물 친구들을 보며 따뜻하게 웃는 표정. 원본의 창가 구도와 두 인물의 포옹 자세를 유지.',
      ),
      baseImageKey: 'templates/red-riding-hood/page-5.png',
      personaTargetRole: 'red-hood',
      characters: [
        { role: 'red-hood', hitbox: { x: 0.18, y: 0.25, width: 0.33, height: 0.55 } },
        { role: 'grandmother', hitbox: { x: 0.39, y: 0.18, width: 0.34, height: 0.6 } },
      ],
    },
  ],
  afterStory: {
    choices: [
      {
        branchKey: 'a', title: '아기 다람쥐를 집으로 데려다줘요', description: '길을 잃고 울고 있는 아기 다람쥐를 만났어요.',
        page: { pageNo: 6, bodyText: '다음 날, 빨간 모자는 풀숲에서 훌쩍이는 아기 다람쥐를 만났어요.\n아기 다람쥐는 집으로 가는 길을 잊어버렸다고 했지요.\n빨간 모자는 천천히 주변을 살피며 다람쥐와 함께 걸었어요.\n커다란 참나무 아래에서 엄마 다람쥐를 찾자, 숲에는 기쁜 인사가 가득 울려 퍼졌답니다.', illustrationPrompt: buildRedRidingHoodPrompt('따뜻한 햇살이 드는 커다란 참나무 굴 앞에서 아기 다람쥐와 엄마 다람쥐가 다시 만나 코를 맞대는 모습을, 빨간 모자가 가까이 앉아 다정하게 바라보는 장면', '[오른쪽 아래 시선]: 다시 만난 다람쥐 가족을 바라보며 눈을 감고 환하게 웃는 따뜻한 표정. 원본의 나무 왼쪽에 무릎을 굽혀 앉은 자세, 무릎 위에 모은 두 손과 빨간 두건 위치를 유지.'), baseImageKey: 'templates/red-riding-hood/page-6-a.png', personaTargetRole: 'red-hood', characters: [{ role: 'red-hood', hitbox: { x: 0.09, y: 0.27, width: 0.37, height: 0.42 } }] },
      },
      {
        branchKey: 'b', title: '숲길에 빨간 리본을 달아요', description: '누구나 길을 잃지 않도록 숲길 표지를 만들어요.',
        page: { pageNo: 6, bodyText: '빨간 모자는 할머니와 함께 숲길의 갈림길마다 빨간 리본을 달았어요.\n동물 친구들도 솔방울과 나뭇잎으로 작은 표지를 만들었지요.\n이제 숲에 오는 누구나 길을 쉽게 찾을 수 있었어요.\n빨간 모자는 바람에 흔들리는 리본을 보며 환하게 웃었답니다.', illustrationPrompt: buildRedRidingHoodPrompt('햇살이 드는 숲길에서 빨간 모자와 할머니가 큰 참나무에 길을 알리는 빨간 리본을 함께 묶고, 다람쥐와 새들이 솔방울과 나뭇잎으로 숲길 표지를 만드는 장면', '[위쪽 시선]: 할머니와 함께 나무의 리본을 묶으며 눈을 감고 환하게 웃는 뿌듯한 표정. 원본의 나무 앞에 서서 두 팔을 위로 든 자세, 리본과 할머니의 손 위치를 유지.'), baseImageKey: 'templates/red-riding-hood/page-6-b.png', personaTargetRole: 'red-hood', characters: [{ role: 'red-hood', hitbox: { x: 0.17, y: 0.17, width: 0.28, height: 0.49 } }, { role: 'grandmother', hitbox: { x: 0.31, y: 0.07, width: 0.3, height: 0.56 } }] },
      },
    ],
  },
};

export const OFFICIAL_STORIES: OfficialStoryData[] = [
  JACK_AND_BEANSTALK_STORY,
  RED_RIDING_HOOD_STORY,
];
