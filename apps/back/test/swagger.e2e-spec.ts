import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { getRepositoryToken } from '@nestjs/typeorm';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import type { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '@common/constants/app.constants';
import { StoryCharacter } from '@entities/story-character.entity';
import { StoryPage } from '@entities/story-page.entity';
import { StoryPageCharacter } from '@entities/story-page-character.entity';
import { StoryTemplate } from '@entities/story-template.entity';
import { StoryController } from '@modules/story/story.controller';
import { StoryService } from '@modules/story/story.service';
import { createE2eApp } from './helpers/e2e-app';

/**
 * Swagger 문서 생성 검증.
 *
 * 배선(`cleanupOpenApiDoc`)만 해두고 넘어가면 문서가 **비어도 아무도 모른다.**
 * zod DTO(`createZodDto`)에서 OpenAPI 파라미터가 실제로 나오는지 고정한다.
 *
 * ⚠️ `main.ts` 와 **같은 조합**(createDocument → cleanupOpenApiDoc)을 써야 의미가 있다.
 * 한쪽만 바꾸면 이 테스트가 프로덕션과 다른 것을 검증하게 된다.
 */
function stub() {
  return { find: jest.fn(), findOneBy: jest.fn(), countBy: jest.fn() };
}

const PAGE_PATH = `/${API_PREFIX}/stories/{slug}/pages/{pageNo}`;

describe('Swagger 문서 (E2E)', () => {
  let app: INestApplication;
  let doc: OpenAPIObject;

  beforeAll(async () => {
    app = await createE2eApp({
      controllers: [StoryController],
      providers: [
        StoryService,
        { provide: getRepositoryToken(StoryTemplate), useValue: stub() },
        { provide: getRepositoryToken(StoryPage), useValue: stub() },
        { provide: getRepositoryToken(StoryCharacter), useValue: stub() },
        { provide: getRepositoryToken(StoryPageCharacter), useValue: stub() },
      ],
    });

    const config = new DocumentBuilder().setTitle('nerd-back API').setVersion('0.1.0').build();
    doc = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  });

  afterAll(async () => {
    await app.close();
  });

  it('동화 엔드포인트 3종이 문서에 있다', () => {
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        `/${API_PREFIX}/stories`,
        `/${API_PREFIX}/stories/{slug}`,
        PAGE_PATH,
      ]),
    );
  });

  it('zod DTO 에서 경로 파라미터가 생성된다 ⭐', () => {
    // 이게 비면 Swagger 에서 "Try it out" 이 동작하지 않는다.
    // class-validator → zod 전환에서 가장 조용히 깨질 수 있는 지점이다.
    const params = doc.paths[PAGE_PATH]?.get?.parameters ?? [];
    const names = params.map((p) => ('name' in p ? p.name : undefined));

    expect(names).toEqual(expect.arrayContaining(['slug', 'pageNo']));
  });

  it('경로 파라미터가 in: path 로 선언된다', () => {
    const params = doc.paths[PAGE_PATH]?.get?.parameters ?? [];

    for (const param of params) {
      if ('in' in param) expect(param.in).toBe('path');
    }
  });

  it('성공 응답 스키마가 봉투 형태로 등록된다', () => {
    const ok = doc.paths[PAGE_PATH]?.get?.responses?.['200'];
    expect(ok).toBeDefined();
    expect(JSON.stringify(ok)).toContain('StoryPageResponseDto');
  });

  it('에러 응답에 statusCode 필드가 없다 ⭐', () => {
    // 응답 바디 계약이다. 문서가 statusCode 를 광고하면 프론트가 그것으로 분기한다.
    const errorSchema = doc.components?.schemas?.ApiErrorBodyDto;

    expect(errorSchema).toBeDefined();
    expect(JSON.stringify(errorSchema)).not.toContain('statusCode');
  });
});
