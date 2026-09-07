import { storySlugSchema } from '@nerd/contracts';
import { DEV_FIXTURE_SLUG_PREFIX, DEV_FIXTURE_STORY } from './dev-fixture';

/**
 * 픽스처 데이터의 **정합성 검사**. DB 없이 돈다.
 *
 * 이 spec 이 하는 일은 스키마가 못 하는 일이다 — `personaTargetRole` 은 FK 가 없고
 * (대상이 `(template_id, role)` 복합키라 단일 컬럼으로 못 가리킨다), 페이지 번호의 연속성도
 * DB 는 모른다. 오타 하나가 "개인화가 조용히 안 되는" 형태로 나가는 것을 여기서 막는다.
 */
describe('개발용 픽스처', () => {
  const roles = new Set(DEV_FIXTURE_STORY.characters.map((character) => character.role));

  it('slug 가 계약 형식을 통과하고 dev- 접두사를 갖는다 ⭐', () => {
    // 접두사가 없으면 상용에 남았을 때 실 콘텐츠와 구분해 지울 수 없다.
    expect(() => storySlugSchema.parse(DEV_FIXTURE_STORY.slug)).not.toThrow();
    expect(DEV_FIXTURE_STORY.slug.startsWith(DEV_FIXTURE_SLUG_PREFIX)).toBe(true);
  });

  it('페이지 번호가 1부터 빈틈없이 이어진다', () => {
    // 중간이 비면 리더의 "다음 페이지" 가 404 로 끊긴다.
    const pageNumbers = DEV_FIXTURE_STORY.pages.map((page) => page.pageNo);

    expect(pageNumbers).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('배역 키가 중복되지 않는다 — (template_id, role) 이 UNIQUE 다', () => {
    expect(roles.size).toBe(DEV_FIXTURE_STORY.characters.length);
  });

  it('personaTargetRole 이 실제 존재하는 배역을 가리킨다 ⭐', () => {
    // FK 가 없는 자리다. 오타가 나면 그 페이지의 개인화가 조용히 빠진다.
    const targets = DEV_FIXTURE_STORY.pages
      .map((page) => page.personaTargetRole)
      .filter((role): role is string => role !== null);

    expect(targets.length).toBeGreaterThan(0);
    targets.forEach((role) => expect(roles).toContain(role));
  });

  it('페이지에 등장하는 배역도 전부 정의되어 있다', () => {
    DEV_FIXTURE_STORY.pages.forEach((page) => {
      page.characters.forEach((character) => expect(roles).toContain(character.role));
    });
  });

  it('개인화 대상이 그 페이지에 실제로 등장한다', () => {
    // 등장하지 않는 배역을 개인화 대상으로 두면 얼굴을 넣을 자리가 없다.
    DEV_FIXTURE_STORY.pages.forEach((page) => {
      if (page.personaTargetRole === null) return;

      const appearing = page.characters.map((character) => character.role);
      expect(appearing).toContain(page.personaTargetRole);
    });
  });

  it('hitbox 가 0~1 정규 좌표이고 화면을 벗어나지 않는다', () => {
    // 픽셀 값이 섞여 들어오면(예: 320) 프론트가 화면 밖에 터치 영역을 그린다.
    DEV_FIXTURE_STORY.pages.forEach((page) => {
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

  it('한 페이지 안에서 같은 배역이 두 번 나오지 않는다 — (page_id, character_id) UNIQUE', () => {
    DEV_FIXTURE_STORY.pages.forEach((page) => {
      const appearing = page.characters.map((character) => character.role);
      expect(new Set(appearing).size).toBe(appearing.length);
    });
  });

  it('본문과 persona 가 비어 있지 않다', () => {
    DEV_FIXTURE_STORY.pages.forEach((page) => expect(page.bodyText.trim().length).toBeGreaterThan(0));
    DEV_FIXTURE_STORY.characters.forEach((character) => {
      expect(character.persona.trim().length).toBeGreaterThan(0);
      expect(character.displayName.trim().length).toBeGreaterThan(0);
    });
  });
});
