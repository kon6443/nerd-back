import styles from "./StoryBookScene.module.css";

/** CSS 공간만 사용한다. 프레임 루프·이벤트 구독·WebGL 자원을 만들지 않는다. */
export function StoryBookScene({ open = true, progress }: { open?: boolean; progress?: number }) {
  return (
    <span className={styles.scene} data-open={open} aria-hidden="true">
      <span className={styles.shadow} />
      <span className={styles.book}>
        <span className={styles.leftPage}><span className={styles.lines} /></span>
        <span className={styles.rightPage}><span className={styles.path} /></span>
        <span className={styles.fold} />
        <span className={styles.landscape}>
          <span className={styles.tree} />
          <span className={styles.castle}><span /><span /><span /></span>
          <span className={`${styles.tree} ${styles.smallTree}`} />
        </span>
        <span className={styles.ribbon} />
      </span>
      {progress !== undefined && (
        <span className={styles.pageMarks}>
          {[0, 20, 40, 60, 80].map((threshold) => <i key={threshold} data-filled={progress > threshold} />)}
        </span>
      )}
    </span>
  );
}

/** 진입 때 한 번 펼쳐지는 작은 풍경. 장식이라 버튼과 Tab 정지점을 만들지 않는다. */
export function StoryBookOrnament({ className = "" }: { className?: string }) {
  return <div className={`${styles.ornament} ${className}`} aria-hidden="true"><StoryBookScene /></div>;
}
