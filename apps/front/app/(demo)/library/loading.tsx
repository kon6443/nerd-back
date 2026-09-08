import { PageMessage } from "@/components/ui/PageMessage";

export default function LibraryLoading() {
  return (
    <PageMessage
      title="동화를 펼치고 있어요"
      description="이야기를 불러오는 동안 잠시만 기다려 주세요."
      role="status"
    />
  );
}
