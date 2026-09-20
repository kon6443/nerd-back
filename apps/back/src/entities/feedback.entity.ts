import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * 사용자 피드백.
 *
 * 서비스 개선을 위해 사용자가 남긴 의견·버그 제보·제안 사항을 저장한다.
 */
@Entity('feedbacks')
export class Feedback {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'category', type: 'varchar', length: 32 })
  category: string;

  @Column({ name: 'title', type: 'varchar', length: 50 })
  title: string;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({ name: 'page_url', type: 'varchar', length: 255, nullable: true })
  pageUrl: string | null;

  @Column({ name: 'device_info', type: 'json', nullable: true })
  deviceInfo: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;
}
