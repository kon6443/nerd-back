#!/usr/bin/env bash
# 노트북 → (SSH) → 매니저 → MySQL 컨테이너 로 3306 터널을 연다. **호스트 포트 publish 없이.**
#
#   scripts/db-tunnel.sh [ssh-host] [local-port]      전면(foreground). Ctrl-C 로 닫는다
#   scripts/db-tunnel.sh --ensure [host] [port]       이미 열려 있으면 아무것도 안 하고, 없으면 백그라운드로 연다
#   scripts/db-tunnel.sh --stop   [host] [port]       백그라운드 터널을 닫는다
#
#   → 터널이 열린 동안 127.0.0.1:<local-port> 가 운영 DB 다.
#   → GUI 도구·mysql CLI 는 host 127.0.0.1 / port <local-port> 로 붙는다.
#   → **local-port 기본값은 `.env` 의 `DB_PORT`** 다(없으면 3306). 앱과 터널이 어긋나지 않게 한 곳에서 읽는다.
#
# `pnpm back dev` 가 `--ensure` 를 먼저 부른다. 끄려면 `SKIP_DB_TUNNEL=1 pnpm back dev`.
#
# 어디서 실행해도 된다 — 저장소 루트에서든 `apps/back` 에서든 자기 위치로 앱 루트를 찾는다.
#
# 왜 publish 를 안 하나: Swarm 은 publish 를 127.0.0.1 로 제한할 수 없다(항상 0.0.0.0). 포트를 열면
# 인터넷 노출 여부가 VCN 보안 목록 **하나**에 달리게 된다. 대신 컨테이너가 docker_gwbridge 에 갖는
# 호스트 로컬 IP 로 붙는다 — 이 IP 는 호스트 밖에서 라우팅되지 않아 SSH 를 거치지 않으면 닿을 수 없다.
# ⚠️ 그 IP 는 컨테이너가 바뀔 때마다(재배포·재시작) 달라진다. 그래서 매번 조회한다.
# 기본 호스트 `fs-01` 은 **SSH 별칭**이다 — 주소·사용자·키는 노트북의 ~/.ssh/config `Host fs-01` 블록에만 둔다.
# 🚫 IP·도메인을 이 파일에 적지 않는다. 별칭만으로는 서버에 닿을 수 없다.
# 🚫 sudo 로 실행하지 않는다 — root 의 ~/.ssh/config 를 읽어 별칭을 못 찾는다. root 가 필요한 동작이 없다.

set -euo pipefail

mode="run"
case "${1:-}" in
  --ensure) mode="ensure"; shift ;;
  --stop)   mode="stop";   shift ;;
  --*) echo "알 수 없는 옵션: $1  (--ensure | --stop)" >&2; exit 2 ;;
esac

app_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 기본 포트는 .env 의 DB_PORT — 앱이 붙는 포트와 터널이 여는 포트를 한 곳에서 읽는다.
# (2026-09-02·09-03 두 번, 이 둘이 어긋나 노트북 로컬 MySQL 에 붙은 전례가 있다.)
default_port() {
  local v=""
  if [ -r "$app_root/.env" ]; then
    v="$(sed -n 's/^[[:space:]]*DB_PORT[[:space:]]*=[[:space:]]*\([0-9]\{1,5\}\).*/\1/p' "$app_root/.env" | tail -1)"
  fi
  printf '%s' "${v:-3306}"
}

# pnpm 은 `pnpm <script> -- a b` 의 `--` 를 스크립트에 **그대로 넘긴다**(2026-09-03 실측).
# 그대로 두면 host="--" · port="fs-01" 이 되어 조용히 엉뚱한 값으로 돈다. 여기서 걷어낸다.
[ "${1:-}" = "--" ] && shift

host="${1:-fs-01}"
local_port="${2:-$(default_port)}"

