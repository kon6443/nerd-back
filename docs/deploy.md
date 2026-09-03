# 배포 및 운영 (SSOT)

> **용도**: 배포 구성·흐름·롤백의 단일 출처. 배포·인프라 작업 전에 읽는다.
> **경계**: 여기는 *어떻게 배포하고 운영하는가*. 코드 규약은 [`.claude/rules/back-code-patterns.md`](../.claude/rules/back-code-patterns.md), 금지·함정은 [`../CLAUDE.md`](../CLAUDE.md), 결정 근거는 [`tasks/tasks-backend-skeleton.md`](tasks/tasks-backend-skeleton.md).
> 🚫 실제 도메인·IP·서버 경로·네트워크 이름은 이 문서에 적지 않는다. 전부 GitHub Environment 시크릿에서 온다.

---

## 구성

| 항목 | 값 |
|---|---|
| 오케스트레이터 | Docker Swarm (stack) |
| 스택 | `prod_nerd_back`(백엔드) · `prod_nerd_front`(프론트) · `prod_nerd_cache`(Redis) · `prod_nerd_db`(MySQL) — **전부 독립 배포** |
| 서비스 DNS | `prod_nerd_back_app` · `prod_nerd_front_app` · `prod_nerd_cache_redis` · `prod_nerd_db_mysql` |
| 레플리카 | 백엔드 **3** · 프론트 **3** · Redis 1 · MySQL 1 |
| 컨테이너 포트 | 백엔드 **5501** · 프론트 **5502** — 둘 다 호스트 publish 없음 |
| 이미지 | 멀티스테이지, `linux/arm64` 단독, 태그 = 커밋 short SHA. 이름 `prod_nerd_back` · `prod_nerd_front`(`_app` 접미사 없음) |
| 네트워크 | 기존 overlay 에 `external: true` 로 참여 |
| 클러스터 | Swarm 노드 **3개** (2026-09-03 확인 — `monitor_shared_*` 가 global 3/3, Redis 옛 태스크가 다른 노드에서 종료된 이력) |
| 노드 배치 | 라벨 제약 — `prod_nerd_back=1` · `prod_nerd_front=1` · `prod_nerd_redis=1` · `prod_nerd_db=1` (규칙: `prod_<프로젝트>_<역할>`). **네 라벨이 전부 매니저 노드 하나에만 붙어 있어 우리 태스크는 모두 그 노드에 뜬다** |
| 리버스 프록시 | Caddy — 프론트 도메인의 `/api/v2/*` → `prod_nerd_back_app:5501`, 나머지(catch-all) → `prod_nerd_front_app:5502` |
| 저장소 | 모노레포 — `apps/back` · `apps/front` · 공유 `infra/` |
| GitHub Environment | `PROD` (시크릿 **9개**) |

서비스 DNS 는 **`<스택명>_<서비스명>`** 이다. 원하는 이름을 스택 쪽에 넣으면 서비스 키가 뒤에 한 번 더 붙으므로, **최종 DNS 이름을 먼저 적고 역산**한다.

**스택 이름 = 노드 라벨 키**로 맞춰 두었다 — 어느 스택이 어느 라벨을 보는지 파일을 열지 않고도 알 수 있다. 서비스 키는 앱 스택이 `app`, 인프라 스택은 역할명(`mysql`)이다.
⚠️ **Redis 스택만 예외다** (`prod_nerd_cache` / 라벨 `prod_nerd_redis`). named volume 이 스택 이름을 물고 있어 이름을 바꾸면 데이터 경계가 이동한다 — `infra/prod_nerd_cache.yml` 상단 주석 참조. **일관성을 이유로 바꾸지 않는다.**

**호스트로 포트를 publish 하지 않는다.** Caddy 가 같은 overlay 안에 있어 서비스 DNS 로 바로 닿는다. publish 하면 도메인을 우회한 직접 접근 경로가 열리고 기존 스택과 포트가 겹칠 위험도 생긴다.

---

## 독립 배포 — 무엇을 바꾸면 무엇이 뜨는가

