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
import { User } from './user.entity';
import { StoryTemplate } from './story-template.entity';

export type StorySessionStatus = 'draft' | 'face_ready' | 'generating' | 'completed' | 'failed';

/**
 * 개인화 동화 제작 세션.
 *
 * 1인당 동화 템플릿 1회 생성 제한을 `UNIQUE(user_id, template_id)` 로 강제한다 (Slice 3).
 * 🚫 미완료 세션(draft, failed)은 재사용되어 사용자의 재시도를 허용한다.
 */
@Entity('story_sessions')
@Unique('uq_story_sessions_user_template', ['userId', 'templateId'])
export class StorySession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId: number;

  @Column({ name: 'template_id', type: 'int', unsigned: true })
  templateId: number;

  @Column({
    type: 'enum',
    enum: ['draft', 'face_ready', 'generating', 'completed', 'failed'],
    default: 'draft',
  })
  status: StorySessionStatus;

  /**
   * 주인공 캐릭터 레퍼런스 이미지의 S3 객체 키.
   * 원본 얼굴 사진은 폐기되며, 이 레퍼런스 키로 6장의 동화 삽화를 개인화한다.
   */
  @Column({ name: 'reference_image_key', type: 'varchar', length: 512, nullable: true })
  referenceImageKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => StoryTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: StoryTemplate;
}
