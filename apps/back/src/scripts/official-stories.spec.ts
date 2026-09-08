import { storySlugSchema } from '@nerd/contracts';
import { OFFICIAL_STORIES } from './official-stories';

describe('정식 동화 데이터셋 (잭과 콩나무, 빨간 모자)', () => {
  it('모든 동화가 정의되어 있다 (2권)', () => {
    expect(OFFICIAL_STORIES).toHaveLength(2);
  });

  OFFICIAL_STORIES.forEach((story) => {
    describe(`동화: ${story.title} (${story.slug})`, () => {
      const roles = new Set(story.characters.map((character) => character.role));

      it('slug 가 계약 형식을 통과한다', () => {
        expect(() => storySlugSchema.parse(story.slug)).not.toThrow();
      });

      it('페이지 번호가 1부터 6까지 빈틈없이 이어진다 (본편 4 + 비하인드 2)', () => {
        const pageNumbers = story.pages.map((page) => page.pageNo);
        expect(pageNumbers).toEqual([1, 2, 3, 4, 5, 6]);
      });

      it('배역 키가 중복되지 않는다', () => {
        expect(roles.size).toBe(story.characters.length);
      });

      it('personaTargetRole 이 실제 존재하는 배역을 가리킨다', () => {
        const targets = story.pages
          .map((page) => page.personaTargetRole)
          .filter((role): role is string => role !== null);

        expect(targets.length).toBeGreaterThan(0);
        targets.forEach((role) => expect(roles).toContain(role));
      });

      it('페이지에 등장하는 배역도 전부 정의되어 있다', () => {
        story.pages.forEach((page) => {
          page.characters.forEach((character) => expect(roles).toContain(character.role));
        });
      });

      it('개인화 대상이 그 페이지에 실제로 등장한다', () => {
        story.pages.forEach((page) => {
          if (page.personaTargetRole === null) return;

          const appearing = page.characters.map((character) => character.role);
          expect(appearing).toContain(page.personaTargetRole);
        });
      });

      it('hitbox 가 0~1 정규 좌표이고 화면을 벗어나지 않는다', () => {
        story.pages.forEach((page) => {
          page.characters.forEach(({ hitbox }) => {
            if (hitbox === null) return;

            expect(hitbox.width).toBeGreaterThan(0);
            expect(hitbox.height).toBeGreaterThan(0);
            expect(hitbox.x).toBeGreaterThanOrEqual(0);
            expect(hitbox.y).toBeGreaterThanOrEqual(0);
            expect(hitbox.x + hitbox.width).toBeLessThanOrEqual(1);
            expect(hitbox.y + hitbox.height).toBeLessThanOrEqual(1);
          });
        });
      });

      it('본문과 persona, displayName 이 모두 채워져 있다', () => {
        story.pages.forEach((page) => expect(page.bodyText.trim().length).toBeGreaterThan(0));
        story.characters.forEach((character) => {
          expect(character.persona.trim().length).toBeGreaterThan(0);
          expect(character.displayName.trim().length).toBeGreaterThan(0);
        });
      });
    });
  });
});