네 대상을 **별도 스택 + 별도 워크플로**로 둔다. 같은 스택에 묶으면 한쪽 설정만 바꿔도 커밋 SHA 가 바뀌어 다른 쪽 이미지 태그까지 달라지고, 결과적으로 전부 재배포된다.

| 변경한 것 | 도는 워크플로 | 백엔드 | 프론트 | Redis | MySQL |
|---|---|:-:|:-:|:-:|:-:|
| `apps/back/{src,scripts,test}/**` · `apps/back/Dockerfile` · 의존성 · `tsconfig*` · `jest.config.js` | `deploy-back.yml` | **빌드+배포** | X | X | X |
| `infra/prod_nerd_back.yml` | `deploy-back.yml` | **빌드+배포** | X | X | X |
| `apps/front/{app,public,scripts}/**` · `apps/front/Dockerfile` · 의존성 · `next.config.ts` · `.env.production` | `deploy-front.yml` | X | **빌드+배포** | X | X |
| `infra/prod_nerd_front.yml` | `deploy-front.yml` | X | **빌드+배포** | X | X |
| `infra/prod_nerd_cache.yml` | `deploy-redis.yml` | X | X | 재시작 | X |
| `infra/prod_nerd_db.yml` · `infra/mysql/**` | `deploy-db.yml` | X | X | X | 재시작 |
| 루트 설정(`package.json` · `pnpm-workspace.yaml` · 루트 lockfile) · 문서 · `.claude/**` | (없음) | X | X | X | X |

**배포 워크플로 4개의 `paths` 화이트리스트는 교집합이 0건이다.** glob 을 정규식으로 바꿔 `git ls-files` 전수에 매칭해 확인한다 — 문자열 비교가 아니라 파일 단위로 센다 (스크립트는 `docs/tasks/tasks-monorepo.md` Step 5).

⚠️ **루트 워크스페이스 파일은 배포를 트리거하지 않는다.** 컨테이너 빌드 컨텍스트가 `apps/<앱>` 뿐이라 산출물을 바꿀 수 없기 때문이다. 그 파일들의 회귀는 `ci-back.yml` · `ci-front.yml` 이 PR 에서 잡는다(CI 는 반대로 **넓게** 잡아 두 앱이 함께 돈다).

서버에서 직접 배포할 때 (`$DEPLOY_DIR` 은 시크릿):

```bash
docker stack deploy -c "$DEPLOY_DIR/stacks/prod_nerd_back.yml"  prod_nerd_back
docker stack deploy -c "$DEPLOY_DIR/stacks/prod_nerd_front.yml" prod_nerd_front
docker stack deploy -c "$DEPLOY_DIR/stacks/prod_nerd_cache.yml" prod_nerd_cache
docker stack deploy -c "$DEPLOY_DIR/stacks/prod_nerd_db.yml"    prod_nerd_db   # 사전 조건: 라벨·secret·데이터 경로 (deploy-db.yml 사전 점검)
```

**파일명 = 스택명 — 저장소와 서버가 같은 이름을 쓴다.** 스택명은 노드 라벨 키·서비스 DNS 접두와도 같으므로 이름 하나로 YAML·env·라벨·DNS 를 전부 찾는다. 저장소에서 이미 그 이름이라 **CI 는 파일을 그대로 올린다**(이름을 바꾸는 단계가 없다).

```
infra/                                 ← 저장소. 배포되는 스택 4개가 여기 다 있다
├── prod_nerd_back.yml
├── prod_nerd_front.yml
├── prod_nerd_db.yml
├── prod_nerd_cache.yml                ← Redis. 스택명이 cache 인 예외가 파일명에 드러난다
└── mysql/init-users.sh                ← prod_nerd_db.yml 의 configs 가 ./mysql/ 로 참조

<DEPLOY_DIR>/                          ← 서버
├── stacks/   prod_nerd_back.yml · prod_nerd_front.yml · prod_nerd_db.yml · prod_nerd_cache.yml · mysql/init-users.sh
└── env/      prod_nerd_back.env · prod_nerd_front.env      (600, 사람이 관리)
```

