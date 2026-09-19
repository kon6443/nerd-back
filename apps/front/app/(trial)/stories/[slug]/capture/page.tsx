"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { StoryRoom } from "@/components/layout/StoryRoom";
import { StoryBookScene } from "@/components/story/StoryBookScene";
import { Card } from "@/components/ui/Card";
import { actionClass } from "@/components/ui/actionStyles";
import { LoadingView } from "@/components/ui/LoadingView";
import { ApiError, createSession, deleteSession, findMySessionBySlug, uploadFace } from "@/lib/api";
import type { MyStorySessionItem, UploadFaceResponse } from "@nerd/contracts";
import { errorMessage } from "@/lib/api/errorPresentation";
import { getLibraryStoryHref } from "@/lib/libraryMode";
import { CaptureStudio, StudioIcon, type DemoPreset } from "./CaptureStudio";
import styles from "./CaptureStudio.module.css";

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface FacePhoto {
  blob: Blob;
  previewUrl: string;
}

function CapturePageContent({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDemoMode = searchParams.get("demo") === "true";

  const [selectedPreset, setSelectedPreset] = useState<DemoPreset>("male");
  const [photo, setPhoto] = useState<FacePhoto | null>(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<UploadFaceResponse | null>(null);
  const [existingSession, setExistingSession] = useState<MyStorySessionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStartingStory, setIsStartingStory] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (result || existingSession) resultTitleRef.current?.focus();
  }, [result, existingSession]);

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.previewUrl);
    };
  }, [photo]);

  // 비디오 DOM 노드가 마운트될 때 스트림을 즉시 연결하는 콜백 ref
  const setVideoRef = (node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && mediaStreamRef.current) {
      if (node.srcObject !== mediaStreamRef.current) {
        node.srcObject = mediaStreamRef.current;
      }
      node.play().catch(() => {});
    }
  };

  // 웹캠 시작
  async function startWebcam() {
    const requestId = ++cameraRequestRef.current;
    setErrorMsg("");
    setIsStartingCamera(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("카메라를 사용할 수 없는 환경입니다. 사진 파일 첨부를 이용해 주세요.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;
      setIsWebcamActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      if (requestId !== cameraRequestRef.current) return;
      setErrorMsg("카메라를 켤 수 없어요. 카메라 권한을 확인하거나 아래에서 사진을 골라 주세요.");
      setIsWebcamActive(false);
    } finally {
      if (requestId === cameraRequestRef.current) setIsStartingCamera(false);
    }
  }

  // 웹캠 종료
  function stopWebcam() {
    cameraRequestRef.current += 1;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
    setIsStartingCamera(false);
  }

  useEffect(() => {
    return () => {
      cameraRequestRef.current += 1;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  // 기존 세션 복원 또는 완성된 세션 확인
  useEffect(() => {
    if (isDemoMode) return;
    let active = true;
    async function checkExistingSession() {
      try {
        const matched = await findMySessionBySlug(slug);
        if (!active) return;
        if (matched) {
          if (matched.status === "completed") {
            setExistingSession(matched);
            stopWebcam();
            return;
          }
          if (matched.status === "face_ready" && matched.referenceImageUrl) {
            setResult({
              id: matched.id,
              status: "face_ready",
              referenceImageUrl: matched.referenceImageUrl,
            });
            stopWebcam();
            return;
          }
        }
      } catch {
        // 미로그인 상태 등은 정상 진행
      }
    }
    void checkExistingSession();
    return () => {
      active = false;
    };
  }, [slug, isDemoMode]);

  // 기존 완성 세션 삭제 및 새로 만들기
  async function handleDeleteAndReset() {
    if (!existingSession) return;
    const ok = window.confirm(
      "기존에 제작된 동화책과 삽화가 영구 삭제됩니다.\n새로운 얼굴로 다시 제작하시겠습니까?",
    );
    if (!ok) return;

    setIsDeleting(true);
    setErrorMsg("");
    try {
      await deleteSession(existingSession.id);
      setExistingSession(null);
      await startWebcam();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "동화책 삭제에 실패했습니다.";
      setErrorMsg(msg);
    } finally {
      setIsDeleting(false);
    }
  }

  // 다시 찍기로 비디오 노드가 마운트될 때 스트림 연결 보장
  useEffect(() => {
    const video = videoRef.current;
    const stream = mediaStreamRef.current;
    if (!video || !stream || !isWebcamActive) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    video.play().catch(() => {});
  }, [isWebcamActive, photo]);

  // 웹캠 캡처
  function handleCapture() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      setErrorMsg("카메라 영상을 준비 중입니다. 1~2초 후 다시 촬영해 주세요.");
      return;
    }
    const canvas = document.createElement("canvas");
    const size = Math.min(video.videoWidth, video.videoHeight, 1024);
    if (size <= 0) {
      setErrorMsg("카메라 해상도를 확인할 수 없습니다. 다시 시도해 주세요.");
      return;
    }
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 중앙 크롭 (비디오 미리보기와 동일하게 좌우반전 적용)
    ctx.translate(size, 0);
    ctx.scale(-1, 1);

    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;
    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setPhoto({ blob, previewUrl: URL.createObjectURL(blob) });
        setErrorMsg("");
      },
      "image/jpeg",
      0.85,
    );
  }

  // 파일 업로드 핸들러
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDim = 1024;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          setPhoto({ blob, previewUrl: URL.createObjectURL(blob) });
          setErrorMsg("");
          stopWebcam();
        },
        "image/jpeg",
        0.85,
      );
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setErrorMsg("사진을 불러올 수 없습니다. 다른 사진을 첨부해 주세요.");
    };
    img.src = objectUrl;
  }

  // 얼굴 사진 제출
  async function handleSubmit() {
    if (isDemoMode) {
      router.push(`/stories/${slug}/read?demo=${selectedPreset}&loading=true`);
      return;
    }

    if (!photo) {
      setErrorMsg("정면 얼굴 사진은 필수입니다.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      // 1. 세션 생성 또는 미완료 세션 가져오기
      const session = await createSession({ templateSlug: slug });

      // 2. FormData 조립
      const formData = new FormData();
      formData.append("front", photo.blob, "front.jpg");

      // 3. 얼굴 업로드 & 캐릭터 레퍼런스 생성
      const res = await uploadFace(session.id, formData);
      setResult(res);
      stopWebcam();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.isUnauthorized) {
          router.push(`/login?redirect=/stories/${slug}/capture`);
          return;
        }
        // 🚫 `status === 409` 로 보지 않는다 — 409 는 「이미 질문함」·「아이디 중복」에도 쓰인다.
        //    어떤 실패인지는 **코드**가 말한다(`packages/contracts/src/envelope.ts`).
        if (err.code === "STORY_ALREADY_COMPLETED") {
          findMySessionBySlug(slug)
            .then((matched) => {
              if (matched) {
                setExistingSession(matched);
                stopWebcam();
              }
            })
            .catch(() => {});
          setErrorMsg("이미 제작이 완료된 동화책이 있습니다.");
          return;
        }
        setErrorMsg(errorMessage(err, "얼굴 사진 업로드 중 오류가 발생했습니다."));
      } else {
        setErrorMsg("얼굴 사진 업로드 중 오류가 발생했습니다. 다시 시도해 주세요.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <StoryRoom storySlug={slug} className={styles.page}>
      <div className={styles.pageHeader}>
        <Link
          href={isDemoMode ? "/library" : getLibraryStoryHref(slug, true)}
          className={actionClass("tertiary", styles.backLink, "compact")}
        >
          <StudioIcon name="back" />
          {isDemoMode ? "서재로 돌아가기" : "동화로 돌아가기"}
        </Link>
        <span className={styles.pageLabel}>
          {isDemoMode ? "샘플 주인공 체험" : "주인공 준비하기"}
        </span>
      </div>

      {existingSession ? (
        <Card className={`${styles.resultCard} flex w-full flex-col items-center gap-5 text-center`}>
          <div className={styles.resultBuddy}><StoryBookScene /></div>
          <h1 ref={resultTitleRef} tabIndex={-1} className="text-2xl font-bold text-ink">나의 동화책이 기다리고 있어요!</h1>
          <p className="break-keep text-sm leading-relaxed text-ink-muted">
            내가 주인공인 동화가 이미 완성되어 있어요.<br />
            책을 펼쳐 모험을 이어가 볼까요?
          </p>

          {existingSession.referenceImageUrl && (
            <div className="relative h-48 w-48 overflow-hidden rounded-card border-4 border-white shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={existingSession.referenceImageUrl}
                alt="기존 주인공 캐릭터"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="flex w-full flex-col gap-3">
            <Link
              href={`/stories/${slug}/read?sessionId=${existingSession.id}`}
              className={actionClass("primary", "w-full")}
            >
              내 동화책 읽기
            </Link>
            <button
              type="button"
              onClick={handleDeleteAndReset}
              disabled={isDeleting}
              className={actionClass("secondary", "w-full text-danger-strong", "compact")}
            >
              {isDeleting ? "삭제 중..." : "기존 동화 삭제하고 새로 만들기"}
            </button>
          </div>
        </Card>
      ) : result ? (
        <Card className={`${styles.resultCard} flex w-full flex-col items-center gap-5 text-center`}>
          <div className={styles.resultBuddy}><StoryBookScene /></div>
          <h1 ref={resultTitleRef} tabIndex={-1} className="text-2xl font-bold text-ink">짜잔, 동화 속 나예요!</h1>
          <p className="break-keep text-sm leading-relaxed text-ink-muted">
            멋진 주인공이 준비됐어요.<br />
            이제 나만의 동화를 만들어 볼까요?
          </p>

          {(result.referenceImageUrl || photo?.previewUrl) && (
            <div className="relative h-56 w-56 overflow-hidden rounded-card border-4 border-white shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.referenceImageUrl || photo?.previewUrl || undefined}
                alt="내 얼굴로 만든 동화 주인공"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <p className="break-keep text-xs leading-relaxed text-ink-muted">
            사진은 24시간 안에 폐기돼요.
          </p>

          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              disabled={isStartingStory}
              onClick={() => {
                setIsStartingStory(true);
                router.push(`/stories/${slug}/read?sessionId=${result.id}&autoStart=true`);
              }}
              className={actionClass("primary", "w-full flex items-center justify-center gap-2")}
            >
              {isStartingStory ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  동화책을 펼치는 중...
                </>
              ) : (
                "나의 동화 만들기"
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setPhoto(null);
                startWebcam();
              }}
              className={actionClass("secondary", "w-full", "compact")}
            >
              다른 사진으로 다시 찍기
            </button>
          </div>
        </Card>
      ) : (
        <>
          <CaptureStudio
            previewUrl={photo?.previewUrl}
            isCameraActive={isWebcamActive}
            isStartingCamera={isStartingCamera}
            isSubmitting={isSubmitting}
            errorMessage={errorMsg}
            isDemoMode={isDemoMode}
            selectedPreset={selectedPreset}
            onSelectPreset={setSelectedPreset}
            onVideoRef={setVideoRef}
            onStartCamera={startWebcam}
            onCapture={handleCapture}
            onRetake={() => setPhoto(null)}
            onChoosePhoto={() => fileInputRef.current?.click()}
            onSubmit={handleSubmit}
          />
          <input
            ref={fileInputRef}
            type="file"
            aria-label="정면 사진 첨부"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </>
      )}
      {(existingSession || result) && errorMsg && (
        <p role="alert" className={`${styles.error} ${styles.resultError}`}>{errorMsg}</p>
      )}
    </StoryRoom>
  );
}

export default function CapturePage(props: PageProps) {
  return (
    <Suspense fallback={<LoadingView message="주인공 스튜디오를 준비하고 있어요..." />}>
      <CapturePageContent {...props} />
    </Suspense>
  );
}
