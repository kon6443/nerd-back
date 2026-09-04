import { z } from 'zod';

/**
 * slug 형식 — 소문자·숫자·하이픈만.
 *
 * 형식을 좁히는 것 자체가 방어다. 경로 조각이 그대로 조회 조건에 들어가므로
 * 여기서 걸러야 이상한 입력이 서비스 계층까지 내려가지 않는다.
 */
export const storySlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug 형식이 올바르지 않습니다.');

export const storySlugParamsSchema = z.object({ slug: storySlugSchema }).strict();

export const storyPageParamsSchema = z
  .object({
    slug: storySlugSchema,
    /**
     * 경로 파라미터는 문자열로 도착한다. **명시적으로 변환한다** —
     * 🚫 프레임워크의 암묵 변환에 기대지 않는다. 어디서 변환됐는지 보이는 편이 낫다.
     */
    pageNo: z.coerce
      .number()
      .int('pageNo 는 정수여야 합니다.')
      .min(1, 'pageNo 는 1 이상이어야 합니다.'),
  })
  .strict();

export type StorySlugParams = z.infer<typeof storySlugParamsSchema>;
export type StoryPageParams = z.infer<typeof storyPageParamsSchema>;

/**
 * 캐릭터의 터치 영역. **0~1 로 정규화된 비율**이다.
 * 픽셀로 두면 삽화 해상도를 바꾸는 순간 전부 어긋난다.
 */
export interface StoryCharacterHitbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StorySummary {
  slug: string;
  title: string;
  summary: string | null;
  /** 오브젝트 **키**다. URL 이 아니다 — 스토리지 공급자를 바꿔도 저장된 값이 살아남는다. */
  coverImageKey: string | null;
}

export interface StoryCharacterSummary {
  /** 배역 키. 대화 API 의 경로가 이 값을 쓴다. */
  role: string;
  displayName: string;
}

export interface StoryDetail extends StorySummary {
  pageCount: number;
  /** 🚫 `persona` 는 내보내지 않는다 — 프롬프트 설계가 노출되면 스포일러의 재료가 된다. */
  characters: StoryCharacterSummary[];
}

export interface StoryPageCharacter extends StoryCharacterSummary {
  hitbox: StoryCharacterHitbox | null;
}

export interface StoryPageView {
  pageNo: number;
  bodyText: string;
  baseImageKey: string | null;
  /** 사용자 얼굴로 개인화할 배역. `null` 이면 그 페이지는 개인화 대상이 아니다. */
  personaTargetRole: string | null;
  characters: StoryPageCharacter[];
}
