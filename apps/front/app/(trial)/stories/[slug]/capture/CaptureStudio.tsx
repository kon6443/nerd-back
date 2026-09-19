import type { ReactNode } from "react";
import { actionClass } from "@/components/ui/actionStyles";
import styles from "./CaptureStudio.module.css";

type IconName = "camera" | "photo" | "shield" | "sparkle" | "check";

export function StudioIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    camera: <><path d="m8 5 1.5-2h5L16 5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><circle cx="12" cy="12.5" r="4" /></>,
    photo: <><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></>,
    shield: <><path d="M12 3 4 6v5c0 5 8 10 8 10s8-5 8-10V6Z" /><path d="m8.5 11.5 2.5 2.5 4.5-5" /></>,
    sparkle: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" /><path d="M20 2v4m-2-2h4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
      {paths[name]}
    </svg>
  );
}

export type DemoPreset = "male" | "female";

interface CaptureStudioProps {
  previewUrl?: string;
  isCameraActive: boolean;
  isStartingCamera: boolean;
  isSubmitting: boolean;
  errorMessage: string;
  isDemoMode?: boolean;
  selectedPreset?: DemoPreset;
  onSelectPreset?: (preset: DemoPreset) => void;
  onVideoRef: (node: HTMLVideoElement | null) => void;
  onStartCamera: () => void;
  onCapture: () => void;
  onRetake: () => void;
  onChoosePhoto: () => void;
  onSubmit: () => void;
}

