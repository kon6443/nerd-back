import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { StorySession } from './story-session.entity';
import type { SessionPageStatus } from '@nerd/contracts';

/**
 * 개인화 동화책의 페이지별 생성된 삽화 (Slice 4).
 *
 * 한 세션 안에서 `(page_no, branch_key)`가 유일하다. A/B 결과는 모두 6쪽이다.
 */
@Entity('session_page_images')
@Unique('uq_session_page_images_session_page_branch', ['sessionId', 'pageNo', 'branchKey'])
export class SessionPageImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  @Column({ name: 'page_no', type: 'smallint', unsigned: true })
  pageNo: number;

  @Column({ name: 'branch_key', type: 'varchar', length: 16, default: 'common' })
  branchKey: 'common' | 'a' | 'b';

  @Column({
    type: 'enum',
    enum: ['pending', 'running', 'succeeded', 'failed'],
    default: 'pending',
  })
  status: SessionPageStatus;

  /**
   * 생성된 삽화 이미지의 스토리지 객체 키.
   */
  @Column({ name: 'image_key', type: 'varchar', length: 512, nullable: true })
  imageKey: string | null;

  @Column({ name: 'error_message', type: 'varchar', length: 512, nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @ManyToOne(() => StorySession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: StorySession;
}
