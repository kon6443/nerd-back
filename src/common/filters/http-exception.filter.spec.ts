import {
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { defineDomainError } from '../dto/define-domain-error';
import { HttpExceptionFilter } from './http-exception.filter';

const SampleNotFoundErrorResponseDto = defineDomainError({
  code: 'SAMPLE_NOT_FOUND',
  status: HttpStatus.NOT_FOUND,
  message: '샘플을 찾을 수 없습니다.',
  name: 'SampleNotFoundErrorResponseDto',
});

interface CapturedResponse {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock;
}

function createHost(): CapturedResponse {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });

  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', originalUrl: '/api/v2/sample' }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    // 테스트 출력이 로그로 더러워지지 않게 막는다. jest restoreMocks 가 자동 복원한다.
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  describe('1단 — 도메인 에러', () => {
    it('DTO 의 code·message·status 를 그대로 쓴다', () => {
      const { host, status, json } = createHost();

      filter.catch(new SampleNotFoundErrorResponseDto(), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'SAMPLE_NOT_FOUND',
          message: '샘플을 찾을 수 없습니다.',
        }),
      );
    });

    it('메시지를 override 할 수 있다', () => {
      const { host, json } = createHost();

      filter.catch(new SampleNotFoundErrorResponseDto('만료되었습니다.'), host);

      expect(json.mock.calls[0][0]).toMatchObject({
        code: 'SAMPLE_NOT_FOUND',
        message: '만료되었습니다.',
      });
    });

    it('응답 바디에 statusCode 필드를 넣지 않는다', () => {
      const { host, json } = createHost();

      filter.catch(new SampleNotFoundErrorResponseDto(), host);

      expect(json.mock.calls[0][0]).not.toHaveProperty('statusCode');
    });

    it('details 가 없으면 키 자체를 넣지 않는다', () => {
      const { host, json } = createHost();

      filter.catch(new SampleNotFoundErrorResponseDto(), host);

      expect(json.mock.calls[0][0]).not.toHaveProperty('details');
    });

    it('details 가 있으면 포함한다', () => {
      const { host, json } = createHost();

      filter.catch(new SampleNotFoundErrorResponseDto(undefined, ['id: 필수입니다.']), host);

      expect(json.mock.calls[0][0]).toMatchObject({ details: ['id: 필수입니다.'] });
    });
  });

  describe('2단 — 일반 HttpException', () => {
    it('상태코드를 code 문자열로 매핑한다', () => {
      const { host, status, json } = createHost();

      filter.catch(new NotFoundException('없음'), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(json.mock.calls[0][0]).toMatchObject({ code: 'NOT_FOUND', message: '없음' });
    });
  });

  describe('2단 — 헬스체크 페이로드는 형식을 바꾸지 않는다', () => {
    it('status·details 를 가진 응답은 원본 그대로 통과시킨다', () => {
      const { host, status, json } = createHost();
      const payload = {
        status: 'error',
        info: {},
        error: { redis: { status: 'down', message: '연결 거부' } },
        details: { redis: { status: 'down', message: '연결 거부' } },
      };

      filter.catch(new ServiceUnavailableException(payload), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      // 우리 에러 봉투로 감싸면 어느 의존이 왜 죽었는지가 사라진다.
      expect(json).toHaveBeenCalledWith(payload);
      expect(json.mock.calls[0][0]).not.toHaveProperty('timestamp');
    });

    it('통과 케이스는 warn 으로 찍지 않는다 — Terminus 가 이미 error 로 남긴다 ⭐', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const { host } = createHost();

      filter.catch(
        new ServiceUnavailableException({ status: 'error', details: { redis: { status: 'down' } } }),
        host,
      );

      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('status 만 있고 details 가 없으면 통과시키지 않는다', () => {
      const { host, json } = createHost();

      filter.catch(new ServiceUnavailableException({ status: 'error' }), host);

      expect(json.mock.calls[0][0]).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    });
  });

  describe('4단 — 예상 못 한 예외', () => {
    it('500 으로 응답하고 원본 메시지를 노출하지 않는다', () => {
      const { host, status, json } = createHost();

      filter.catch(new Error('DB 비밀번호가 틀렸습니다 secret=abc'), host);

      expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      const body = json.mock.calls[0][0] as { code: string; message: string };
      expect(body.code).toBe('INTERNAL_SERVER_ERROR');
      expect(body.message).not.toContain('secret');
    });
  });

  describe('로그 레벨 분리', () => {
    it('500 이상은 스택과 함께 error 로 남긴다', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const { host } = createHost();

      filter.catch(new Error('터짐'), host);

      expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('4xx 는 warn 으로 남긴다', () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      const { host } = createHost();

      filter.catch(new SampleNotFoundErrorResponseDto(), host);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