⚠️ `stacks/` 는 **CI 가 scp 로 덮어쓴다.** 사람이 손으로 고치면 다음 배포에 사라진다. 전송은 `source: infra/<스택명>.yml` + `strip_components: 1` 로, `infra/` 만 벗기고 이름은 그대로 간다.
⚠️ `mysql/init-users.sh` 는 `prod_nerd_db.yml` **옆에** 있어야 한다 — 저장소에서도 서버에서도. YAML 의 `configs.…file: ./mysql/init-users.sh` 가 YAML 파일이 있는 디렉터리 기준이고, `strip_components: 1` 이 그 구조를 보존한다.
⚠️ `init-users.sh` 를 고치면 **Swarm config 이름의 `-v1` 도 올려야 한다.** Swarm config 는 불변이라 같은 이름에 다른 내용을 올리면 `docker stack deploy` 가 실패한다.

---

## MySQL 스택 (`prod_nerd_db`)

운영에 필요한 **사실**만 적는다. 설정값을 왜 그렇게 골랐는지는 [`tasks/archive/tasks-db-mysql.md`](tasks/archive/tasks-db-mysql.md).

| 항목 | 값 |
|---|---|
| 이미지 · 서비스 DNS | `mysql:8.4` · `prod_nerd_db_mysql` |
| 데이터 위치 | named volume `prod_nerd_db_mysql-data` → **블록 볼륨 위 디렉터리**(`type: none, o: bind`). 경로는 GitHub 시크릿 `MYSQL_DATA_DIR`. `docker stack rm` 해도 볼륨은 남는다 |
| 배포 사전 조건 | 노드 라벨 `prod_nerd_db=1` · Swarm secret `prod_nerd_db_{root,app,migrator}_pw` · `MYSQL_DATA_DIR` 경로 존재(= 블록 볼륨 마운트됨). **`deploy-db.yml` 사전 점검이 셋을 배포 전에 막는다** |
| 계정 | `root`(복구) · `nerd_app`(앱, DML 만) · `nerd_migrator`(마이그레이션, DDL). 앱은 서버 `.env` 의 `DB_PASSWORD` 로 받는다 — **secret 과 `.env` 두 곳**, 회전 시 함께 |
| 설정 변경 | `infra/prod_nerd_db.yml` 의 `command:` 플래그 → main 푸시 → MySQL **재시작(10~30초 DB 요청 실패, 앱은 유지)** |
| 첫 기동에 굳는 값 | `lower_case_table_names=1` · `MYSQL_DATABASE=nerd` · initdb 계정 생성 스크립트. 바꾸려면 덤프 후 재초기화 |
| 외부 접속 | **포트 publish 없음.** SSH 터널만 — 사용법은 [백엔드 README](../apps/back/README.md) 「DB 접속」 |
| 백업 | **없음** — 후속 태스크. 그때까지 유실 방어가 0 이다 |


`main` 푸시 → GitHub Actions

```
paths 화이트리스트 트리거 (앱별로 갈린다)
  → verify job: 그 앱의 ci:all 만                     ← 이 게이트 없이 배포하지 않는다
  → buildx 빌드 (네이티브 arm64 러너, context=apps/<앱>, gha 캐시 scope=<앱>,
                 --provenance=false --sbom=false)
  → 레지스트리 push (태그 = 커밋 short SHA)
  → 러너에서 stack YAML 을 스택명으로 복사 → 매니저의 $DEPLOY_DIR/stacks/ 로 전송
  → docker stack deploy --detach=false               ← 수렴까지 동기 대기
  → liveness 폴링 스모크 테스트 (라벨 필터)            ← 여기까지 통과해야 배포 완료
```

