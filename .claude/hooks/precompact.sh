#!/bin/sh
# =============================================================================
# precompact.sh — 세션 핸드오프 자동 스냅샷 (PreCompact hook)
# -----------------------------------------------------------------------------
# 역할:
#   compact(수동 /compact · 자동) 직전, 세션 스냅샷을
#   docs/handoff/YYYYMMDDHHMM_session.md 로 저장한다.
#   자동 compact 는 모델의 수동 핸드오프 절차를 건너뛰므로, 이 훅이
#   **핸드오프 누락을 막는 기계적 안전망**이다.
#   ⚠️ 산출물은 정본이 아니다. 살릴 내용은 다음 세션에서 docs/tasks/ 로 옮기고
#      스냅샷은 지운다 (CLAUDE.md 「문서 경계」). git 미추적(.gitignore).
#
# 트리거(등록): .claude/settings.json › hooks.PreCompact
#   ⚠️ 등록은 사용자가 직접 한다 — settings.json 은 AI 쓰기 deny 대상이다.
#
# 입력 (stdin — hook payload JSON):
#   .cwd              프로젝트 디렉터리 (없으면 $PWD 폴백)
#   .trigger          "manual" | "auto" (스냅샷 헤더에 기록)
#   .transcript_path  대화 기록 JSONL — 최근 사용자 요청 추출용
#
# 수집: ① git status 변경 파일(50개 한도) ② (있을 때만) 개인 감사 로그
#   ~/.claude/audit.log 의 이 cwd 최근 명령 15건(노이즈 제외 + 마스킹)
#   ③ transcript 의 최근 사용자 요청 8건(마스킹).
#
# 스킵 조건 (조용히 exit 0):
#   - cwd 가 git repo 도 아니고 docs/ 도 없음 → 임의 디렉터리 오염 방지
#   - 최근 3분 내 스냅샷 존재 → 모델 작성분·다른 훅과 중복 방지
#
# 출력/종료 정책:
#   stdout 은 사용자 화면 안내 1줄. **항상 exit 0**.
#   ⚠️ PreCompact 는 **exit 2 로 compact 를 차단**한다(공식 스펙). set -e 로
#   중간에 죽으면 그 종료코드가 전달되어 사고로 compact 를 막을 수 있으므로
#   `trap 'exit 0' EXIT` 로 어떤 경로로 끝나도 0 을 보장한다.
#
# 의존성: jq(없으면 $PWD 폴백 + 요청 추출 생략), git, date.
#   ⚠️ mask= 정규식은 임의로 수정하지 않는다 (드리프트 시 시크릿 평문 누출).
# =============================================================================

set -eu

# fail-safe: 어떤 경로로 종료되더라도 0 을 반환한다 (exit 2 는 compact 를 차단하므로)
trap 'exit 0' EXIT

input=$(cat 2>/dev/null || true)

cwd=""
trigger=""
transcript=""
if command -v jq >/dev/null 2>&1 && [ -n "$input" ]; then
  cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)
  trigger=$(printf '%s' "$input" | jq -r '.trigger // empty' 2>/dev/null || true)
  transcript=$(printf '%s' "$input" | jq -r '.transcript_path // empty' 2>/dev/null || true)
fi
[ -z "$cwd" ] && cwd="$PWD"
[ -z "$trigger" ] && trigger="unknown"

# 프로젝트 컨텍스트가 아니면 스킵 — 임의 디렉터리 오염 방지
repo_root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$repo_root" ] && [ ! -d "$cwd/docs" ]; then
  exit 0
fi

# ⚠️ 스냅샷은 **저장소 루트**의 docs/handoff 에 모은다.
#    cwd 를 그대로 쓰면 모노레포에서 apps/back 같은 하위 디렉터리에서 세션을 열었을 때
#    apps/back/docs/handoff 가 생긴다. 루트 .gitignore 의 `docs/handoff/` 는 경로에
#    슬래시가 있어 **루트에만** 적용되므로, 그 스냅샷은 커밋 대상으로 올라온다.
out_dir="${repo_root:-$cwd}/docs/handoff"
mkdir -p "$out_dir" 2>/dev/null || true

# 최근 3분 내 스냅샷이 있으면 모델이 직접 작성한 것으로 보고 생략
existing=$(find "$out_dir" -maxdepth 1 -name '*_session.md' -mmin -3 2>/dev/null | head -1 || true)
if [ -n "$existing" ]; then
  printf 'PreCompact: 최근 핸드오프 존재 → 스냅샷 생략 (%s)\n' "$(basename "$existing")"
  exit 0
fi

ts=$(date +%Y%m%d%H%M)
out="$out_dir/${ts}_session.md"

