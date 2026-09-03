/**
 * 외부 LLM 경계.
 *
 * **서비스는 SDK 를 직접 들지 않는다.** 이 인터페이스만 알고, 구현체(어댑터)는
 * 모듈에서 토큰에 바인딩한다.
 *
 * 이렇게 두는 이유:
 * - 테스트에서 SDK 모듈을 통째로 모킹하지 않아도 된다. `{ complete: async () => '...' }` 한 줄로 끝난다.
 * - 제공자를 바꿀 때 어댑터만 교체하면 되고 서비스는 건드리지 않는다.
 * - 호출 비용·토큰 수 계측을 어댑터 한 곳에서 처리할 수 있다.
 *
 * 구현체는 주제 확정 후 추가한다. 지금은 경계만 세운다.
 */
export const LLM_PORT = Symbol('LLM_PORT');

export interface LlmCompletionRequest {
  /** 시스템 지시. 페르소나·규칙 등. */
  system?: string;
  /** 사용자 입력. */
  prompt: string;
  /** 상한. 어댑터가 비용 통제를 위해 강제할 수 있다. */
  maxOutputTokens?: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  /** 모델 식별자. 로그·비용 집계에 쓴다. */
  model: string;
  elapsedMs: number;
}

export interface LlmCompletion {
  text: string;
  usage: LlmUsage;
}

export interface LlmPort {
  /**
   * 단발 완성 요청.
   *
   * ⚠️ 구현체는 프롬프트·응답 **본문을 로그에 남기지 않는다.** 토큰 수·모델명·소요시간만
   * 남긴다 (로그 수집 스택의 인제스트 한도를 지키기 위한 규칙).
   */
  complete(request: LlmCompletionRequest): Promise<LlmCompletion>;
}
