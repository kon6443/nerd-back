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
import { ConfigService } from '@nestjs/config';
import { User } from '@entities/user.entity';
import { AuthController } from '@modules/auth/auth.controller';
import { AuthService } from '@modules/auth/auth.service';
import { PasswordService } from '@modules/auth/password.service';
import { SessionService } from '@modules/auth/session.service';
import { AuthGuard } from '@common/guards/auth.guard';
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
      // ⚠️ **문서에 실리는 컨트롤러를 전부 올린다.** 하나라도 빠지면 그 엔드포인트가 문서에서
      //    사라져도 이 테스트가 초록이다 — 2026-09-07 까지 auth 4종이 그 상태였다.
      controllers: [StoryController, AuthController],
      providers: [
        StoryService,
        AuthService,
        PasswordService,
        SessionService,
        AuthGuard,
        { provide: getRepositoryToken(User), useValue: stub() },
        { provide: ConfigService, useValue: { get: () => 'LOCAL' } },
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

  it('인증 엔드포인트 4종이 문서에 있다', () => {
    expect(Object.keys(doc.paths)).toEqual(
      expect.arrayContaining([
        `/${API_PREFIX}/auth/signup`,
        `/${API_PREFIX}/auth/login`,
        `/${API_PREFIX}/auth/logout`,
        `/${API_PREFIX}/auth/me`,
      ]),
    );
  });

  /**
   * ⚠️ **이 테스트는 문서만 본다. 실제 응답과 같은지는 검증하지 못한다.**
   *
   * 문서의 상태코드는 `@ApiSuccessResponse` 가 직접 선언하므로, `@HttpCode` 를 지워
   * 실제 응답이 201 로 바뀌어도 문서는 200 그대로다 — 2026-09-07 변이 테스트로 확인했다.
   *
   * **실제 응답을 고정하는 것은 `auth.e2e-spec.ts` 다**(같은 변이에서 `expected 200, got 201`
   * 로 실패한다). 둘은 짝이고, 한쪽만 있으면 문서와 동작이 갈려도 초록이다.
   */
  it('문서에 성공 상태코드가 선언되어 있다 (실제 응답 검증은 auth.e2e 가 한다)', () => {
    expect(Object.keys(doc.paths[`/${API_PREFIX}/auth/signup`].post!.responses)).toContain('201');
    expect(Object.keys(doc.paths[`/${API_PREFIX}/auth/login`].post!.responses)).toContain('200');
    expect(Object.keys(doc.paths[`/${API_PREFIX}/auth/logout`].post!.responses)).toContain('204');
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

  it('성공 응답이 봉투 + data 타입으로 이어진다 ⭐', () => {
    // 제네릭은 런타임에 지워지므로 `type:` 만으로는 data 타입을 표현할 수 없다.
    // ApiSuccessResponse 데코레이터가 allOf + $ref 로 잇는 것을 고정한다 — 끊기면
    // 문서에 data 가 빈 객체로 나오는데 빌드는 통과한다.
    const ok = JSON.stringify(doc.paths[PAGE_PATH]?.get?.responses?.['200']);

    expect(ok).toContain('ApiSuccessResponseDto');
    expect(ok).toContain('StoryPageDto');
    expect(doc.components?.schemas?.StoryPageDto).toBeDefined();
  });

  it('배열 응답은 data 가 array 로 선언된다 ⭐', () => {
    // isArray 경로. 빠지면 목록 API 의 data 가 단일 객체로 문서화된다.
    const ok = doc.paths[`/${API_PREFIX}/stories`]?.get?.responses?.['200'];
    const schema = JSON.parse(JSON.stringify(ok)) as {
      content: Record<string, { schema: { allOf: { properties?: { data?: { type?: string } } }[] } }>;
    };
    const dataSchema = Object.values(schema.content)[0].schema.allOf.find((p) => p.properties?.data);

    expect(dataSchema?.properties?.data?.type).toBe('array');
    expect(JSON.stringify(ok)).toContain('StorySummaryDto');
  });

  it('에러 응답에 statusCode 필드가 없다 ⭐', () => {
    // 응답 바디 계약이다. 문서가 statusCode 를 광고하면 프론트가 그것으로 분기한다.
    const errorSchema = doc.components?.schemas?.ApiErrorBodyDto;

    expect(errorSchema).toBeDefined();
    expect(JSON.stringify(errorSchema)).not.toContain('statusCode');
  });
});