# 인자 검증 — 외부에서 온 값을 다음 단계(lsof·ssh -L)의 입력으로 쓰기 전에 형식을 본다.
# 검증이 없으면 `--stop` 이 "리슨 중인 프로세스가 없다"(성공)를 반환해 **닫혔다고 오인**하게 만든다.
case "$local_port" in
  ''|*[!0-9]*) echo "포트가 숫자가 아니다: '${local_port}'  사용법: $0 [--ensure|--stop] [ssh-host] [port]" >&2; exit 2 ;;
esac
if [ "$local_port" -lt 1 ] || [ "$local_port" -gt 65535 ]; then
  echo "포트 범위를 벗어났다: ${local_port}" >&2; exit 2
fi
case "$host" in
  ''|-*) echo "SSH 호스트가 비었거나 옵션처럼 보인다: '${host}'  사용법: $0 [--ensure|--stop] [ssh-host] [port]" >&2; exit 2 ;;
esac

# 포트를 쥐고 있는 프로세스 이름 (없으면 빈 문자열)
# ⚠️ 끝의 `|| true` 가 없으면 안 된다. lsof 는 **매칭이 없을 때 종료코드 1** 이고, 이 파일은
#    `set -euo pipefail` 이라 `owner="$(port_owner)"` 대입이 그대로 스크립트를 죽인다.
#    즉 "포트가 비어 있다"(정상 경로)에서 아무 메시지 없이 exit 1 이 된다 — 2026-09-03 실측으로 잡았다.
port_owner() {
  lsof -nP -iTCP:"$local_port" -sTCP:LISTEN -F c 2>/dev/null | sed -n 's/^c//p' | head -1 || true
}
# 포트를 쥐고 있는 pid
port_pid() {
  lsof -nP -iTCP:"$local_port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true
}

if [ "$mode" = "stop" ]; then
  owner="$(port_owner)"
  if [ -z "$owner" ]; then
    echo "127.0.0.1:${local_port} 에 리슨 중인 프로세스가 없다 — 이미 닫혀 있다."
    exit 0
  fi
  if [ "$owner" != "ssh" ]; then
    echo "127.0.0.1:${local_port} 은 ssh 가 아니라 '${owner}' 가 쓰고 있다 — 건드리지 않는다." >&2
    exit 1
  fi
  pid="$(port_pid)"
  kill "$pid"
  echo "터널 종료 (pid ${pid}, 127.0.0.1:${local_port})"
  exit 0
fi

if [ "$mode" = "ensure" ] && [ "${SKIP_DB_TUNNEL:-}" = "1" ]; then
  echo "db-tunnel: SKIP_DB_TUNNEL=1 — 터널을 건드리지 않는다."
  exit 0
fi

# 로컬 포트 선점 검사. ssh 는 bind 실패를 **경고만 하고 계속 돌아** "터널이 떴는데 안 붙는" 상태를 만든다
# (2026-09-02 실측: 노트북 MySQL 이 3306 을 쥔 채 터널이 살아 있었고, 클라이언트는 노트북 MySQL 에 붙었다).
owner="$(port_owner)"
if [ -n "$owner" ]; then
  # ssh 가 쥐고 있으면 이미 열린 터널로 본다. --ensure 는 그대로 성공한다.
  # ⚠️ 같은 포트를 쓰는 **다른** ssh 터널이면 오탐이다. 그때는 --stop 후 다시 연다.
  if [ "$owner" = "ssh" ]; then
    if [ "$mode" = "ensure" ]; then
      echo "db-tunnel: 127.0.0.1:${local_port} 터널이 이미 열려 있다 (ssh pid $(port_pid))."
      exit 0
    fi
    echo "127.0.0.1:${local_port} 에 이미 ssh 터널이 있다. 닫으려면: $0 --stop $host $local_port" >&2
    exit 1
  fi
  echo "127.0.0.1:${local_port} 을 이미 다른 프로세스가 쓰고 있다:" >&2
  lsof -nP -iTCP:"$local_port" -sTCP:LISTEN >&2
  echo "다른 포트로 여세요: $0 $host 3307   (그 뒤 .env 의 DB_PORT 도 3307 로)" >&2
  exit 1
