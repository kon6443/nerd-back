import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StoryTemplate } from './story-template.entity';

/**
 * 동화 본편의 한 페이지 (SPEC-004 Story Reader).
 *
 * 페이지 순서는 사전에 정의된 `pageNo` 를 따른다 — AI 가 순서를 바꾸지 않는다
 * (`product-spec.md` §2.3 Controlled Generation).
 */
@Entity('story_pages')
export class StoryPage {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'template_id', type: 'int', unsigned: true })
  templateId: number;

  @ManyToOne(() => StoryTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: StoryTemplate;

  /** 1부터 시작하는 페이지 번호. 분기 결과는 같은 6쪽 번호를 공유한다. */
  @Column({ name: 'page_no', type: 'smallint', unsigned: true })
  pageNo: number;

  /** `common`은 본편, `a`·`b`는 서로 다른 비하인드 결과다. */
  @Column({ name: 'branch_key', type: 'varchar', length: 16, default: 'common' })
  branchKey: 'common' | 'a' | 'b';

  @Column({ name: 'body_text', type: 'text' })
  bodyText: string;

  /** 개인화 전 기본 삽화의 오브젝트 키. 키를 저장하는 이유는 `StoryTemplate.coverImageKey` 주석 참조. */
  @Column({ name: 'base_image_key', type: 'varchar', length: 512, nullable: true })
  baseImageKey: string | null;

  /**
   * 이 페이지에서 **사용자 얼굴로 개인화할 주인공의 배역**. `StoryCharacter.role` 을 가리킨다.
   *
   * SPEC-003 의 "각 페이지에서 사용자 얼굴을 적용할 주인공이 사전에 정의되어 있어야 한다" 가
   * 이 컬럼이다. `null` 이면 그 페이지는 개인화 대상이 아니다 (주인공이 등장하지 않는 장면).
   *
   * ⚠️ 참조 무결성을 FK 로 강제하지 않는다 — 대상이 `story_characters` 의 `(template_id, role)`
   * 복합키라 단일 컬럼 FK 로 표현되지 않는다. 정합성은 콘텐츠 투입 시점에 확인한다.
   */
  @Column({ name: 'persona_target_role', type: 'varchar', length: 64, nullable: true })
  personaTargetRole: string | null;

  /**
   * AI 이미지 생성 모델에 전달할 페이지별 맞춤 삽화 지시문.
   * `null` 이면 `bodyText` 기반 기본 프롬프트로 생성된다.
   */
  @Column({ name: 'illustration_prompt', type: 'text', nullable: true })
  illustrationPrompt: string | null;
}
