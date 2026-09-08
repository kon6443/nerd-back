"use client";

import { ActionLink } from "@/components/ui/ActionLink";
import { PageMessage } from "@/components/ui/PageMessage";
import { actionClass } from "@/components/ui/actionStyles";

export default function LibraryError({ retry }: { retry: () => void }) {
  return (
    <PageMessage
      title="동화를 불러오지 못했어요"
      description="연결 상태를 확인하고 다시 시도해 주세요."
      role="alert"
    >
      <button type="button" onClick={retry} className={actionClass("primary")}>
        다시 시도
      </button>
      <ActionLink href="/" variant="ghost">
        홈으로 가기
      </ActionLink>
    </PageMessage>
  );
}
