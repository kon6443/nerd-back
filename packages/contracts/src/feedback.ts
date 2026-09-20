import { z } from 'zod';

/**
 * 피드백 카테고리.
 */
export const FEEDBACK_CATEGORIES = ['bug', 'feature', 'ux', 'other'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: '버그 신고',
  feature: '기능 제안',
  ux: '사용성/디자인',
  other: '기타',
};

export const feedbackCategorySchema = z.enum(FEEDBACK_CATEGORIES);

/**
 * 피드백 생성 요청 스키마.
 */
export const createFeedbackSchema = z
  .object({
    category: feedbackCategorySchema,
    title: z
      .string()
      .trim()
      .min(1, '제목을 입력해주세요.')
      .max(50, '제목은 최대 50자까지 입력 가능합니다.'),
    content: z
      .string()
      .trim()
      .min(5, '내용은 최소 5자 이상 입력해주세요.')
      .max(1000, '내용은 최대 1,000자까지 입력 가능합니다.'),
    pageUrl: z.string().max(255).optional(),
    deviceInfo: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;

export interface FeedbackResult {
  id: number;
  category: FeedbackCategory;
  title: string;
  createdAt: string;
}
