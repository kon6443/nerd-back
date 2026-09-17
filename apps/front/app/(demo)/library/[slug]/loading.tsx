import { StoryDetailShell } from "./StoryDetailShell";
import styles from "./StoryDetail.module.css";

/**
 * 동화 상세의 대기 화면.
 *
 * ⚠️ **이 파일이 없으면 부모(`library/loading.tsx`)의 폴백이 대신 쓰인다.** 그러면 상세를 여는데
 * **서재 목록 껍데기**(「서재 / 어떤 이야기를 읽어 볼까요?」와 목록 스켈레톤)가 먼저 뜨고 상세로
 * 통째로 바뀐다 — 실측으로 확인했다(2026-09-10: 153ms 목록 껍데기 → 2042ms 상세).
 * 🚫 자식 라우트를 부모 폴백에 맡기지 않는다. 세그먼트마다 자기 모양을 그린다.
 *
 * 「서재로 돌아가기」는 데이터가 필요 없으므로 **진짜 링크로** 둔다. 기다리는 동안에도 누를 수 있다.
 */
export default function StoryDetailLoading() {
  return (
    <StoryDetailShell>
      <p role="status" className="sr-only">
        동화 정보를 불러오는 중입니다.
      </p>
      <section
        aria-hidden="true"
        className={`${styles.hero} animate-pulse motion-reduce:animate-none`}
      >
        <div className={styles.book}>
          <div className={`${styles.skeleton} ${styles.blankBook}`} />
        </div>
        <div className={styles.intro}>
          <div className={`h-12 w-3/4 ${styles.skeleton}`} />
          <div className="flex flex-col gap-2">
            <div className={`h-5 w-full ${styles.skeleton}`} />
            <div className={`h-5 w-5/6 ${styles.skeleton}`} />
          </div>
          <div className={`h-9 w-24 ${styles.skeleton}`} />
          <div className="flex flex-wrap gap-3 pt-2">
            <div className={`min-h-touch w-full md:w-48 ${styles.skeleton}`} />
            <div className={`min-h-touch w-full md:w-40 ${styles.skeleton}`} />
          </div>
        </div>
      </section>
    </StoryDetailShell>
  );
}
