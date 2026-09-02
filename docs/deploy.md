# 배포 및 운영 (SSOT)

> **용도**: 배포 구성·흐름·롤백의 단일 출처. 배포·인프라 작업 전에 읽는다.
> **경계**: 여기는 *어떻게 배포하고 운영하는가*. 코드 규약은 [`.claude/rules/code-patterns.md`](../.claude/rules/code-patterns.md), 금지·함정은 [`../CLAUDE.md`](../CLAUDE.md), 결정 근거는 [`tasks/tasks-backend-skeleton.md`](tasks/tasks-backend-skeleton.md).
> 🚫 실제 도메인·IP·서버 경로·네트워크 이름은 이 문서에 적지 않는다. 전부 GitHub Environment 시크릿에서 온다.

---

## 구성

| 항목 | 값 |
|---|---|
| 오케스트레이터 | Docker Swarm (stack) |
| 스택 | `prod_nerd_back`(앱) · `prod_nerd_cache`(Redis) · `prod_nerd_db`(MySQL) — **독립 배포** |
| 서비스 DNS | `prod_nerd_back_app` · `prod_nerd_cache_redis` · `prod_nerd_db_mysql` |
| 레플리카 | 앱 **3** · Redis 1 · MySQL 1 |
| 컨테이너 포트 | **5501** — 호스트 publish 없음 |
| 이미지 | 멀티스테이지, `linux/arm64` 단독, 태그 = 커밋 short SHA |
| 네트워크 | 기존 overlay 에 `external: true` 로 참여 |
| 노드 배치 | 라벨 제약 — `prod_nerd_back=1` · `prod_nerd_redis=1` · `prod_nerd_db=1` (규칙: `prod_<프로젝트>_<역할>`) |
| 리버스 프록시 | Caddy → `reverse_proxy http://prod_nerd_back_app:5501` |
| GitHub Environment | `PROD` (시크릿 9개) |

서비스 DNS 는 **`<스택명>_<서비스명>`** 이다. 원하는 이름을 스택 쪽에 넣으면 서비스 키가 뒤에 한 번 더 붙으므로, **최종 DNS 이름을 먼저 적고 역산**한다.

**스택 이름 = 노드 라벨 키**로 맞춰 두었다 — 어느 스택이 어느 라벨을 보는지 파일을 열지 않고도 알 수 있다. 서비스 키는 앱 스택이 `app`, 인프라 스택은 역할명(`mysql`)이다.
⚠️ **Redis 스택만 예외다** (`prod_nerd_cache` / 라벨 `prod_nerd_redis`). named volume 이 스택 이름을 물고 있어 이름을 바꾸면 데이터 경계가 이동한다 — `infra/docker-stack.redis.yml` 상단 주석 참조. **일관성을 이유로 바꾸지 않는다.**

**호스트로 포트를 publish 하지 않는다.** Caddy 가 같은 overlay 안에 있어 서비스 DNS 로 바로 닿는다. publish 하면 도메인을 우회한 직접 접근 경로가 열리고 기존 스택과 포트가 겹칠 위험도 생긴다.

---

## 독립 배포 — 무엇을 바꾸면 무엇이 뜨는가

앱과 Redis 를 **별도 스택**으로 둔다. 같은 스택이면 Redis 설정만 바꿔도 커밋 SHA 가 바뀌어 앱 이미지 태그가 달라지고, 결과적으로 앱까지 재배포된다.

| 변경한 것 | 도는 워크플로 | 이미지 빌드 | 앱 재배포 | Redis 재시작 | MySQL 재시작 |
|---|---|:-:|:-:|:-:|:-:|
| `src/**` · `scripts/**` · `Dockerfile` · 의존성 | `deploy.yml` | O | O | X | X |
| `infra/docker-stack.app.yml` | `deploy.yml` | O | O | X | X |
| `infra/docker-stack.redis.yml` | `deploy-redis.yml` | X | X | O | X |
| `infra/docker-stack.db.yml` · `infra/mysql/**` | `deploy-db.yml` | X | X | X | O |
| 문서·태스크 파일만 | (없음) | X | X | X | X |

세 워크플로의 `paths` 화이트리스트는 **교집합이 0건**이다.

```bash
docker stack deploy -c infra/docker-stack.app.yml   prod_nerd_back
docker stack deploy -c infra/docker-stack.redis.yml prod_nerd_cache
docker stack deploy -c infra/docker-stack.db.yml    prod_nerd_db      # 사전 조건: 라벨·secret·데이터 경로 (deploy-db.yml 사전 점검)
```

---

## 배포 흐름

`main` 푸시 → GitHub Actions

