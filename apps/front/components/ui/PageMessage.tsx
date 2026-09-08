import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

interface PageMessageProps {
  title: string;
  description: string;
  role?: "status" | "alert";
  children?: ReactNode;
}

/** 로딩·오류·없는 페이지에서 같은 위치에 안내와 복귀 동작을 제공한다. */
export function PageMessage({ title, description, role, children }: PageMessageProps) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5 py-10">
      <Card className="flex flex-col items-center gap-6 py-10 text-center">
        <div role={role}>
          <h1 className="text-2xl leading-tight font-bold text-balance break-keep text-ink md:text-3xl">
            {title}
          </h1>
          <p className="mt-4 leading-relaxed break-keep text-ink-muted">{description}</p>
        </div>
        {children ? <div className="flex flex-wrap justify-center gap-3">{children}</div> : null}
      </Card>
    </main>
  );
}
