import { AuthCta } from "@/components/layout/AuthCta";
import { HOME_AUTHENTICATED_CTA } from "@/components/layout/authLinks";
import { ActionLink } from "@/components/ui/ActionLink";

export default function Home() {
  return (
    // ⭐ 세로 가운데가 아니라 **위에서부터** 쌓는다 — 가운데 정렬이면 제목·CTA 가 화면 한가운데(언덕 그림 위)로
    //    쏠려 보였다(2026-09-14 지적). 반대로 너무 붙이면 헤더에 눌려 보여 50px 을 되돌렸다(104 · md 128px).
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center px-5 pt-26 pb-12 text-center sm:px-8 md:pt-32">
      <h1 className="max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl md:text-6xl">
        <span className="md:block">동화 속 주인공이</span>{" "}
        <span className="md:block">되러 가볼까요?</span>
      </h1>
      <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-ink-muted sm:text-lg">
        시연 동화를 펼치고, 이야기 속 주인공을 만나 보세요.
      </p>
      <div className="mt-8 flex w-full max-w-xl flex-col justify-center gap-3 sm:flex-row">
        {/* 두 CTA 는 **같은 폭**이다 — 문구 길이에 맡기면 나란히 놓였을 때 크기가 달라 보인다. */}
        <ActionLink href="/library" variant="primary" className="w-full sm:w-56">
          동화 체험하기
        </ActionLink>
        {/* 로그인 상태에 따라 「로그인하기」 ↔ 「내 얼굴로 만들기」로 갈린다.
            🚫 문구를 여기 적지 않는다 — `authLinks.ts` 가 소스다. */}
        <AuthCta className="w-full sm:w-56" authenticated={HOME_AUTHENTICATED_CTA} />
      </div>
      <p className="mt-4 text-sm font-medium text-ink-muted">시연은 로그인 없이 바로 볼 수 있어요.</p>
    </main>
  );
}
