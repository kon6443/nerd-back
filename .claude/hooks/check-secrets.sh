#!/bin/sh
# =============================================================================
# check-secrets.sh — 프롬프트 시크릿 차단 (UserPromptSubmit hook)
# -----------------------------------------------------------------------------
# 역할:
#   사용자가 입력한 프롬프트에 시크릿(API 키·토큰·개인키) 패턴이 있으면
#   **모델로 전송되기 전에** 차단한다. 시크릿이 대화 기록·모델 컨텍스트·
#   외부 API 로 흘러가는 것을 입구에서 막는 1차 방어선.
#   CLAUDE.md Never 표 "시크릿을 코드·로그·응답·문서에 기입 금지"의 기술 보강이다
#   (행동 규칙만으로는 사용자 입력 경로를 막을 수 없다).
#
# 트리거(등록): .claude/settings.json › hooks.UserPromptSubmit, timeout 3s.
#   ⚠️ 등록은 사용자가 직접 한다 — settings.json 은 AI 쓰기 deny 대상이다.
#
# 입력 (stdin — hook payload JSON):
#   .prompt  사용자가 제출한 프롬프트 전문
#
# 출력/종료 정책:
#   exit 2 → 프롬프트 **차단** + stderr 메시지가 사용자에게 표시됨
#   exit 0 → 통과
#   ⚠️ fail-open 설계: jq 부재·JSON 파싱 실패·prompt 빈 값이면 차단하지 않고
#   통과시킨다(가용성 우선). 차단은 확실한 매칭에서만 — 오탐 차단이 더 나쁘다.
#
# 탐지 범위 (베스트에포트, 완전 차단 보장 아님):
#   Anthropic/OpenAI sk-* · GitHub ghp_/gho_/ghs_/ghr_/github_pat_ ·
#   AWS AKIA/ASIA · Google AIza · Slack xox[baprs]- · PEM PRIVATE KEY 블록.
#   미커버: DB 접속 URL 비밀번호, JWT, 짧은 토큰.
#   패턴 추가 시 오탐(정상 텍스트 차단) 균형을 반드시 검증할 것.
#
# 부수효과: 없음 — 파일 쓰기·로그 없음. 시크릿을 어디에도 남기지 않는다.
# 의존성: jq, grep -E. jq 미설치 시 항상 통과.
# =============================================================================

input=$(cat 2>/dev/null || true)
prompt=$(printf '%s' "$input" | jq -r '.prompt // empty' 2>/dev/null || true)

[ -z "$prompt" ] && exit 0

PATTERNS='(sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{32,}|ghp_[A-Za-z0-9]{30,}|gho_[A-Za-z0-9]{30,}|ghs_[A-Za-z0-9]{30,}|ghr_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[0-9A-Za-z-]{10,}|-----BEGIN[ A-Z]*PRIVATE KEY-----)'

if printf '%s' "$prompt" | grep -qE "$PATTERNS"; then
  echo "[check-secrets] 프롬프트에서 시크릿 패턴이 감지되어 차단했습니다." >&2
  echo "[check-secrets] API 키 / 토큰 / 개인키를 제거한 뒤 다시 입력해주세요." >&2
  exit 2
fi

exit 0
