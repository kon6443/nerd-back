"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { actionClass } from "@/components/ui/actionStyles";
import { ApiError, createSession, deleteSession, getMySessions, uploadFace } from "@/lib/api";
import type { MyStorySessionItem, UploadFaceResponse } from "@nerd/contracts";

interface PageProps {
  params: Promise<{ slug: string }>;
}

type Slot = "front" | "left" | "right";

const SLOT_LABEL: Record<Slot, { title: string; required: boolean; desc: string }> = {
  front: { title: "정면 얼굴", required: true, desc: "카메라를 정면으로 바라봐 주세요." },
  left: { title: "왼쪽 얼굴", required: false, desc: "고개를 살짝 왼쪽으로 돌려주세요 (선택)." },
  right: { title: "오른쪽 얼굴", required: false, desc: "고개를 살짝 오른쪽으로 돌려주세요 (선택)." },
};

export default function CapturePage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();

  const [activeSlot, setActiveSlot] = useState<Slot>("front");
  const [photos, setPhotos] = useState<Partial<Record<Slot, Blob>>>({});
  const [previews, setPreviews] = useState<Partial<Record<Slot, string>>>({});
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<UploadFaceResponse | null>(null);
  const [existingSession, setExistingSession] = useState<MyStorySessionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setErrorMsg("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("카메라를 사용할 수 없는 환경입니다. 사진 파일 첨부를 이용해 주세요.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
      });
      mediaStreamRef.current = stream;
      setIsWebcamActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "카메라 권한을 얻지 못했습니다. 사진 파일을 직접 첨부해 주세요.";
      setErrorMsg(msg);
      setIsWebcamActive(false);
    }
  }

  // 웹캠 종료
  function stopWebcam() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsWebcamActive(false);
  }

  useEffect(() => {
    let active = true;
    async function init() {
      if (!navigator.mediaDevices?.getUserMedia) {
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        mediaStreamRef.current = stream;
        setIsWebcamActive(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (err: unknown) {
        if (!active) return;
        const msg =
          err instanceof Error
            ? err.message
            : "카메라 권한을 얻지 못했습니다. 사진 파일을 직접 첨부해 주세요.";
        setErrorMsg(msg);
        setIsWebcamActive(false);
      }
    }
    void init();
    return () => {
      active = false;
      stopWebcam();
    };
  }, []);

  // 기존 세션 복원 또는 완성된 세션 확인
  useEffect(() => {
    let active = true;
    async function checkExistingSession() {
      try {
        const sessions = await getMySessions();
        if (!active) return;
        const matched = sessions.find((s) => s.templateSlug === slug);
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
  }, [slug]);

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

  // 비디오 노드 마운트 또는 슬롯 전환 시 스트림 연결 보장
  useEffect(() => {
    const video = videoRef.current;
    const stream = mediaStreamRef.current;
    if (!video || !stream || !isWebcamActive) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    video.play().catch(() => {});
  }, [isWebcamActive, activeSlot, previews]);

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
        setPhotos((prev) => ({ ...prev, [activeSlot]: blob }));
        setPreviews((prev) => ({ ...prev, [activeSlot]: URL.createObjectURL(blob) }));
        // 다음 슬롯으로 자동 전환 (정면 -> 좌 -> 우)
        if (activeSlot === "front" && !photos.left) setActiveSlot("left");
        else if (activeSlot === "left" && !photos.right) setActiveSlot("right");
      },
      "image/jpeg",
      0.85,
    );
  }

  // 파일 업로드 핸들러
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

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
          setPhotos((prev) => ({ ...prev, [activeSlot]: blob }));
          setPreviews((prev) => ({ ...prev, [activeSlot]: URL.createObjectURL(blob) }));
          if (activeSlot === "front" && !photos.left) setActiveSlot("left");
          else if (activeSlot === "left" && !photos.right) setActiveSlot("right");
        },
        "image/jpeg",
        0.85,
      );
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
  }

  // 얼굴 사진 제출
  async function handleSubmit() {
    if (!photos.front) {
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
      formData.append("front", photos.front, "front.jpg");
      if (photos.left) formData.append("left", photos.left, "left.jpg");
      if (photos.right) formData.append("right", photos.right, "right.jpg");

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
        if (err.status === 409) {
          getMySessions()
            .then((sessions) => {
              const matched = sessions.find((s) => s.templateSlug === slug);
              if (matched) {
                setExistingSession(matched);
                stopWebcam();
              }
            })
            .catch(() => {});
          setErrorMsg("이미 제작이 완료된 동화책이 있습니다.");
          return;
        }
        setErrorMsg(err.message);
      } else {
        setErrorMsg("얼굴 사진 업로드 중 오류가 발생했습니다. 다시 시도해 주세요.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <Link href={`/library/${slug}`} className="text-sm font-semibold text-primary hover:underline">
          ← 동화로 돌아가기
        </Link>
        <Badge>
          Slice 3: 얼굴 등록
        </Badge>
      </div>

      {/* 완료 화면 또는 기존 동화 안내 */}
      {existingSession ? (
        <Card className="flex flex-col items-center gap-6 text-center">
          <div className="rounded-full bg-amber-100 p-4 text-3xl">📚</div>
          <h1 className="text-2xl font-bold text-ink">이미 완성된 동화책이 있습니다!</h1>
          <p className="text-sm text-neutral-600">
            회원님께서 이미 얼굴을 등록하여 완성하신 동화책이 존재합니다.<br />
            완성된 동화책을 바로 읽으시거나, 기존 동화를 삭제하고 새로운 얼굴로 다시 만드실 수 있습니다.
          </p>

          {existingSession.referenceImageUrl && (
            <div className="relative h-48 w-48 overflow-hidden rounded-card border-4 border-primary shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={existingSession.referenceImageUrl}
                alt="기존 주인공 캐릭터"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="flex w-full flex-col gap-3">
            <Link
              href={`/stories/${slug}/read?sessionId=${existingSession.id}`}
              className={actionClass("gold", "w-full py-3.5 text-base font-bold shadow-md")}
            >
              📖 내 동화책 바로 읽기
            </Link>
            <button
              type="button"
              onClick={handleDeleteAndReset}
              disabled={isDeleting}
              className={actionClass("ghost", "w-full text-rose-600 hover:border-rose-400")}
            >
              {isDeleting ? "삭제 중..." : "🔄 기존 동화 삭제하고 새 얼굴로 만들기"}
            </button>
            <Link href={`/library/${slug}`} className={actionClass("ghost", "w-full")}>
              동화 소개로 돌아가기
            </Link>
          </div>
        </Card>
      ) : result ? (
        <Card className="flex flex-col items-center gap-6 text-center">
          <div className="rounded-full bg-emerald-100 p-4 text-3xl">✨</div>
          <h1 className="text-2xl font-bold text-ink">주인공 캐릭터가 완성되었어요!</h1>
          <p className="text-sm text-neutral-600">
            아이의 얼굴을 바탕으로 동화 속 주인공 캐릭터 레퍼런스가 만들어졌습니다.<br />
            입력하신 원본 얼굴 사진은 개인정보 보호 원칙에 따라 즉시 안전하게 폐기되었습니다.
          </p>

          <div className="relative h-64 w-64 overflow-hidden rounded-card border-4 border-primary shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.referenceImageUrl}
              alt="주인공 캐릭터 레퍼런스"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="flex w-full flex-col gap-3">
            <Link
              href={`/stories/${slug}/read?sessionId=${result.id}&autoStart=true`}
              className={actionClass("primary", "w-full py-3.5 text-base font-bold shadow-md")}
            >
              ✨ 이 얼굴로 동화책 만들기 시작
            </Link>
            <Link href={`/library/${slug}`} className={actionClass("ghost", "w-full")}>
              동화 소개로
            </Link>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                startWebcam();
              }}
              className={actionClass("ghost", "w-full text-xs text-neutral-500")}
            >
              다른 사진으로 다시 찍기
            </button>
          </div>
        </Card>
      ) : (
        /* 촬영 / 업로드 화면 */
        <Card className="flex flex-col gap-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">주인공 얼굴을 찍어요</h1>
            <p className="mt-1 text-sm text-neutral-600">
              {SLOT_LABEL[activeSlot].title} — {SLOT_LABEL[activeSlot].desc}
            </p>
          </div>

          {/* 슬롯 선택 탭 */}
          <div className="flex gap-2">
            {(["front", "left", "right"] as Slot[]).map((slot) => {
              const hasPhoto = Boolean(photos[slot]);
              const isActive = activeSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setActiveSlot(slot)}
                  className={`flex flex-1 flex-col items-center rounded-lg border-2 p-2 text-xs font-bold transition ${
                    isActive
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-neutral-200 bg-white text-neutral-600"
                  }`}
                >
                  <span>
                    {SLOT_LABEL[slot].title}
                    {SLOT_LABEL[slot].required ? " *" : ""}
                  </span>
                  <span className="mt-1 font-normal text-neutral-400">
                    {hasPhoto ? "✅ 등록됨" : "미등록"}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 뷰파인더 또는 미리보기 */}
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-neutral-900 shadow-inner">
            {previews[activeSlot] ? (
              <div className="relative h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previews[activeSlot]}
                  alt="미리보기"
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhotos((prev) => {
                      const next = { ...prev };
                      delete next[activeSlot];
                      return next;
                    });
                    setPreviews((prev) => {
                      const next = { ...prev };
                      delete next[activeSlot];
                      return next;
                    });
                  }}
                  className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white hover:bg-black/80"
                >
                  다시 찍기
                </button>
              </div>
            ) : isWebcamActive ? (
              <div className="relative h-full w-full">
                <video
                  ref={setVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover scale-x-[-1]"
                />
                {/* 원형 가이드 오버레이 */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-3/4 w-3/4 rounded-full border-4 border-dashed border-white/70 shadow-lg" />
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
                <p className="text-sm text-neutral-400">카메라가 꺼져 있거나 연결되지 않았습니다.</p>
                <button
                  type="button"
                  onClick={startWebcam}
                  className="rounded-pill bg-white/20 px-4 py-2 text-xs font-bold hover:bg-white/30"
                >
                  카메라 켜기
                </button>
              </div>
            )}
          </div>

          {/* 촬영 및 첨부 버튼 */}
          <div className="flex gap-3">
            {isWebcamActive && !previews[activeSlot] && (
              <button
                type="button"
                onClick={handleCapture}
                className={actionClass("accentA", "flex-1")}
              >
                📷 촬영하기
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={actionClass(
                isWebcamActive && !previews[activeSlot] ? "accentB" : "primary",
                "flex-1",
              )}
            >
              📁 파일 첨부
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">
              {errorMsg}
            </div>
          )}

          {/* 최종 제출 버튼 */}
          <div className="mt-2 border-t pt-4">
            <button
              type="button"
              disabled={!photos.front || isSubmitting}
              onClick={handleSubmit}
              className={actionClass(
                "primary",
                `w-full ${!photos.front || isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`,
              )}
            >
              {isSubmitting
                ? "✨ 얼굴을 분석하고 캐릭터를 만드는 중..."
                : "✨ 이 얼굴로 만들기"}
            </button>
            <p className="mt-2 text-center text-xs text-neutral-400">
              * 정면 사진은 필수이며, 좌/우 사진은 선택입니다.
            </p>
          </div>
        </Card>
      )}
    </main>
  );
}
