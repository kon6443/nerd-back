import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 동화 템플릿 — 서비스가 사전에 제작하는 콘텐츠의 최상위 단위.
 *
 * 🚫 **사용자가 쓰지 않는다.** 이 테이블은 운영이 넣고 앱은 읽기만 한다
 * (`ideas/my-story/product-spec.md` §3 Content Model).
 *
 * ⚠️ `length`·`nullable` 은 **런타임 효과가 없다** (`synchronize: false`). 실제 제약은
 * 마이그레이션이 만든 스키마만 강제한다. 여기 표기는 읽는 사람을 위한 것이다.
 */
@Entity('story_templates')
export class StoryTemplate {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  /**
   * 외부에 노출하는 식별자. 프론트 URL 과 API 경로가 이 값을 쓴다.
   *
   * 자동증가 `id` 를 노출하지 않는 이유: 콘텐츠 수가 그대로 드러나고, 경로를 1씩 바꿔가며
   * 미공개(`draft`) 동화를 찾는 시도가 쉬워진다.
   */
  @Column({ name: 'slug', type: 'varchar', length: 64 })
  slug: string;

  @Column({ name: 'title', type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'summary', type: 'varchar', length: 500, nullable: true })
  summary: string | null;

  /**
   * 대표 이미지의 오브젝트 키. **URL 이 아니라 키를 저장한다** — 스토리지가 아직 미정이고
   * (`docs/tasks/tasks-my-story-backend.md` D1), 전체 URL 을 넣으면 공급자를 바꿀 때
   * 저장된 행 전부가 무효가 된다. 키 → URL 변환은 조회 시점의 책임이다.
   */
  @Column({ name: 'cover_image_key', type: 'varchar', length: 512, nullable: true })
  coverImageKey: string | null;

  /** `published` 만 목록·상세에 노출한다. 제작 중인 동화가 새어나가지 않게 하는 유일한 방어다. */
  @Column({ name: 'status', type: 'varchar', length: 20 })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 3 })
  updatedAt: Date;
}

/** 공개 상태 값. 컬럼을 `varchar` 로 둔 이유는 마이그레이션 파일의 주석 참조. */
export const STORY_TEMPLATE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
} as const;
