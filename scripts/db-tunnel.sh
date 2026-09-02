#!/usr/bin/env bash
# 노트북 → (SSH) → 매니저 → MySQL 컨테이너 로 3306 터널을 연다. **호스트 포트 publish 없이.**
#
#   scripts/db-tunnel.sh [ssh-host=fs-01] [local-port=3306]
#   → 터널이 열린 동안 127.0.0.1:<local-port> 가 운영 DB 다. Ctrl-C 로 닫는다.
#   → GUI 도구·mysql CLI 는 host 127.0.0.1 / port <local-port> 로 붙는다.
#   → 노트북에 MySQL 이 이미 3306 을 쓰고 있으면 3307 등 다른 포트를 준다 (.env 의 DB_PORT 도 맞춘다).
#
# 왜 publish 를 안 하나: Swarm 은 publish 를 127.0.0.1 로 제한할 수 없다(항상 0.0.0.0). 포트를 열면
# 인터넷 노출 여부가 VCN 보안 목록 **하나**에 달리게 된다. 대신 컨테이너가 docker_gwbridge 에 갖는
# 호스트 로컬 IP 로 붙는다 — 이 IP 는 호스트 밖에서 라우팅되지 않아 SSH 를 거치지 않으면 닿을 수 없다.
# ⚠️ 그 IP 는 컨테이너가 바뀔 때마다(재배포·재시작) 달라진다. 그래서 매번 조회한다.
# 기본 호스트 `fs-01` 은 **SSH 별칭**이다 — 주소·사용자·키는 노트북의 ~/.ssh/config `Host fs-01` 블록에만 둔다.
# 🚫 IP·도메인을 이 파일에 적지 않는다. 별칭만으로는 서버에 닿을 수 없다.
# 🚫 sudo 로 실행하지 않는다 — root 의 ~/.ssh/config 를 읽어 별칭을 못 찾는다. root 가 필요한 동작이 없다.

set -euo pipefail

host="${1:-fs-01}"
local_port="${2:-3306}"

# 로컬 포트 선점 검사. ssh 는 bind 실패를 **경고만 하고 계속 돌아** "터널이 떴는데 안 붙는" 상태를 만든다
# (2026-09-02 실측: 노트북 MySQL 이 3306 을 쥔 채 터널이 살아 있었고, 클라이언트는 노트북 MySQL 에 붙었다).
if lsof -nP -iTCP:"$local_port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "127.0.0.1:${local_port} 을 이미 다른 프로세스가 쓰고 있다:" >&2
  lsof -nP -iTCP:"$local_port" -sTCP:LISTEN >&2
  echo "다른 포트로 여세요: $0 $host 3307   (그 뒤 mysql -P 3307 / .env DB_PORT=3307)" >&2
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

echo "터널: 127.0.0.1:${local_port} → ${host} → ${remote_ip}:3306   (Ctrl-C 로 종료)"
# ExitOnForwardFailure — 포워딩을 못 열면 경고 대신 종료한다.
exec ssh -N -o ExitOnForwardFailure=yes -L "127.0.0.1:${local_port}:${remote_ip}:3306" "$host"
