#!/usr/bin/env bash
# 노트북 → (SSH) → 매니저 → MySQL 컨테이너 로 3306 터널을 연다. **호스트 포트 publish 없이.**
#
#   scripts/db-tunnel.sh [ssh-host=fs-01] [local-port=3306]
#   → 터널이 열린 동안 127.0.0.1:<local-port> 가 운영 DB 다. Ctrl-C 로 닫는다.
#   → GUI 도구·mysql CLI 는 host 127.0.0.1 / port <local-port> 로 붙는다.
#
# 왜 publish 를 안 하나: Swarm 은 publish 를 127.0.0.1 로 제한할 수 없다(항상 0.0.0.0). 포트를 열면
# 인터넷 노출 여부가 VCN 보안 목록 **하나**에 달리게 된다. 대신 컨테이너가 docker_gwbridge 에 갖는
# 호스트 로컬 IP 로 붙는다 — 이 IP 는 호스트 밖에서 라우팅되지 않아 SSH 를 거치지 않으면 닿을 수 없다.
# ⚠️ 그 IP 는 컨테이너가 바뀔 때마다(재배포·재시작) 달라진다. 그래서 매번 조회한다.
# 기본 호스트 `fs-01` 은 **SSH 별칭**이다 — 주소·사용자·키는 노트북의 ~/.ssh/config `Host fs-01` 블록에만 둔다.
# 🚫 IP·도메인을 이 파일에 적지 않는다. 별칭만으로는 서버에 닿을 수 없다.

set -euo pipefail

host="${1:-fs-01}"
local_port="${2:-3306}"

# 스택 네임스페이스 라벨로 컨테이너를 고른다 — `name=` 은 부분 문자열 매칭이라 다른 스택을 잡을 수 있다.
remote_ip="$(ssh "$host" '
  cid=$(docker ps -q --filter label=com.docker.stack.namespace=prod_nerd_db | head -1)
  [ -n "$cid" ] || { echo "prod_nerd_db 컨테이너가 없다" >&2; exit 1; }
  docker inspect "$cid" --format "{{.NetworkSettings.Networks.docker_gwbridge.IPAddress}}"
')"
[ -n "$remote_ip" ] || { echo "gwbridge IP 를 얻지 못했다" >&2; exit 1; }

echo "터널: 127.0.0.1:${local_port} → ${host} → ${remote_ip}:3306   (Ctrl-C 로 종료)"
exec ssh -N -L "127.0.0.1:${local_port}:${remote_ip}:3306" "$host"