fi

# 컨테이너의 gwbridge IP. 1차: 컨테이너 inspect. 2차: gwbridge 네트워크 쪽에서 컨테이너 ID 로 역조회.
# ⚠️ Swarm 태스크는 gwbridge 에 붙어 있어도 **컨테이너 inspect 의 Networks 에는 overlay 만 보인다**
#    (2026-09-02 실측: inspect → overlay 1개, `docker network inspect docker_gwbridge` → 같은 컨테이너 ID 가 172.18.0.x 로 등재).
#    그래서 2차 경로가 실제로 쓰이는 경로다. 1차는 비-Swarm 컨테이너를 위해 남긴다.
# 스택 네임스페이스 라벨로 컨테이너를 고른다 — `name=` 은 부분 문자열 매칭이라 다른 스택을 잡을 수 있다.
remote_ip="$(ssh "$host" '
  cid=$(docker ps -q --filter label=com.docker.stack.namespace=prod_nerd_db | head -1)
  [ -n "$cid" ] || { echo "prod_nerd_db 컨테이너가 없다" >&2; exit 1; }
  ip=$(docker inspect "$cid" --format "{{with index .NetworkSettings.Networks \"docker_gwbridge\"}}{{.IPAddress}}{{end}}")
  if [ -z "$ip" ]; then
    ip=$(docker network inspect docker_gwbridge \
      --format "{{range \$id,\$c := .Containers}}{{if eq (printf \"%.12s\" \$id) \"$cid\"}}{{\$c.IPv4Address}}{{end}}{{end}}" \
      | cut -d/ -f1)
  fi
  printf "%s" "$ip"
')"

# Go 템플릿은 키가 없으면 "<no value>" 같은 문자열을 내므로 비어 있지 않다는 것만 믿지 않는다.
case "$remote_ip" in
  '' | *[!0-9.]*)
    echo "MySQL 컨테이너의 docker_gwbridge IP 를 얻지 못했다 (응답: '${remote_ip}')." >&2
    echo "컨테이너가 gwbridge 에 붙어 있지 않을 수 있다 — 서버에서 확인:" >&2
    echo "  docker network inspect docker_gwbridge --format '{{range \$id,\$c := .Containers}}{{printf \"%.12s\" \$id}} {{\$c.Name}} {{\$c.IPv4Address}}{{\"\\n\"}}{{end}}'" >&2
    exit 1
    ;;
esac

# ExitOnForwardFailure — 포워딩을 못 열면 경고 대신 종료한다.
if [ "$mode" = "ensure" ]; then
  # -f 는 인증 후 백그라운드로 내려간다. dev 서버가 앞에서 돌아야 하므로 전면을 차지하지 않는다.
  ssh -f -N -o ExitOnForwardFailure=yes -L "127.0.0.1:${local_port}:${remote_ip}:3306" "$host"
  # -f 가 성공했어도 리슨이 잡히기까지 짧은 지연이 있다. **열렸음을 확인하고 성공을 보고한다.**
  for _ in $(seq 1 20); do
    [ "$(port_owner)" = "ssh" ] && {
      echo "db-tunnel: 127.0.0.1:${local_port} → ${host} → ${remote_ip}:3306 (백그라운드). 닫기: pnpm back db:tunnel:stop"
      exit 0
    }
    sleep 0.25
  done
  echo "ssh 는 성공했는데 127.0.0.1:${local_port} 리슨이 잡히지 않는다 — 터널을 신뢰할 수 없다." >&2
  exit 1
fi

echo "터널: 127.0.0.1:${local_port} → ${host} → ${remote_ip}:3306   (Ctrl-C 로 종료)"
exec ssh -N -o ExitOnForwardFailure=yes -L "127.0.0.1:${local_port}:${remote_ip}:3306" "$host"
