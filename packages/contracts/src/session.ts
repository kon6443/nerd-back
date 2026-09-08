import { z } from 'zod';
import { storySlugSchema } from './story';

/**
 * 동화 제작 세션 상태.
 * - draft: 세션 생성됨, 얼굴 사진 대기
 * - face_ready: 얼굴 업로드 및 캐릭터 레퍼런스 생성 완료
 * - generating: 6장 삽화 비동기 생성 진행 중 (Slice 4)
 * - completed: 개인화 동화 제작 완료 (영구 보관)
 * - failed: 생성 실패 (재시도 가능)
 */
export const storySessionStatusSchema = z.enum([
  'draft',
  'face_ready',
  'generating',
  'completed',
  'failed',
]);

export type StorySessionStatus = z.infer<typeof storySessionStatusSchema>;

/**
 * 세션 생성 요청 계약.
 * 사용자가 동화를 선택하고 [내 얼굴로 만들기]를 눌렀을 때 발송.
 */
export const createSessionSchema = z
  .object({
    templateSlug: storySlugSchema,
  })
  .strict();

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

/** 세션 ID 경로 파라미터 */
export const sessionIdParamsSchema = z
  .object({
    id: z.string().uuid('유효하지 않은 세션 ID입니다.'),
  })
  .strict();

export type SessionIdParams = z.infer<typeof sessionIdParamsSchema>;

/** 세션 요약 정보 */
export interface StorySessionSummary {
  id: string;
  templateSlug: string;
  status: StorySessionStatus;
  referenceImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 얼굴 사진 업로드 응답 계약 */
export interface UploadFaceResponse {
  id: string;
  status: 'face_ready';
  referenceImageUrl: string;
}