```
paths 화이트리스트 트리거
  → ci:all (lint → 스텁 검사 → 단위 → E2E → build)   ← 이 게이트 없이 배포하지 않는다
  → buildx 빌드 (네이티브 arm64 러너, gha 캐시, --provenance=false --sbom=false)
  → 레지스트리 push (태그 = 커밋 short SHA)
  → stack YAML 을 매니저로 전송
  → docker stack deploy --detach=false               ← 수렴까지 동기 대기
  → liveness 폴링 스모크 테스트                       ← 여기까지 통과해야 배포 완료
```

- 트리거는 `paths` **화이트리스트**로 지정한다. `paths-ignore` 는 머지 커밋 평가에서 의도 외 트리거가 발생한다.
- 이미지 태그가 불변이라 어떤 커밋이 떠 있는지 항상 특정된다.
- `--provenance=false --sbom=false` 가 필요하다. Swarm 의 매니페스트 처리가 attestation 을 삼키지 못한다.
- 스모크 테스트는 **떠 있는 태스크 안에서** 확인한다. `docker run --network <overlay>` 는 쓰지 않는다 — Swarm overlay 는 기본적으로 attachable 이 아니다.
- 러너는 **`ubuntu-24.04-arm`(네이티브 arm64)** 다. 저장소가 public 이라 무료이고 QEMU 에뮬레이션 계층이 없다. 🚫 private 으로 바꾸면 이 라벨은 실패한다.
- 컨테이너를 고를 때는 **스택 네임스페이스 라벨**을 쓴다 — `--filter name=` 은 부분 문자열 매칭이라 이름이 겹치는 다른 스택까지 잡는다 ([lessons 2026-09-01](lessons.md)).

### 롤링 업데이트

```
update_config:   order: start-first · parallelism: 1 · delay 5s · monitor 45s · failure_action: rollback · max_failure_ratio: 0
rollback_config: order: start-first · parallelism: 1 · monitor 10s
healthcheck:     liveness 경로만 (scripts/healthcheck.mjs) · start_period 30s
restart_policy:  on-failure · delay 10s · **무제한** — DB 없이는 부팅 실패(D8)하므로 DB 복구 시 자동 복원되게
stop_grace_period: 30s
```

레플리카 3개를 두는 이유가 이것이다. 단일 노드에서도 **무중단 배포**가 된다.

⚠️ Redis·MySQL 은 `order: stop-first` 다. named volume 에 두 컨테이너가 동시에 붙을 수 없어 교체 순간 짧은 공백이 있다. Redis 공백 동안 앱은 레이트리밋만 축소 모드(fail-open)로 돌고 HTTP 는 계속 응답한다. MySQL 공백 동안 DB 를 쓰는 요청은 실패한다 — 앱이 DB 를 쓰기 시작하면 이 문장의 실제 영향을 재측정한다.

---

## 리버스 프록시 (Caddy)

```caddy
handle /api/v2/* {
    reverse_proxy http://prod_nerd_back_app:5501
}
```

### ⚠️ `route` 블록 안에서는 작성 순서가 곧 평가 순서다

`route` 는 Caddy 의 자동 재정렬을 끄는 지시자다. 그 안의 `handle` 블록은 상호 배타적이라 **첫 매칭에서 끝난다.** 따라서 matcher 없는 `handle { }`(catch-all)이 위에 있으면 그 아래 블록은 **절대 도달하지 않는다.**

```caddy
route {
    handle /api/v1/* { ... }
    handle /api/v2/* { ... }   ← 반드시 catch-all 위
    handle { ... }             ← catch-all 은 항상 마지막
}
```

실제로 이 순서를 어겨 `/api/v2/*` 요청이 이웃 프로젝트의 프론트엔드로 흘러간 전례가 있다. `route` 밖에서는 Caddy 가 matcher 구체성 순으로 정렬하므로 이 함정이 없다 — **`route` 안인지 밖인지를 먼저 확인한다.**

### 적용

```bash
caddy validate --config <경로>
caddy reload   --config <경로>
```

새 설정이 유효하지 않으면 Caddy 는 기존 설정을 유지하므로 다른 사이트는 영향받지 않는다.

🚫 **Caddyfile 을 저장소에 커밋하지 않는다** — 도메인·IP 가 노출된다.

---

## 레플리카 3개가 강제하는 것

배포 구성이 코드에 거는 제약이다. 코드를 쓸 때의 상세는 [`.claude/rules/code-patterns.md`](../.claude/rules/code-patterns.md) §6·§8.

