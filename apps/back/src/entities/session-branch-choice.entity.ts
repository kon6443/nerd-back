import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { StorySession } from './story-session.entity';

/** 세션의 최초 A/B 선택. 재독 중 결과 열람은 이 행을 변경하지 않는다. */
@Entity('session_branch_choices')
@Unique('uq_session_branch_choices_session', ['sessionId'])
export class SessionBranchChoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id', type: 'varchar', length: 36 })
  sessionId: string;

  @Column({ name: 'branch_key', type: 'varchar', length: 16 })
  branchKey: 'a' | 'b';

  @CreateDateColumn({ name: 'selected_at', type: 'datetime', precision: 3 })
  selectedAt: Date;

  @ManyToOne(() => StorySession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: StorySession;
}
