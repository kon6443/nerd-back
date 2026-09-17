import { StoryIcon } from "./StoryIcon";

export type StatusEmblemTone = "notice" | "success" | "danger";
const toneStyles: Record<StatusEmblemTone, string> = {
  notice: "bg-accent-b-soft text-gold-strong",
  success: "bg-primary-tint text-primary-strong",
  danger: "bg-danger-soft text-danger-strong",
};

/** 상태의 이름은 인접 제목이 읽고, 공통 선 아이콘은 시각적으로 보조한다. */
export function StatusEmblem({ tone }: { tone: StatusEmblemTone }) {
  return (
    <div aria-hidden="true" className={`rounded-full border border-paper-edge p-4 ${toneStyles[tone]}`}>
      <StoryIcon name={tone === "success" ? "check" : tone === "danger" ? "warning" : "book"} className="size-9" />
    </div>
  );
}