| 제약 | 어기면 |
|---|---|
| 인메모리 변수·타이머로 공유 상태 관리 금지 → Redis | 레플리카별로 상태가 갈린다 |
| 레이트리밋은 **Redis 스토리지 필수** | 실효 한도가 3배가 되어 제한이 사실상 사라진다 |
| 비용 카운터·예산 집계도 Redis | 3배까지 새어나간다 |
| 스케줄러·Cron 은 `TASK_SLOT` 가드로 1개만 | 전 레플리카에서 중복 실행된다 |
| DB 커넥션 풀 × 3 이 `max_connections`(100) 안에 들어와야 함 — 현재 풀 10 × 3 = 30, `DB_POOL_SIZE` 상한 30 | 앱이 커넥션을 못 얻어 장애 |
| WebSocket 도입 시 Redis 어댑터 필수 | 다른 레플리카의 클라이언트에 브로드캐스트가 안 간다 |

---

## 상태 확인

호스트 포트를 publish 하지 않으므로 서버에서 `curl localhost:5501` 은 되지 않는다. 컨테이너 안에서 확인한다.

```bash
# 서비스가 떠 있나
docker stack services prod_nerd_back
docker stack services prod_nerd_cache
docker stack services prod_nerd_db

# Swarm 이 보는 헬스 (우리 healthcheck.mjs 결과)
# ⚠️ 스택 단위 조회는 **네임스페이스 라벨**로 한다. `name=` 은 부분 문자열 매칭이라
#    이름이 겹치는 다른 스택의 컨테이너까지 잡는다 (lessons 2026-09-01).
docker ps --filter "label=com.docker.stack.namespace=prod_nerd_back" \
  --format '{{.Names}}\t{{.Status}}'
#   "Up N minutes (healthy)" 가 3줄이면 정상

# liveness — 종료코드만
cid=$(docker ps -q --filter "label=com.docker.stack.namespace=prod_nerd_back" | head -1)
docker exec "$cid" node scripts/healthcheck.mjs; echo "exit=$?"

# readiness — 응답 본문까지 (Redis 연결 확인)
docker exec "$cid" node -e "
require('http').get({host:'127.0.0.1',port:5501,path:'/api/v2/health/ready'},r=>{
  let b='';r.on('data',c=>b+=c);r.on('end',()=>console.log(r.statusCode,b));})"
```

**readiness 가 200 이면** `REDIS_HOST` 의 overlay DNS 해석까지 성공했다는 뜻이다.

⚠️ **호스트 OS 는 KST, 컨테이너·DB·로그는 전부 UTC 다.** `docker logs --since 2026-09-02T07:00:00` 처럼 오프셋 없는 시각은 **호스트 TZ(KST)로 해석**된다 — 운영 명령의 시각에는 항상 `Z` 나 오프셋을 붙인다. 호스트 TZ 는 다른 서비스가 공유하므로 바꾸지 않는다.

### 무중단 배포 실측

배포 중 폴링해서 비-200 과 연결 끊김이 **0건**이어야 한다.

**설정은 무중단이 되도록 구성돼 있다** — 2026-08-28 `infra/docker-stack.app.yml` 대조 확인:

| 설정 | 값 | 역할 |
|---|---|---|
| `replicas` | 3 | 교체 중에도 나머지가 요청을 받는다 |
| `order` | `start-first` | 새 태스크를 먼저 띄우고 옛 태스크를 내린다 |
| `parallelism` | 1 | 한 번에 하나만 교체 → 항상 2/3 가 서비스 중 |
| `delay` · `monitor` | 5s · **45s** | 다음 교체 전에 결과를 지켜본다. ⚠️ **`monitor` 는 `start_period` 보다 길어야 한다** — 짧으면 healthy 판정 전에 다음 교체로 넘어가 무중단 보장이 깨진다 |
| `failure_action` · `max_failure_ratio` | `rollback` · 0 | 하나라도 실패하면 되돌린다 |
| `healthcheck` | 15s 간격 · 3회 · `start_period` 30s | 준비 안 된 태스크로 트래픽이 가지 않게 한다 |

🚫 **그래도 "무중단 확인됨" 으로 적지 않는다.** 설정이 맞다는 것과 실제로 끊기지 않는다는 것은 다른 사실이다.
설정만으로는 아래를 알 수 없고, 이 넷은 폴링으로만 확정된다.

- `start_period` 30s + `interval` 15s + `retries` 3 → 새 태스크가 healthy 로 판정되는 시점과 프록시가 업스트림을 다시 보는 시점이 어긋날 수 있다
- 프록시는 `tasks.<서비스>` DNS 로 붙는다 — Swarm DNS 가 내려가는 태스크를 목록에서 빼는 타이밍과 실제 종료 사이에 공백이 생길 수 있다
- `enableShutdownHooks()` 가 진행 중인 요청을 실제로 다 마치는지는 재봐야 안다
- 단일 노드에 replicas 3 이므로 리소스 경합으로 새 태스크 기동이 느려질 수 있다

