import { z } from 'zod';
import { storyPageParamsSchema } from './story';
import type { StoryCharacterSummary } from './story';

export const storyChatParamsSchema = z
  .object({
    sessionId: z.string().uuid(),
    pageNo: storyPageParamsSchema.shape.pageNo,
  })
  .strict();
export const storyChatQuerySchema = z
  .object({
    branchKey: z.enum(['common', 'a', 'b']).default('common'),
  })
  .strict();
export type StoryChatBranchKey = z.infer<typeof storyChatQuerySchema>['branchKey'];

export const STORY_CHAT_MAX_MESSAGE_LENGTH = 300;

export const storyChatInputSchema = z
  .object({
    role: z.string().min(1, '대화할 등장인물을 골라 주세요.').max(64),
    message: z
      .string()
      .trim()
      .min(1, '질문을 입력해 주세요.')
      .max(STORY_CHAT_MAX_MESSAGE_LENGTH, '질문은 300자까지 입력할 수 있어요.'),
  })
  .strict();

export type StoryChatInput = z.infer<typeof storyChatInputSchema>;
export type StoryChatStatus = 'available' | 'pending' | 'completed' | 'failed' | 'unavailable';

export const storyReplyAudioStatusSchema = z.enum([
  'not_requested',
  'pending',
  'completed',
  'failed',
]);
export type StoryReplyAudioStatus = z.infer<typeof storyReplyAudioStatusSchema>;

export interface StoryChatExchange {
  role: string;
  displayName: string;
  message: string;
  reply: string | null;
  /** 저장된 답변 음성의 만료 서명 URL. 오브젝트 키는 공개하지 않는다. */
  replyAudioUrl: string | null;
  replyAudioStatus: StoryReplyAudioStatus;
}

/** 보관된 동화의 장면 전체에서 1회. A/B는 별도 장면이며 같은 장면의 등장인물은 횟수를 공유한다. */
export interface StoryChatView {
  characters: StoryCharacterSummary[];
  status: StoryChatStatus;
  remainingMessages: 0 | 1;
  exchange: StoryChatExchange | null;
}
