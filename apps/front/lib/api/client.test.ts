import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, UNAUTHORIZED_EVENT, apiFetch } from "./client";

/** 성공 봉투를 만드는 헬퍼. 백엔드 전역 규약과 같은 형태여야 한다. */
function okResponse(data: unknown, status = 200): Response {
  return {
    ok: true,
    status,
    json: () => Promise.resolve({ code: "SUCCESS", data, message: "" }),
  } as unknown as Response;
}

function errorResponse(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    json: () =>
      body === undefined ? Promise.reject(new Error("not json")) : Promise.resolve(body),
  } as unknown as Response;
}

function mockFetch(response: Response) {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BACKEND_INTERNAL_URL;
});

describe("apiFetch — 베이스 URL", () => {
  it("서버에서는 BACKEND_INTERNAL_URL 을 쓴다", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://prod_nerd_back_app:5501";
    const fetchMock = mockFetch(okResponse([]));

    await apiFetch("/stories");

    expect(fetchMock.mock.calls[0][0]).toBe("http://prod_nerd_back_app:5501/api/v2/stories");
  });

  it("끝 슬래시를 중복시키지 않는다", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://backend:5501/";
    const fetchMock = mockFetch(okResponse([]));

    await apiFetch("/stories");

    expect(fetchMock.mock.calls[0][0]).toBe("http://backend:5501/api/v2/stories");
  });

  it("서버인데 BACKEND_INTERNAL_URL 이 없으면 던진다 ⭐", async () => {
    // 조용히 상대경로로 부르면 Next 서버 자신을 호출해 404 가 되고, 원인이 안 보인다.
    mockFetch(okResponse([]));

    await expect(apiFetch("/stories")).rejects.toThrow(/BACKEND_INTERNAL_URL/);
  });

  it("브라우저에서는 상대경로로 부른다 ⭐", async () => {
    // 🚫 NEXT_PUBLIC_API_BASE_URL 류를 만들지 않는다. Caddy 가 같은 도메인에서 /api/v2/* 만
    //    백엔드로 분기하므로 오리진이 필요 없고 CORS 도 발생하지 않는다.
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    const fetchMock = mockFetch(okResponse([]));

    await apiFetch("/stories");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/v2/stories");
  });
});

describe("apiFetch — 성공 응답", () => {
  it("봉투의 data 만 돌려준다", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://backend:5501";
    mockFetch(okResponse([{ slug: "cinderella" }]));

    await expect(apiFetch("/stories")).resolves.toEqual([{ slug: "cinderella" }]);
  });

  it("204 는 undefined 다 (본문을 읽지 않는다)", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://backend:5501";
    const json = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204, json } as unknown));

    await expect(apiFetch("/sessions/1")).resolves.toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it("json 옵션은 Content-Type 과 본문을 함께 붙인다", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://backend:5501";
    const fetchMock = mockFetch(okResponse(null, 201));

    await apiFetch("/auth/login", { method: "POST", json: { loginId: "a" } });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe('{"loginId":"a"}');
  });

  it("Headers 인스턴스의 사용자 헤더와 Content-Type 을 보존한다", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://backend:5501";
    const fetchMock = mockFetch(okResponse(null, 201));

    await apiFetch("/auth/login", {
      method: "POST",
      json: { loginId: "a" },
      headers: new Headers({
        "X-Request-Id": "request-123",
        "Content-Type": "application/vnd.nerd+json",
      }),
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("X-Request-Id")).toBe("request-123");
    expect(headers.get("Content-Type")).toBe("application/vnd.nerd+json");
  });

  it("튜플 배열 헤더를 fetch 에 전달한다", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://backend:5501";
    const fetchMock = mockFetch(okResponse(null, 201));

    await apiFetch("/auth/login", {
      method: "POST",
      json: { loginId: "a" },
      headers: [["X-Request-Id", "tuple-456"]],
    });

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("X-Request-Id")).toBe("tuple-456");
    expect(headers.get("Content-Type")).toBe("application/json");
  });
});

describe("apiFetch — 에러 응답", () => {
  it("에러 봉투를 ApiError 로 바꾼다", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://backend:5501";
    mockFetch(
      errorResponse(404, {
        code: "STORY_NOT_FOUND",
        message: "동화를 찾을 수 없습니다.",
        timestamp: "2026-09-04T00:00:00.000Z",
      }),
    );

    const error = await apiFetch("/stories/x").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const typed = error as ApiError;
    expect(typed.status).toBe(404);
    expect(typed.code).toBe("STORY_NOT_FOUND");
    expect(typed.message).toBe("동화를 찾을 수 없습니다.");
    expect(typed.isNotFound).toBe(true);
  });

  it("검증 실패의 details 를 보존한다", async () => {
    process.env.BACKEND_INTERNAL_URL = "http://backend:5501";
    mockFetch(
      errorResponse(400, {
        code: "VALIDATION_FAILED",
        message: "요청 값이 올바르지 않습니다.",
        timestamp: "2026-09-04T00:00:00.000Z",
        details: ["slug: slug 형식이 올바르지 않습니다."],
      }),
    );

    const error = (await apiFetch("/stories/X").catch((e: unknown) => e)) as ApiError;

    expect(error.isValidationFailed).toBe(true);
    expect(error.details).toEqual(["slug: slug 형식이 올바르지 않습니다."]);
  });

  it.each([
    { code: { value: "UPSTREAM_ERROR" } },
    { message: { value: "업스트림 오류" } },
    { timestamp: null },
  ])("형식이 잘못된 에러 봉투는 안전한 fallback 으로 바꾼다: %j", async (invalidField) => {
    process.env.BACKEND_INTERNAL_URL = "http://backend:5501";
    mockFetch(
      errorResponse(502, {
        code: "UPSTREAM_ERROR",
        message: "업스트림 오류",
        timestamp: "2026-09-04T00:00:00.000Z",
        ...invalidField,
      }),
    );

    const error = (await apiFetch("/stories").catch((e: unknown) => e)) as ApiError;

    expect(error.code).toBe("UNKNOWN_ERROR");
    expect(error.message).toBe("요청을 처리하지 못했습니다.");
  });

  it("JSON 이 아닌 에러 본문도 ApiError 로 감싼다 ⭐", async () => {
    // 프록시가 만든 502 처럼 우리 봉투가 아닐 수 있다. 여기서 파싱 예외가 새면
    // 화면은 "알 수 없는 오류" 대신 스택을 본다.
    process.env.BACKEND_INTERNAL_URL = "http://backend:5501";
    mockFetch(errorResponse(502, undefined));

    const error = (await apiFetch("/stories").catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.code).toBe("UNKNOWN_ERROR");
  });

  it("401 이면 전역 이벤트를 올린다 ⭐", async () => {
    // 화면마다 401 을 처리하면 빠뜨린 화면이 곧 구멍이다. 한 곳에 모은다.
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    vi.stubGlobal(
      "CustomEvent",
      class {
        constructor(readonly type: string) {}
      },
    );
    mockFetch(
      errorResponse(401, { code: "UNAUTHORIZED", message: "인증이 필요하다", timestamp: "" }),
    );

    await apiFetch("/me").catch(() => undefined);

    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect((dispatchEvent.mock.calls[0][0] as { type: string }).type).toBe(UNAUTHORIZED_EVENT);
  });
});
