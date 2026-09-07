import { notFound } from "next/navigation";
import { ApiError } from "./client";

/**
 * 백엔드의 404 를 Next 의 not-found 화면으로 넘긴다.
 *
 * 이 변환을 화면마다 `try/catch` 로 쓰면 한 곳에서 빠뜨렸을 때 **404 가 500 으로 보인다.**
 * 없는 동화를 열었을 뿐인데 오류 화면이 뜨는 것과, "찾을 수 없어요" 가 뜨는 것은 다른 일이다.
 *
 * 🚫 404 외의 오류는 삼키지 않는다 — 그대로 던져 오류 경계가 받게 한다.
 */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) notFound();
    throw error;
  }
}
