import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StoryCharacter } from './story-character.entity';
import { StoryPage } from './story-page.entity';

/**
 * 페이지에 등장하는 캐릭터의 터치 영역.
 *
 * 정규화된 비율(0~1)로 저장한다. 픽셀로 저장하면 삽화 해상도를 바꾸는 순간 전부 어긋난다.
 */
export interface StoryCharacterHitbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * "이 페이지에서 이 캐릭터와 대화할 수 있다"는 사실 (SPEC-004 · SPEC-005).
 *
 * 대화 가능 여부를 `StoryCharacter` 에 두지 않는 이유: 같은 캐릭터라도 등장하지 않는 페이지가
 * 있고, 터치 영역은 **페이지마다 다르다.** 페이지 × 캐릭터의 교차 테이블이 이 사실의 자리다.
 */
@Entity('story_page_characters')
export class StoryPageCharacter {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id: number;

  @Column({ name: 'page_id', type: 'int', unsigned: true })
  pageId: number;

  @ManyToOne(() => StoryPage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'page_id' })
  page: StoryPage;

  @Column({ name: 'character_id', type: 'int', unsigned: true })
  characterId: number;

  @ManyToOne(() => StoryCharacter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'character_id' })
  character: StoryCharacter;

  /** 터치 영역. `null` 이면 화면에 표시하되 좌표는 프론트가 정한다. */
  @Column({ name: 'hitbox', type: 'json', nullable: true })
  hitbox: StoryCharacterHitbox | null;
}