- 트리거는 `paths` **화이트리스트**로 지정한다. `paths-ignore` 는 머지 커밋 평가에서 의도 외 트리거가 발생한다.
- 이미지 태그가 불변이라 어떤 커밋이 떠 있는지 항상 특정된다.
- `--provenance=false --sbom=false` 가 필요하다. Swarm 의 매니페스트 처리가 attestation 을 삼키지 못한다.
- 스모크 테스트는 **떠 있는 태스크 안에서** 확인한다. `docker run --network <overlay>` 는 쓰지 않는다 — Swarm overlay 는 기본적으로 attachable 이 아니다.
- 러너는 6개 워크플로 전부 **`ubuntu-24.04-arm`(네이티브 arm64)** 다. 저장소가 public 이라 무료이고 QEMU 에뮬레이션 계층이 없다. 🚫 private 으로 바꾸면 이 라벨은 실패한다.
- 컨테이너를 고를 때는 **스택 네임스페이스 라벨**을 쓴다 — `--filter name=` 은 부분 문자열 매칭이라 이름이 겹치는 다른 스택까지 잡는다 ([lessons 2026-09-01](lessons.md)).

### 롤링 업데이트

```
update_config:   order: start-first · parallelism: 1 · delay 5s · monitor 45s · failure_action: rollback · max_failure_ratio: 0
rollback_config: order: start-first · parallelism: 1 · monitor 10s
healthcheck:     liveness 경로만 (scripts/healthcheck.mjs) · start_period 30s
restart_policy:  on-failure · delay 10s · **무제한** — DB 없이는 부팅 실패(D8)하므로 DB 복구 시 자동 복원되게
stop_grace_period: 30s
```

레플리카 3개를 두는 이유가 이것이다. 우리 스택이 **한 노드에 모여 있어도 무중단 배포**가 된다.

### ⚠️ 스모크 테스트·사전 점검은 "태스크가 매니저 노드에 있다"에 의존한다

클러스터는 노드 3개인데, 배포 워크플로는 **매니저에 SSH 해서 `docker ps` 로 컨테이너를 찾는다.** `docker ps` 는 그 노드의 컨테이너만 본다. 지금 동작하는 이유는 네 라벨이 전부 매니저 노드에 붙어 있어 태스크가 항상 거기 뜨기 때문이고, **구조적 보장이 아니다.**

- 🚫 **라벨을 다른 노드에 추가하거나 `placement` 제약을 풀지 않는다.** 태스크가 다른 노드로 가면 매니저의 `docker ps` 가 컨테이너를 못 찾아 **성공한 배포가 실패로 보고**된다. `deploy-db` 의 데이터 경로 검사(`[ -d "$MYSQL_DATA_DIR" ]`)도 같은 이유로 매니저에서만 유효하다.
- 다중 노드로 퍼뜨릴 필요가 생기면 스모크를 **노드 무관**으로 바꿔야 한다 — 서비스 DNS 를 거치거나(`tasks.<서비스>`), `docker service ps` 로 노드를 찾아 그 노드에서 실행하거나, 프록시를 경유한 도메인 폴링으로 대체한다.

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

배포 구성이 코드에 거는 제약이다. 코드를 쓸 때의 상세는 [`.claude/rules/back-code-patterns.md`](../.claude/rules/back-code-patterns.md) §6·§8.

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

**readiness 가 200 이면** `REDIS_HOST` 해석과 **DB 연결(`db: up`)** 까지 성공했다는 뜻이다. `db: down` 이면 `message` 에 사유가 실린다(`Access denied` = 비밀번호/계정, `getaddrinfo` = 호스트명).

```bash
# MySQL — 서버가 그 값으로 떠 있나 (배포 스모크와 같은 질문. 비밀번호는 컨테이너 안 secret 파일로만 넘긴다)
dcid=$(docker ps -q --filter "label=com.docker.stack.namespace=prod_nerd_db" | head -1)
docker exec "$dcid" bash -c 'mysql --defaults-extra-file=<(printf "[client]\nuser=root\npassword=%s\n" "$(< /run/secrets/prod_nerd_db_root_pw)") \
  -N -B -e "SELECT @@character_set_server, @@collation_server, @@global.time_zone, @@lower_case_table_names"'
#   utf8mb4  utf8mb4_0900_ai_ci  +00:00  1

# 데이터가 정말 블록 볼륨에 있나
docker volume inspect prod_nerd_db_mysql-data --format '{{.Options}}'   # device 가 MYSQL_DATA_DIR 경로
```

