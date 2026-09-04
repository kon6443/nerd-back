import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StoryTemplate } from './story-template.entity';

/**
 * 등장인물과 그 Character Context (SPEC-005).
 *
 * `persona` 는 대화 생성에 쓰는 사전 정의 정보(성격·말투·역할)다. 캐릭터 대화가
 * 본편의 사건 순서와 결말을 바꾸지 않게 하는 근거가 여기 담긴다.
 */
@Entity('story_characters')
export class StoryCharacter {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'template_id', type: 'int', unsigned: true })
  templateId: number;

  @ManyToOne(() => StoryTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: StoryTemplate;

  /**
   * 배역 키. 동화 안에서 유일하다 (`wolf`, `protagonist` 등).
   *
   * 표시 이름(`displayName`)과 분리한 이유: 표시 이름은 카피 수정으로 바뀌지만 배역 키는
   * `StoryPage.personaTargetRole` 과 API 경로가 참조하는 **계약**이다. 하나로 합치면
   * 문구를 다듬는 것만으로 개인화 대상이 끊긴다.
   */
  @Column({ name: 'role', type: 'varchar', length: 64 })
  role: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName: string;

  /**
   * 성격·말투·설정. LLM 프롬프트의 재료다.
   *
   * 🚫 **이 값을 응답에 그대로 실어 보내지 않는다.** 프롬프트 설계가 노출되면 본편 스포일러와
   * 우회 질문의 재료가 된다 (NFR-002). 조회 API 는 `displayName` 까지만 내보낸다.
   */
  @Column({ name: 'persona', type: 'text', select: false })
  persona: string;
}
