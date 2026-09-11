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

      it('공통 본편은 1부터 5까지 빈틈없이 이어진다', () => {
        const pageNumbers = story.pages.map((page) => page.pageNo);
        expect(pageNumbers).toEqual([1, 2, 3, 4, 5]);
      });

      it('비하인드는 서로 다른 A/B 결과 6쪽과 선택지 메타를 가진다', () => {
        expect(story.afterStory.choices).toHaveLength(2);
        expect(story.afterStory.choices.map((choice) => choice.branchKey)).toEqual(['a', 'b']);
        expect(story.afterStory.choices.map((choice) => choice.page.pageNo)).toEqual([6, 6]);
        story.afterStory.choices.forEach((choice) => {
          expect(choice.title.trim()).not.toHaveLength(0);
          expect(choice.description.trim()).not.toHaveLength(0);
        });
      });

      it('배역 키가 중복되지 않는다', () => {
        expect(roles.size).toBe(story.characters.length);
      });

      it('personaTargetRole 이 실제 존재하는 배역을 가리킨다', () => {
        const targets = [...story.pages, ...story.afterStory.choices.map((choice) => choice.page)]
          .map((page) => page.personaTargetRole)
          .filter((role): role is string => role !== null);

        expect(targets.length).toBeGreaterThan(0);
        targets.forEach((role) => expect(roles).toContain(role));
      });

      it('페이지에 등장하는 배역도 전부 정의되어 있다', () => {
        [...story.pages, ...story.afterStory.choices.map((choice) => choice.page)].forEach((page) => {
          page.characters.forEach((character) => expect(roles).toContain(character.role));
        });
      });

      it('개인화 대상이 그 페이지에 실제로 등장한다', () => {
        [...story.pages, ...story.afterStory.choices.map((choice) => choice.page)].forEach((page) => {
          if (page.personaTargetRole === null) return;

          const appearing = page.characters.map((character) => character.role);
          expect(appearing).toContain(page.personaTargetRole);
        });
      });

      it('hitbox 가 0~1 정규 좌표이고 화면을 벗어나지 않는다', () => {
        [...story.pages, ...story.afterStory.choices.map((choice) => choice.page)].forEach((page) => {
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
        [...story.pages, ...story.afterStory.choices.map((choice) => choice.page)].forEach((page) => expect(page.bodyText.trim().length).toBeGreaterThan(0));
        story.characters.forEach((character) => {
          expect(character.persona.trim().length).toBeGreaterThan(0);
          expect(character.displayName.trim().length).toBeGreaterThan(0);
        });
      });

      it('개인화 프롬프트가 얼굴과 헤어스타일만 교체하고 원본 장면을 보존한다', () => {
        [...story.pages, ...story.afterStory.choices.map((choice) => choice.page)].forEach((page) => {
          expect(page.illustrationPrompt).toContain('face and hairstyle identity reference');
          expect(page.illustrationPrompt).toContain('childlike proportions');
          expect(page.illustrationPrompt).toContain('expression, emotion, gaze direction');
          expect(page.illustrationPrompt).toContain('minimal surrounding area');
          expect(page.illustrationPrompt).toContain('Do not use them to redesign');
          expect(page.illustrationPrompt).toContain('Return one edited illustration only.');
        });
      });
    });
  });
});