⚠️ **호스트 OS 는 KST, 컨테이너·DB·로그는 전부 UTC 다.** `docker logs --since 2026-09-02T07:00:00` 처럼 오프셋 없는 시각은 **호스트 TZ(KST)로 해석**된다 — 운영 명령의 시각에는 항상 `Z` 나 오프셋을 붙인다. 호스트 TZ 는 다른 서비스가 공유하므로 바꾸지 않는다.

### 무중단 배포 실측

배포 중 폴링해서 비-200 과 연결 끊김이 **0건**이어야 한다.

**설정은 무중단이 되도록 구성돼 있다** — 2026-08-28 `infra/prod_nerd_back.yml`(당시 `infra/docker-stack.app.yml`) 대조 확인:

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
- 한 노드에 replicas 3 이 모여 있으므로 리소스 경합으로 새 태스크 기동이 느려질 수 있다

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
docker service update --rollback prod_nerd_db_mysql    # MySQL 설정 되돌리기. 데이터는 볼륨에 남는다
docker stack rm prod_nerd_db                           # 스택 제거 — 볼륨·데이터는 남는다. 볼륨은 명시적으로만 지운다
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

1. GitHub Environment `QA` 생성 후 같은 이름의 시크릿 9개를 QA 값으로 등록 (`DEPLOY_DIR` 은 QA 트리 경로)
2. 서버에 `<DEPLOY_DIR>/{stacks,env}` 를 만들고 `env/qa_nerd_back.env` · `env/qa_nerd_front.env` 생성
3. 워크플로 복제 또는 파라미터화 — **스택 이름이 워크플로에 하드코딩되어 있다.** 환경이 하나뿐이라 명시적인 편이 읽기 쉬워 그대로 뒀고, 두 번째 환경이 생기는 시점에 파라미터화한다

| 대상 | 규칙 | 예 |
|---|---|---|
| 앱 디렉터리 | `apps/<앱>` | `apps/back` · `apps/front` |
| 패키지명 (`pnpm --filter`) | `nerd-<앱>` | `nerd-back` · `nerd-front` |
| 워크플로 | `ci-<앱>.yml` · `deploy-<앱>.yml` | `deploy-front.yml` |
| Swarm 스택 | `<환경>_<프로젝트>_<역할>` — **노드 라벨 키와 동일** | `prod_nerd_back` · `prod_nerd_front` |
| 서비스 키 | `app` 고정 | |
| 서비스 DNS | `<스택>_app` | `prod_nerd_back_app` |
| 이미지 | `<환경>_<프로젝트>_<역할>` — 스택과 별개 네임스페이스, 접미사 없음 | `prod_nerd_back:<sha>` |
| 스택 파일 | 저장소 `infra/<스택명>.yml` → 서버 `<DEPLOY_DIR>/stacks/<스택명>.yml` — **양쪽 파일명 = 스택명** | `infra/prod_nerd_front.yml` |
| 서버 env 파일 | `<DEPLOY_DIR>/env/<스택명>.env` | `env/prod_nerd_front.env` |
| GitHub Environment | 대문자 환경명 | `PROD` |

**시크릿 9개** — `REGISTRY_URL` `REGISTRY_USERNAME` `REGISTRY_PASSWORD` `DEPLOY_SERVER` `DEPLOY_USER` `SWARM_MANAGER_SSH_KEY` `OVERLAY_NETWORK` `MYSQL_DATA_DIR` **`DEPLOY_DIR`**.
경로 시크릿은 `DEPLOY_DIR` **하나뿐**이고 나머지 경로는 워크플로가 위 규약으로 계산한다 — **앱·스택이 늘어도 시크릿이 늘지 않는다.** (`MYSQL_DATA_DIR` 만 예외 — 블록 볼륨 마운트 경로라 배포 트리와 무관하다.)

🚫 **두 스택이 같은 파일명을 쓰지 않는다.** 파일명 = 스택명 규약이 이것을 구조적으로 보장한다 — 옛 구조는 두 앱이 둘 다 `docker-stack.app.yml` 이라 디렉터리로만 구분됐고, 그래서 서버에서도 저장소별 디렉터리가 필요했다.

⚠️ Redis 스택(`prod_nerd_cache`)만 이 규칙의 예외다 — 위 「구성」절 참조.
