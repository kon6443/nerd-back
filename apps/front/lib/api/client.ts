import { API_PREFIX, type ApiErrorBody, type ApiSuccess, type ErrorCode } from "@nerd/contracts";

/**
 * 백엔드 호출 래퍼.
 *
 * 응답 봉투와 에러 형식은 **`@nerd/contracts` 가 소유**한다 — 백엔드 전역 필터가 같은 형태를
 * 만든다. 여기서 다시 정의하지 않는다.
 */

/** 401 을 화면마다 처리하지 않는다. 전역 이벤트로 올려 로그아웃을 한 곳에 모은다. */
export const UNAUTHORIZED_EVENT = "backend:unauthorized";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** 요청 값 검증 실패. `details` 에 `필드: 메시지` 배열이 들어 있다. */
  get isValidationFailed(): boolean {
    return this.code === "VALIDATION_FAILED";
  }
}

/**
 * 베이스 URL 은 **호출 컨텍스트가 정한다.**
 *
 * 🚫 모듈 로드 시점에 고정하지 않는다. 한 번 고정하면 서버 렌더와 클라이언트 렌더 중
 * 한쪽이 반드시 틀린 값을 쓴다.
 *
 * - 브라우저: **상대경로**. Caddy 가 같은 도메인에서 `/api/v2/*` 만 백엔드로 분기하므로
 *   오리진이 필요 없다. CORS 도 발생하지 않는다.
 * - 서버(서버 컴포넌트·route handler): overlay 직통 주소. stack YAML 이 주입한다.
 *
 * 🚫 `NEXT_PUBLIC_API_BASE_URL` 류를 만들지 않는다 — 빌드타임 env 가 늘고 이미지가
 * 환경에 묶인다.
 */
function resolveBaseUrl(): string {
  if (typeof window !== "undefined") return "";

  const internal = process.env.BACKEND_INTERNAL_URL;
  if (!internal) {
    // ⚠️ 메시지에 **로컬 해결책을 먼저** 적는다. 이 오류를 실제로 만나는 사람은 대부분
    //    `pnpm front dev` 를 처음 띄운 개발자인데, "stack YAML 을 보라"고만 하면
    //    배포 설정을 뒤지게 된다 — 로컬에서는 stack YAML 이 아무 역할도 하지 않는다.
    throw new Error(
      "BACKEND_INTERNAL_URL 이 없다. 서버 컴포넌트가 백엔드를 부르려면 이 값이 필요하다.\n" +
        "  - 로컬: `cp apps/front/.env.example apps/front/.env.local` 후 `pnpm back dev` 를 띄운다\n" +
        "  - 배포: stack YAML 의 environment 가 주입한다 (건드릴 일 없음)",
    );
  }
  return internal.replace(/\/+$/, "");
}

async function readErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "code" in body) {
      return body as ApiErrorBody;
    }
    return null;
  } catch {
    // 프록시가 만든 502 처럼 본문이 JSON 이 아닐 수 있다. 그것도 정상 경로다.
    return null;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** JSON 으로 직렬화해 보낼 본문. `Content-Type` 은 자동으로 붙는다. */
  json?: unknown;
  /** FormData 등 원시 본문. FormData 일 경우 Content-Type 헤더를 비워두어야 boundary 가 자동 생성된다. */
  body?: BodyInit;
}

/**
 * `path` 는 **API prefix 를 뺀** 경로다 (`/stories`, `/sessions/1/pages`).
 * prefix 는 계약 값이라 `@nerd/contracts` 에서 온다.
 *
 * 성공 시 봉투의 `data` 만 돌려준다. 본문 없는 응답(204)은 `undefined` 다.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { json, body: rawBody, headers, ...rest } = options;
  const isJson = json !== undefined;
  const body = isJson ? JSON.stringify(json) : rawBody;

  const response = await fetch(`${resolveBaseUrl()}/${API_PREFIX}${path}`, {
    ...rest,
    headers: {
      ...(isJson ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body,
  });

  if (!response.ok) {
    const body = await readErrorBody(response);

    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }

    throw new ApiError(
      response.status,
      body?.code ?? "UNKNOWN_ERROR",
      body?.message ?? "요청을 처리하지 못했습니다.",
      body?.details,
    );
  }

  if (response.status === 204) return undefined as T;

  const envelope = (await response.json()) as ApiSuccess<T>;
  return envelope.data;
}
