import type { ReactNode } from "react";
import { StoryRoom } from "@/components/layout/StoryRoom";
import { ActionLink } from "@/components/ui/ActionLink";
import styles from "./StoryDetail.module.css";

/** 로딩부터 소개까지 같은 배경·종이 패널을 유지한다. */
export function StoryDetailShell({ children }: { children: ReactNode }) {
  return (
    <StoryRoom>
      <div className={styles.back}>
        <ActionLink href="/library" variant="secondary" size="compact">
          서재로 돌아가기
        </ActionLink>
      </div>
      <div className={styles.panel}>{children}</div>
    </StoryRoom>
  );
}
