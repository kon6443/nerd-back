import { ActionLink } from "@/components/ui/ActionLink";
import { PageMessage } from "@/components/ui/PageMessage";

export default function NotFound() {
  return (
    <PageMessage
      title="페이지를 찾을 수 없어요"
      description="주소가 바뀌었거나 아직 준비되지 않은 페이지예요. 서재에서 다른 이야기를 골라 볼까요?"
    >
      <ActionLink href="/library" variant="accentA">
        서재로 가기
      </ActionLink>
    </PageMessage>
  );
}
