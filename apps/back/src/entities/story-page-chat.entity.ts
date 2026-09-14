import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { StoryPage } from './story-page.entity';
import { User } from './user.entity';
import { StorySession } from './story-session.entity';
import type { StoryReplyAudioStatus } from '@nerd/contracts';

/** LLM 호출 전에 영속 예약한다. 실패·재접속·레플리카 변경으로 횟수가 복구되지 않는다. */
@Entity('story_page_chats')
@Unique('uq_story_page_chats_session_page', ['sessionId', 'pageId'])
@Index('ix_story_page_chats_user', ['userId'])
export class StoryPageChat {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  @ManyToOne(() => StorySession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: StorySession;

  @Column({ name: 'page_id', type: 'int', unsigned: true })
  pageId: number;

  @ManyToOne(() => StoryPage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page: StoryPage;

  @Column({ type: 'varchar', length: 64 })
  role: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName: string;

  @Column({ type: 'varchar', length: 300 })
  message: string;

  @Column({ type: 'text', nullable: true })
  reply: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: 'pending' | 'completed' | 'failed';

  /** 생성된 캐릭터 답변 MP3의 오브젝트 키. */
  @Column({ name: 'reply_audio_key', type: 'varchar', length: 512, nullable: true })
  replyAudioKey: string | null;

  /** LLM 답변 상태와 독립적인 음성 생성 상태. */
  @Column({ name: 'reply_audio_status', type: 'varchar', length: 16, default: 'not_requested' })
  replyAudioStatus: StoryReplyAudioStatus;

  /** 음성 선점·완료·실패가 마지막으로 바뀐 시각. 오래된 pending 회수 기준이다. */
  @Column({ name: 'reply_audio_updated_at', type: 'datetime', precision: 3, nullable: true })
  replyAudioUpdatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}