배포를 시작하기 **직전에** 켠다. 성공은 조용하고 **비정상만 찍히며**, 끝나면 스스로 판정한다 — 200 이 흐르는 화면을 눈으로 세지 않는다.

```bash
DUR=180   # 배포 소요 시간보다 넉넉하게 (초)
URL="https://<도메인>/api/v2/health"

total=0; bad=0; end=$(( $(date +%s) + DUR ))
while [ "$(date +%s)" -lt "$end" ]; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$URL")
  [ -z "$code" ] && code=000        # 연결 자체가 안 되면 curl 이 000 을 낸다
  total=$((total+1))
  [ "$code" = "200" ] || { bad=$((bad+1)); printf '%s %s\n' "$(date +%T)" "$code"; }
  sleep 1
done
printf '총 %d건 · 비정상 %d건 — ' "$total" "$bad"
if [ "$bad" -eq 0 ]; then echo "판정: 무중단"; else echo "판정: 중단 발생"; fi
```

**`비정상 0건` 이 Phase 1 의 최종 완료 조건이다.** 결과는 `docs/tasks/tasks-backend-skeleton.md` Step 10 에 기록한다.

⚠️ 서버에서 `docker exec` 로 폴링하면 `start-first` 교체 시 **대상 컨테이너 자체가 사라져** 실패가 찍힌다. 그건 서비스 중단이 아니다. 서비스 관점으로 보려면 프록시를 거쳐야 한다.

---

## 롤백

```bash
docker service update --rollback prod_nerd_back_app    # 이전 이미지로
docker service rm prod_nerd_back_app                   # 서비스 제거
docker service update --rollback prod_nerd_db_mysql    # MySQL 설정 되돌리기. 데이터는 볼륨에 남는다 — 볼륨은 명시적으로만 지운다
```

Caddy 는 블록을 제거한 뒤 `caddy validate && caddy reload`.

---

## 관측성

- **로그**: 기존 수집 에이전트가 global 모드로 전 컨테이너를 자동 발견한다. 앱은 JSON stdout 만 유지하면 되고 **추가 작업이 없다.**
- **메트릭**: `/metrics` 노출과 스크레이프 연결은 **후순위**. 별도 태스크로 진행한다.
- ⚠️ 로그 수집 스택은 **공유 자원**이고 인제스트 한도가 낮다. 대량 로그는 남의 조회까지 느려지게 한다 (code-patterns §5).

---

## 저장소에 넣지 않는 것

- `.env` 및 모든 시크릿 — 커밋 이력에 영구 보존된다
- Caddyfile — 도메인·IP 노출
- 서버 경로·인스턴스 주소·overlay 네트워크 이름 등 인프라 식별 정보

---

## 환경 추가 시 (예: QA)

1. GitHub Environment `QA` 생성 후 같은 이름의 시크릿 9개를 QA 값으로 등록
2. 서버에 `nerd-back.qa.env` 와 stack 디렉터리 생성
3. 워크플로 복제 또는 파라미터화 — **스택 이름이 워크플로에 하드코딩되어 있다.** 환경이 하나뿐이라 명시적인 편이 읽기 쉬워 그대로 뒀고, 두 번째 환경이 생기는 시점에 파라미터화한다

| 대상 | 규칙 | 예 |
|---|---|---|
| Swarm 스택 | `<환경>_<프로젝트>_<역할>` — **노드 라벨 키와 동일** | `prod_nerd_back` · `prod_nerd_front` |
| 서비스 키 | `app` 고정 | |
| 서비스 DNS | `<스택>_app` | `prod_nerd_back_app` |
| 이미지 | `<환경>_<프로젝트>_<역할>` — 스택과 별개 네임스페이스, 접미사 없음 | `prod_nerd_back:<sha>` |
| 서버 env 파일 | `<저장소>.<환경>.env` | `nerd-back.prod.env` |
| 서버 stack 디렉터리 | `.../<저장소>/<환경>/` — **저장소마다 분리**한다 | 경로는 `DEPLOY_STACK_DIR` 시크릿에 있다 |
| GitHub Environment | 대문자 환경명 | `PROD` |

🚫 **두 저장소가 같은 stack 디렉터리를 쓰지 않는다.** 올라가는 파일명이 둘 다 `docker-stack.app.yml` 이라 한쪽 배포가 다른 쪽 파일을 덮어쓴다.

⚠️ Redis 스택(`prod_nerd_cache`)만 이 규칙의 예외다 — 위 「구성」절 참조.
