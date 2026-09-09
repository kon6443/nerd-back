import { CenteredPage } from "./CenteredPage";

/**
 * 화면 전체 로딩.
 *
 * ⭐ **`aria-busy` 와 `role="status"` 를 함께 준다.** 돌아가는 원은 `aria-hidden` 이라,
 * 이 문구가 없으면 화면을 못 보는 사용자에게는 **아무 일도 안 일어난 것**과 같다.
 *
 * 🚫 스피너를 별도 컴포넌트로 빼지 않았다 — 소비자가 여기 하나뿐이라 파일만 늘고
 * 아무도 안 쓰는 prop(`className`)이 딸려 왔다. 인라인 로딩이 필요한 화면이 생기면 그때 뺀다.
 */
export function LoadingView({ message }: { message: string }) {
  return (
    <CenteredPage aria-busy>
      <div className="flex flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent motion-reduce:animate-none"
        />
        <p role="status" className="font-bold text-ink">
          {message}
        </p>
      </div>
    </CenteredPage>
  );
}