export function CaptureStudio({
  previewUrl,
  isCameraActive,
  isStartingCamera,
  isSubmitting,
  errorMessage,
  isDemoMode = false,
  selectedPreset = "male",
  onSelectPreset,
  onVideoRef,
  onStartCamera,
  onCapture,
  onRetake,
  onChoosePhoto,
  onSubmit,
}: CaptureStudioProps) {
  const hasPhoto = Boolean(previewUrl) || isDemoMode;
  const demoPreviewUrl = `/demo/avatars/${selectedPreset}.webp`;
  const activePreviewUrl = isDemoMode ? demoPreviewUrl : previewUrl;

  const primaryAction = isDemoMode ? onSubmit : hasPhoto ? onSubmit : isCameraActive ? onCapture : onStartCamera;
  const primaryLabel = isDemoMode
    ? "이 얼굴로 동화 만들기"
    : isSubmitting
      ? "주인공 만드는 중"
      : hasPhoto
        ? "이 얼굴로 만들기"
        : isStartingCamera
          ? "카메라 준비 중"
          : isCameraActive
            ? "찰칵! 사진 찍기"
            : "카메라 켜기";

  // 좌우로 나누지 않고 가운데 한 줄 — 제목 · (내 사진일 때) 사진 이용 안내 · 사진 패널. 시선을 한곳에 모은다.
  // 사진 이용 안내는 첫 화면 안에서 보여야 해서 패널 아래가 아니라 제목 바로 아래에 둔다.
  return (
    <section className={styles.studio} aria-labelledby="capture-title">
      <div className={styles.welcome}>
        <h1 id="capture-title" className={styles.title}>
          {isDemoMode ? (
            <>
              샘플 얼굴을 선택해 3초만에<br />
              <em>동화 속 주인공이 되어보세요!</em>
            </>
          ) : hasPhoto ? (
            <>
              멋진 주인공이<br />
              <em>여기 있네요!</em>
            </>
          ) : (
            <>
              동화 속 주인공,<br />
              <em>바로 나!</em>
            </>
          )}
        </h1>
        {!isDemoMode && (
          <aside className={styles.privacy} aria-label="사진 이용 안내">
            <StudioIcon name="shield" />
            <div>
              <p className={styles.privacyTitle}>사진은 24시간 안에 폐기돼요.</p>
              <p>사진은 AI로 동화 속 주인공을 만드는 데 사용해요.</p>
            </div>
          </aside>
        )}
      </div>

      <div
        className={styles.capturePanel}
        data-state={hasPhoto ? "ready" : isCameraActive ? "camera" : "idle"}
        aria-busy={isSubmitting}
      >
        <div className={styles.panelHeader}>
          <h2>
            <StudioIcon name={isDemoMode ? "sparkle" : "camera"} />
            {isDemoMode ? "샘플 주인공 선택" : hasPhoto ? "내 사진을 확인해요" : "주인공 사진관"}
          </h2>
          <span className={styles.photoCount}>
            {isDemoMode ? "체험 모드" : hasPhoto ? "준비 완료" : "정면 1장"}
          </span>
        </div>

        <div className={styles.photoMat}>
          <div className={styles.viewfinder}>
            {activePreviewUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activePreviewUrl}
                  alt={isDemoMode ? "샘플 주인공 미리보기" : "정면 얼굴 사진 미리보기"}
                  decoding="async"
                  className={styles.photo}
                />
                <span className={styles.readyFlag}>
                  <StudioIcon name="check" />
                  {isDemoMode ? "주인공 선택" : "사진 선택 완료"}
                </span>
              </>
            ) : isCameraActive ? (
              <>
                <video
                  ref={onVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={styles.video}
                  aria-label="카메라 미리보기"
                />
                <div className={styles.faceGuide} aria-hidden="true" />
                <span className={styles.cameraCaption}>동그라미 안에 얼굴을 맞춰요</span>
              </>
            ) : (
              <div className={styles.emptyCamera}>
                <svg aria-hidden="true" viewBox="0 0 180 180" className={styles.portraitGuide}>
                  <circle cx="90" cy="82" r="72" fill="white" opacity=".7" />
                  <path
                    d="M36 159c3-30 23-44 54-44s51 14 54 44"
                    fill="var(--color-accent-a)"
                    opacity=".24"
                  />
                  <ellipse
                    cx="90"
                    cy="77"
                    rx="38"
                    ry="44"
                    fill="var(--color-paper)"
                    stroke="var(--color-accent-a-strong)"
                    strokeWidth="3"
                    strokeDasharray="6 6"
                  />
                  <path
                    d="M54 66q0-47 39-39 38-4 35 39-19-4-25-21-15 19-49 21"
                    fill="var(--color-book-cover)"
                  />
                  <circle cx="76" cy="78" r="3.5" fill="var(--color-book-cover)" />
                  <circle cx="103" cy="78" r="3.5" fill="var(--color-book-cover)" />
                  <path
                    d="M81 94q9 9 18 0"
                    fill="none"
                    stroke="var(--color-book-cover)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <ellipse cx="66" cy="90" rx="7" ry="4" fill="#ffc1bc" />
                  <ellipse cx="114" cy="90" rx="7" ry="4" fill="#ffc1bc" />
                  <path d="m143 26 3 10 10 3-10 3-3 10-3-10-10-3 10-3Z" fill="var(--color-gold)" />
                </svg>
                <p>여기에 나의 웃는 얼굴이 쏙!</p>
              </div>
            )}
            {isSubmitting && (
              <div className={styles.submittingOverlay} role="status" aria-live="polite">
                <div className={styles.submittingSpinner} aria-hidden="true" />
                <p className={styles.submittingText}>사진을 안전하게 준비하고 있어요</p>
                <p className={styles.submittingSubtext}>동화나라 주인공으로 등록 중 ✨</p>
              </div>
            )}
          </div>
          <span className={styles.photoSignature} aria-hidden="true">
            <StudioIcon name="sparkle" />오늘의 주인공
          </span>
        </div>

        {isDemoMode && (
          <div className={styles.presetSection}>
            <div className={styles.presetList} role="radiogroup" aria-label="샘플 주인공 선택">
              <button
                type="button"
                role="radio"
                aria-checked={selectedPreset === "male"}
                data-selected={selectedPreset === "male"}
                className={styles.presetCard}
                onClick={() => onSelectPreset?.("male")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/demo/avatars/male.webp"
                  alt="성인 남성 샘플"
                  className={styles.presetThumb}
                />
                <div className={styles.presetInfo}>
                  <span className={styles.presetName}>
                    성인 남성
                  </span>
                  <span className={styles.presetDesc}>호감형 인상</span>
                </div>
                {selectedPreset === "male" && (
                  <span className={styles.presetCheck} aria-hidden="true">
                    <StudioIcon name="check" />
                  </span>
                )}
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={selectedPreset === "female"}
                data-selected={selectedPreset === "female"}
                className={styles.presetCard}
                onClick={() => onSelectPreset?.("female")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/demo/avatars/female.webp"
                  alt="성인 여성 샘플"
                  className={styles.presetThumb}
                />
                <div className={styles.presetInfo}>
                  <span className={styles.presetName}>
                    성인 여성
                  </span>
                  <span className={styles.presetDesc}>단발머리</span>
                </div>
                {selectedPreset === "female" && (
                  <span className={styles.presetCheck} aria-hidden="true">
                    <StudioIcon name="check" />
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        <p className={styles.helper} role="status" aria-live="polite">
          {isDemoMode
            ? "원하는 주인공을 고르고 아래 버튼을 누르면 동화가 시작돼요."
            : isSubmitting
              ? "사진을 동화나라로 안전하게 전달하고 있어요. 잠시만 기다려 주세요!"
              : hasPhoto
                ? "다른 사진으로 바꿔도 괜찮아요."
                : isStartingCamera
                  ? "카메라 접근을 허용해 주세요."
                  : isCameraActive
                    ? "준비가 되면 아래 버튼을 눌러요."
                    : "카메라는 버튼을 눌렀을 때만 켜져요."}
        </p>

        {errorMessage && <p role="alert" className={styles.error}>{errorMessage}</p>}

        <div className={styles.actions}>
          <button
            type="button"
            onClick={primaryAction}
            disabled={isSubmitting || isStartingCamera}
            className={actionClass("primary", styles.mainAction)}
          >
            <span className={isSubmitting ? styles.busySpark : undefined}>
              {isSubmitting ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <StudioIcon name={isDemoMode || hasPhoto ? "sparkle" : "camera"} />
              )}
            </span>
            {primaryLabel}
          </button>
          {!isDemoMode && (
            <div className={styles.alternatives}>
              {hasPhoto && (
                <button
                  type="button"
                  onClick={onRetake}
                  disabled={isSubmitting}
                  className={actionClass("secondary", "flex-1", "compact")}
                >
                  다시 찍기
                </button>
              )}
              <button
                type="button"
                onClick={onChoosePhoto}
                disabled={isSubmitting}
                className={actionClass("secondary", styles.choosePhoto, "compact")}
              >
                {!hasPhoto && <StudioIcon name="photo" />}사진 고르기
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