# 시크릿 마스킹 (임의 수정 금지)
mask='s#://[^:@/[:space:]]+:[^@/[:space:]]+@#://[REDACTED]@#g; s/(authorization[[:space:]]*:[[:space:]]*)(bearer[[:space:]]+|basic[[:space:]]+|token[[:space:]]+)?[A-Za-z0-9._~+\/=-]{8,}/\1\2[REDACTED]/gI; s/(bearer[[:space:]]+)[A-Za-z0-9._~+\/=-]{8,}/\1[REDACTED]/gI; s/(token|password|passwd|secret|api[_-]?key)[^[:space:]]*/[REDACTED]/gI; s/(sk-[A-Za-z0-9_-]{8,}|sk_(live|test)_[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{8,}|gho_[A-Za-z0-9]{8,}|ghs_[A-Za-z0-9]{8,}|github_pat_[A-Za-z0-9_]{8,}|AKIA[0-9A-Z]{8,}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[0-9A-Za-z-]{8,}|eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{4,})/[REDACTED]/g'

# (1) 작업 트리 변경 파일
changed=""
if [ -n "$repo_root" ]; then
  # 저장소 전체의 변경을 모은다 — 하위 디렉터리에서 세션을 열어도 다른 앱의 변경이 빠지지 않는다.
  changed=$(git -C "$repo_root" status --porcelain 2>/dev/null | head -50 | sed 's/^/  /' || true)
fi
[ -z "$changed" ] && changed="  (변경 없음)"

# (2) (선택) 개인 감사 로그가 있으면 이 cwd 최근 명령 수집 (노이즈 제외 · 마스킹 · 15건)
log="$HOME/.claude/audit.log"
cmds=""
if [ -f "$log" ]; then
  cmds=$(tail -800 "$log" 2>/dev/null \
    | grep -F "[$cwd]" 2>/dev/null \
    | grep -vE '\] git (status|diff|log|branch|show|fetch)( |$)|\] (ls|cat|head|tail|echo|pwd|date|wc|jq) ' \
    | sed -E "$mask" \
    | tail -15 | sed 's/^/  /' || true)
fi
[ -z "$cmds" ] && cmds="  (기록 없음)"

# (3) transcript 에서 최근 사용자 요청 (best-effort)
goals=""
if [ -n "$transcript" ] && [ -f "$transcript" ] && command -v jq >/dev/null 2>&1; then
  goals=$(jq -r 'select(.type=="user") | .message.content as $c
      | if ($c|type)=="string" then $c else ($c[]? | select(.type=="text") | .text) end' \
      "$transcript" 2>/dev/null \
    | grep -v '^[[:space:]]*$' \
    | sed -E "$mask" \
    | tail -8 | sed 's/^/  - /' || true)
fi
[ -z "$goals" ] && goals="  - (자동 추출 실패 — 다음 세션에서 직접 확인)"

{
  printf '# 세션 핸드오프 (auto-snapshot)\n\n'
  printf '> **자동 생성 스냅샷** — PreCompact 훅이 compact(trigger=%s) 직전 기계 수집했다.\n' "$trigger"
  printf '> 정본이 아니다. 살릴 내용은 `docs/tasks/` 로 옮기고 이 파일은 지운다.\n'
  printf '> 생성 시각: %s\n\n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf -- '---\n\n'
  printf -- '- **목표·배경** (최근 사용자 요청 추출):\n'
  printf '%s\n' "$goals"
  printf -- '- **변경 파일** (git 작업 트리):\n'
  printf '%s\n' "$changed"
  printf -- '- **최근 명령** (이 cwd · 마스킹 · 노이즈 제외):\n'
  printf '%s\n' "$cmds"
  printf -- '- **진행 중 작업:** (검토 필요)\n'
  printf -- '- **미완 항목과 이유:** (검토 필요)\n'
  printf -- '- **결정과 근거:** (검토 필요)\n'
  printf -- '- **다음 세션을 위한 제약·경고:** (검토 필요)\n'
  printf -- '  - 실패한 접근: 무엇을 시도했고 왜 실패했는가\n'
  printf -- '  - 위험 영역: 조심해야 할 파일·경로\n'
  printf -- '  - 미해결 질문: 확인이 필요한 결정\n'
  printf -- '- **권장 다음 작업:** (검토 필요)\n'
  printf -- '- **Clean state 체크리스트:**\n'
  printf -- '  - [ ] `pnpm ci:core` 통과 (lint → test → build, 에러 0건)\n'
  printf -- '  - [ ] 임시 디버그 코드·임시 로그 없음\n'
  printf -- '  - [ ] DB 마이그레이션을 실행하지 않았음 (전 환경 동일 DB)\n'
  printf -- '  - [ ] 인프라 식별 정보(도메인·IP·서버 경로)를 문서·코드에 기입하지 않았음\n'
} > "$out" 2>/dev/null || true

if [ -f "$out" ]; then
  printf 'PreCompact: 핸드오프 스냅샷 저장 → %s (trigger=%s)\n' "$out" "$trigger"
fi

exit 0
