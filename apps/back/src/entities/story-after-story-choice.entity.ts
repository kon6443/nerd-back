import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { StoryTemplate } from './story-template.entity';

/** 비하인드 선택 UI가 표시할 A/B 제목과 설명. 결과 원고·삽화는 `story_pages`가 소유한다. */
@Entity('story_after_story_choices')
@Unique('uq_story_after_story_choices_template_branch', ['templateId', 'branchKey'])
export class StoryAfterStoryChoice {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'template_id', type: 'int', unsigned: true })
  templateId: number;

  @Column({ name: 'branch_key', type: 'varchar', length: 16 })
  branchKey: 'a' | 'b';

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  description: string;

  @ManyToOne(() => StoryTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: StoryTemplate;
}
