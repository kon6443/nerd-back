# Task Tracker: Swarm 스택·서비스 재명명

> **상태**: **전환 완료 (2026-09-01)** — 새 스택 배포 · Caddy 전환 · 도메인 200 확인.
> 남은 것: 옛 스택 제거(절차 9) · 옛 디렉터리·env 정리(절차 11).
> **작성일**: 2026-09-01
> **용도**: 스택·서비스 이름을 노드 라벨 체계와 1:1 로 맞추는 작업의 **결정·영향 범위·전환 절차**.
> **경계**: 배포 구성의 정본은 [`../deploy.md`](../deploy.md) 다. 이 문서는 **바꾸는 동안**의 절차를 소유하고, 전환이 끝나면 결과를 `deploy.md` 에 반영한 뒤 이 문서를 아카이브한다.
> **연동**: 프론트 CI/CD 는 `nerd-front` 저장소의 `docs/tasks/tasks-frontend-cicd.md` 가 소유한다. 이 재명명이 그쪽 이름의 선행 조건이다.

---

## 왜 바꾸나

프론트가 추가되면서 이름 체계의 비대칭이 드러났다.

현재는 **스택 이름과 노드 라벨이 다르다.** 스택 `prod_nerd` 인데 라벨은 `prod_nerd_back=1` 이다. 프로젝트가 하나일 때는 문제가 없었지만, 프론트가 같은 노드에 들어오면 "이 스택이 어느 라벨을 보는가"를 매번 파일을 열어 확인해야 한다.

재명명하면 **스택 이름 = 노드 라벨 키**가 되어 대응이 한눈에 보인다. 이웃 프로젝트(`prod_nest` / `prod_next`)가 이미 쓰는 패턴이기도 하다.

---

## 현재 → 목표

서비스 DNS 는 **`<스택명>_<서비스키>`** 다. 최종 DNS 를 먼저 적고 역산했다 ([lessons 2026-08-26](../lessons.md)).

### 앱

| 대상 | 현재 | 목표 |
|---|---|---|
| Swarm 스택 | `prod_nerd` | **`prod_nerd_back`** |
| 서비스 키 | `back` | **`app`** |
| **서비스 DNS** | `prod_nerd_back` | **`prod_nerd_back_app`** |
| 노드 라벨 | `prod_nerd_back=1` | `prod_nerd_back=1` (**변경 없음** — 이제 스택명과 일치) |
| 이미지 | `prod_nerd_back:<sha>` | **변경 없음** (`_app` 을 붙이지 않는다) |
| 서버 env 파일 | `nerd.prod.env` | **`nerd-back.prod.env`** |

### 프론트 (신규)

| 대상 | 값 |
|---|---|
| Swarm 스택 | `prod_nerd_front` |
| 서비스 키 | `app` |
| **서비스 DNS** | **`prod_nerd_front_app`** |
| 노드 라벨 | `prod_nerd_front=1` (**신규 부여 필요**) |
| 서버 env 파일 | (만들지 않음 — 프론트 태스크 문서 참조) |

### 규칙 (재명명 후)

| 대상 | 규칙 | 예 |
|---|---|---|
| Swarm 스택 | `<환경>_<프로젝트>_<역할>` | `prod_nerd_back` · `prod_nerd_front` |
| 서비스 키 | `app` 고정 | |
| 서비스 DNS | `<스택>_app` | `prod_nerd_back_app` |
| 노드 라벨 | **스택 이름과 동일** | `prod_nerd_back=1` |
| 서버 env 파일 | `<저장소>.<환경>.env` | `nerd-back.prod.env` · `nerd-front.prod.env` |

---

## 결정된 예외

| 항목 | 결정 | 근거 |
|---|---|---|
| **Redis 스택** | **재명명하지 않는다.** `prod_nerd_cache` · `prod_nerd_cache_redis` 유지 | named volume 이 스택 이름을 물고 있어 데이터 경계가 이동한다 — 아래 |
| **이미지 이름** | `_app` 을 붙이지 않는다. `prod_nerd_back` · `prod_nerd_front` 유지 | 이미지는 스택과 다른 네임스페이스다. 경로를 바꾸면 기존 태그 이력이 단절되고 롤백 시 옛 태그를 손으로 찾아야 한다 |

| **전환 시 replicas** | **A안 — 3 으로 바로.** 노드 메모리 여유 확인됨 (아래 「메모리」) | 전환 중 필요한 추가 예약 576M 대비 available 8.7Gi |
| **다운타임** | **허용됨** (사용자 확인, 2026-09-01) | 무중단 절차를 그대로 쓰되, 실패해도 되돌릴 여유가 있다 |

## 🚧 미결정

없음. 서버 작업 시작 가능.

---

## ⚠️ Redis 를 재명명하지 않는 이유 — named volume 이 스택 이름을 물고 있다

**앱 스택은 볼륨이 없어 재명명이 안전하다.** Redis 는 다르다.

`infra/docker-stack.redis.yml` 의 `volumes: redis-data:` 는 Swarm 에서 **`<스택명>_redis-data`** 라는 실제 볼륨 이름으로 만들어진다. 스택 이름을 바꾸면 **새 빈 볼륨이 생성되고 기존 데이터에 닿지 않는다.**

현재 Redis 에 있는 것은 레이트리밋 카운터뿐이고 전부 TTL 이 있어 손실 영향이 작다. 그래도:

- 재명명하면 **AOF 파일이 사라진 상태로 시작**한다. 재시작 시점에 카운터가 리셋된다
- 나중에 TTL 없는 데이터(누적 카운터 등)를 넣은 뒤라면 **진짜 데이터 손실**이 된다
- 옛 볼륨은 고아로 남는다 (`docker volume ls` 에 계속 보임)

→ **결정: Redis 는 그대로 둔다.** 얻는 것(이름 일관성)이 잃는 것(데이터 경계 이동 + 고아 볼륨)보다 작다.

**라벨 `prod_nerd_redis=1` 과 스택 `prod_nerd_cache` 의 불일치가 남는다.** 앱·프론트만 「스택 이름 = 라벨」이 성립하고 Redis 는 예외다. 이 예외를 `infra/docker-stack.redis.yml` 상단 주석과 `docs/deploy.md` 이름 규칙표에 **명시**한다 — 규칙에 예외가 있다는 사실 자체를 적어두지 않으면, 나중에 누군가 "일관성"을 이유로 볼륨을 날린다.

재명명을 강행한다면 볼륨 마이그레이션 절차가 별도로 필요하다 — 이 문서의 범위 밖이다.

---

## 영향 범위 (2026-09-01 실측)

이 문서 자신을 제외한 집계다 (2026-09-01 실측). **8개 파일 54건.**

```bash
# 파일 단위 제외는 --exclude 로 한다. 아래 표의 합계와 일치해야 한다.
grep -rn "prod_nerd" --exclude-dir=node_modules --exclude-dir=dist \
  --exclude-dir=coverage --exclude-dir=.git --exclude="tasks-stack-rename.md" . \
  | wc -l                                    # → 54
```

⚠️ **`| grep -v tasks-stack-rename` 로 거르지 않는다.** 그건 파일이 아니라 줄 **내용**에 그 문자열이 있는 줄까지 지운다. 다른 파일이 본문에서 이 문서를 언급하면서 `prod_nerd` 도 같은 줄에 담고 있으면 그 줄이 조용히 빠져 건수가 어긋난다.

| 파일 | 건수 | 성격 |
|---|---|---|
| `docs/tasks/tasks-backend-skeleton.md` | 18 | 문서 (결정 근거) |
| `docs/deploy.md` | 13 | 문서 (**SSOT**) |
| `.github/workflows/deploy.yml` | 6 | **동작** |
| `infra/docker-stack.app.yml` | 6 | **동작** |
| `.github/workflows/deploy-redis.yml` | 4 | 동작 (Redis 유지 → 무변경) |
| `docs/lessons.md` | 3 | 문서 (과거 기록 — **바꾸지 않는다**) |
| `infra/docker-stack.redis.yml` | 3 | 이름은 무변경. **예외 주석은 추가한다** |
| `.env.example` | 1 | 주석 (Redis 유지 → 무변경) |

`CLAUDE.md` 는 이 목록에 없다 — 라우팅 표 등재는 **하지 않기로 했다** (2026-09-01 사용자 결정).

**동작에 영향을 주는 것은 `deploy.yml` 과 `docker-stack.app.yml` 둘뿐**이다. 나머지는 문서다.

`docs/lessons.md` 의 3건은 **과거에 그렇게 결정했던 기록**이므로 고치지 않는다. 대신 해당 항목 아래에 "2026-09-01 재명명됨" 한 줄을 덧붙인다 — 교훈 문서를 사후 편집하면 그때 무엇을 배웠는지가 사라진다.

### 저장소 밖에서 바꿔야 하는 것

| 대상 | 무엇을 | 상태 |
|---|---|---|
| **Caddyfile** | `reverse_proxy http://prod_nerd_back:5501` → `prod_nerd_back_app:5501` | 전환 절차 7번 |
| **서버 env 파일** | `nerd.prod.env` → `nerd-back.prod.env` 로 **복사**(`cp`). ⚠️ `mv` 를 쓰지 않는다 — 아래 | ✅ 2026-09-01 |
| **`ENV_FILE_PATH` 시크릿** | 새 파일 경로로 갱신 | ✅ 2026-09-01 |
| **`DEPLOY_STACK_DIR` 시크릿** | 저장소별로 분리 — 아래 | ✅ 2026-09-01 |
| **노드 라벨** | `prod_nerd_front=1` 추가 (앱 라벨은 변경 없음) | 미완 |

### stack 디렉터리 분리 (2026-09-01 완료)

| 저장소 | `DEPLOY_STACK_DIR` |
|---|---|
| `nerd-back` | `<베이스>/infra/nerd-back/prod` (기존 `<베이스>/infra/nerd/prod` 에서 이동) |
| `nerd-front` | `<베이스>/infra/nerd-front/prod` (신규) |

**두 저장소가 같은 디렉터리를 쓰면 안 된다.** 올라가는 파일명이 둘 다 `docker-stack.app.yml` 이라 한쪽 배포가 다른 쪽을 덮어쓴다.

#### ⚠️ Redis stack YAML 은 수정할 것이 없다

`deploy-redis.yml` 도 **같은 `DEPLOY_STACK_DIR` 시크릿**을 쓴다 (`target:` 과 `-c "$STACK_DIR/docker-stack.redis.yml"`). 시크릿 값만 바꾸면 Redis YAML 도 자동으로 새 경로로 간다. **`docker-stack.redis.yml` 안에는 경로 참조가 없다** — 파일 위치는 전적으로 워크플로가 정한다 (앱 YAML 의 `${ENV_FILE_PATH}` 는 별개 시크릿이고 stack 디렉터리와 무관하다).

#### 이번 커밋의 부수 효과

`infra/docker-stack.redis.yml` 에 예외 주석을 추가했으므로 **`deploy-redis.yml` 워크플로가 함께 트리거된다.** 그 결과:

- Redis YAML 이 새 경로(`.../nerd-back/prod/`)로 올라간다 ← **원하던 이동이 자동으로 이뤄진다**
- `docker stack deploy ... prod_nerd_cache` 가 실행되지만 **서비스 스펙은 무변경**이다 (주석은 파싱 후 사라진다) → Redis 재시작 없음
- `deploy.yml` 과 concurrency 그룹이 달라 병렬로 돈다. 서로 간섭하지 않는다

#### 후속 정리 (전환 안정화 후)

옛 디렉터리 `<베이스>/infra/nerd/prod/` 에 `docker-stack.app.yml` · `docker-stack.redis.yml` 이 남는다. **롤백 경로이므로 지금 지우지 않는다.** 절차 11번(옛 env 파일 제거)과 같은 시점에 정리한다.

---

## ⚠️ 스모크 테스트 필터가 신·구를 구분하지 못한다

`deploy.yml:122` 와 `deploy.md:143` 의 필터가 **부분 문자열 매칭**이다.

```bash
docker ps -q --filter "name=prod_nerd_back" | head -1
```

전환 구간에는 옛 컨테이너 `prod_nerd_back.1.xxx` 와 새 컨테이너 `prod_nerd_back_app.1.xxx` 가 **둘 다 매칭**된다. `head -1` 이 옛 컨테이너를 집으면 **새 배포가 실패했는데도 스모크가 통과**한다.

→ 필터를 `prod_nerd_back_app` 으로 바꾸는 것을 **전환 커밋에 반드시 포함**한다. 이건 문서 정리가 아니라 검증의 유효성 문제다.

---

## 메모리 — 전환 중 레플리카가 2배가 된다

옛 스택을 지우기 전에 새 스택을 띄우므로, 그 사이 앱 컨테이너가 **6개** 존재한다.

```
현재:  prod_nerd_back        3개 × (limits 640M / reservations 192M)
전환중: + prod_nerd_back_app  3개 × (limits 640M / reservations 192M)
       → reservations 합계 1,152M (앱만)
```

`reservations` 합계가 노드 가용 메모리를 넘으면 새 태스크가 **스케줄되지 않고** `no suitable node` 로 멈춘다.

### 실측 (2026-09-01)

| 항목 | 값 |
|---|---|
| 노드 메모리 | total 11Gi · used 2.9Gi · **available 8.7Gi** |
| 스왑 | 8.0Gi (사용 4.4Mi) |
| 스택 | 7개 (`infra` · `monitor_shared` · `prod_monitor` · `prod_nerd` · `prod_nerd_cache` · `prod_nest` · `prod_next`) |

전환 중 **추가로** 필요한 예약은 576M (앱 3 × 192M) 이고 available 8.7Gi 에 여유가 충분하다 → **A안 확정.**

프론트까지 최종 배치했을 때의 우리 프로젝트 몫:

```
백엔드 앱  3 × 192M = 576M      (limits 최악 1,920M)
프론트     3 × 192M = 576M      (limits 최악 1,920M)
Redis      1 ×  64M =  64M      (limits 최악   192M)
                     ────────
     reservations 1,216M · limits 최악 4,032M
```

⚠️ 우리 것을 뺀 **나머지 5개 스택(11개 서비스)** 의 예약량은 확인하지 않았다. `limits` 최악값이 동시에 전부 찍히는 상황은 정상 트래픽에서 오지 않지만, **프론트 배포 후 `docker stats` 로 실사용을 재고** limits 를 조정한다.

---

## 전환 절차

### 전제

- 저장소 수정 → `main` 푸시가 곧 배포다. 순서를 어기면 중간 상태가 상용에 나간다
- Caddy 는 블록 단위로 독립적이고, `caddy validate` 가 실패하면 기존 설정을 유지한다

### ⚠️ 프론트보다 **먼저** 한다

프론트는 전용 도메인을 쓰고 그 도메인 블록 안에 `/api/v2/*` → 백엔드 프록시를 함께 둔다. 그 업스트림 이름이 곧 여기서 정해지는 이름이다.

- **재명명을 먼저 하면** 프론트 Caddy 블록을 처음부터 `prod_nerd_back_app` 으로 쓴다 (한 번에 끝)
- **나중에 하면** 프론트 블록까지 같이 고쳐야 하고, 고칠 곳을 하나 빠뜨리면 프론트에서만 API 가 죽는다

→ **재명명 → 프론트 구축 순서를 지킨다.**

### A안 — replicas 3 으로 바로 (메모리 여유가 있을 때)

1. **[AI]** `infra/docker-stack.app.yml` 을 새 이름으로 수정 (스택 주석 · 서비스 키 `back` → `app`)
2. **[AI]** `deploy.yml` 수정 — 스택명 `prod_nerd` → `prod_nerd_back`, **스모크 필터 `prod_nerd_back_app`**, `docker service ps`/`logs` 대상명
3. **[AI]** 문서 갱신 (`deploy.md` · `tasks-backend-skeleton.md`), `lessons.md` 에는 한 줄 덧붙임만
4. **[사용자]** 서버에서 env 파일을 **복사**한다. `ENV_FILE_PATH` 시크릿 값이 현재 경로다

   ```bash
   cd "$(dirname <ENV_FILE_PATH>)"
   cp nerd.prod.env nerd-back.prod.env      # ⚠️ mv 가 아니다
   ls -l nerd*.env
   ```

   그다음 GitHub Environment `PROD` 의 `ENV_FILE_PATH` 를 새 파일 경로로 갱신한다.

   🚫 **`mv` 를 쓰지 않는다.** 옛 스택 `prod_nerd` 의 서비스 정의는 여전히 옛 경로를 가리킨다. 파일을 옮겨버리면 **롤백하려고 옛 스택을 재배포할 때 `env_file not found` 로 실패**한다. 옛 파일은 11번에서 지운다.

5. **[사용자]** `main` 푸시 → 새 스택 `prod_nerd_back` 이 뜬다. **옛 스택은 아직 살아 있다**
6. **[사용자]** `docker ps --filter "name=prod_nerd_back_app"` 3개가 `(healthy)` 인지 확인
7. **[사용자]** Caddy 업스트림을 `prod_nerd_back_app:5501` 로 변경 → `caddy validate` → `caddy reload`
   - ⚠️ **기존 도메인의 `/api/v2/*` 블록**을 고치는 것이다. 프론트 전용 도메인 블록 신설은 별건이며 `tasks-frontend-cicd.md` 가 소유한다
8. **[사용자]** 도메인으로 헬스체크 200 확인
9. **[사용자]** 옛 스택 제거 — **제거 전에 옛 이미지 태그를 기록한다** (롤백 시 필요)

   ```bash
   docker service inspect prod_nerd_back \
     --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'   # 태그를 메모
   docker stack rm prod_nerd
   ```

10. **[사용자]** 확인

    ```bash
    docker stack ls                                              # prod_nerd 없어야 함
    docker ps --filter "name=prod_nerd_back" --format '{{.Names}}'
    #   prod_nerd_back_app.N 3줄만 남아야 한다
    ```

11. **[사용자]** 안정화(며칠) 후 정리 — **지우지 말고 이름을 바꿔 격리한다.** 되돌리기 쉽고, 남아 있어도 아무 동작에 관여하지 않는다

    ```bash
    ls -la <옛 stack 디렉터리>          # 내용을 먼저 눈으로 확인
    mv <옛 stack 디렉터리> <부모>/_deprecated_nerd_20260901
    mv <env 디렉터리>/nerd.prod.env <env 디렉터리>/_deprecated_nerd.prod.env
    ```

    한 달 뒤에도 문제가 없으면 그때 완전히 삭제한다.

### 롤백이 필요해지면 (절차 9 이후)

옛 스택은 사라졌지만 **이미지 태그가 불변**이라 재생성할 수 있다. 옛 YAML 과 env 파일을 절차 11까지 남겨두는 이유가 이것이다.

```bash
cd <옛 stack 디렉터리>
REGISTRY_URL=… IMAGE_TAG=<메모한 옛 태그> OVERLAY_NETWORK=… ENV_FILE_PATH=… \
  docker stack deploy -c docker-stack.app.yml prod_nerd
# 그다음 Caddy 업스트림을 prod_nerd_back:5501 로 되돌린다
```

더 간단한 방법은 **새 스택에서 이미지만 되돌리는 것**이다. 이름 구조를 유지한 채 코드만 옛 버전으로 간다.

```bash
docker service update --rollback prod_nerd_back_app
```

### B안 — replicas 1 로 검증 후 확대 (참고 — 이번에는 쓰지 않는다)

메모리가 빠듯할 때의 대안이다. A안 1번에서 `replicas: 1` 로 두고 5~8 을 수행한 뒤, 9번 이후 `replicas: 3` 으로 되돌려 다시 배포한다. 전환 중 최대 컨테이너가 4개로 줄지만 배포가 두 번이고 1 레플리카 구간에는 무중단 보장이 없다.
**2026-09-01 실측으로 메모리 여유가 확인되어 A안을 쓴다.**

### 다운타임

7번 Caddy reload 순간에만 업스트림이 바뀐다. 새 서비스가 이미 healthy 3/3 이므로 **끊김은 없어야 한다.**

**이번 전환은 다운타임이 허용된다** (2026-09-01 사용자 확인). 따라서 `deploy.md` 의 폴링 실측은 **필수가 아니다** — 절차 자체는 무중단 구성 그대로 두되, 검증 압박 없이 진행한다. 폴링을 돌린다면 "무중단이 실제로 되는지"를 이 기회에 한 번 재는 목적이다.

⚠️ 그래도 **9번(옛 스택 제거)은 8번 확인 후에만** 한다. 다운타임 허용과 롤백 경로 상실은 다른 문제다.

---

## 롤백

전환 실패 시 옛 스택이 아직 살아 있다면 (9번 이전):

```bash
# Caddy 업스트림을 prod_nerd_back:5501 로 되돌린다
caddy validate --config <경로> && caddy reload --config <경로>

# 새 스택 제거
docker stack rm prod_nerd_back
```

옛 env 파일을 `cp` 로 남겨뒀으므로 옛 스택 재배포도 가능하다 (`ENV_FILE_PATH` 시크릿만 되돌린다).

**9번 이후**라면 옛 스택이 없다. 되돌리려면 저장소를 `git revert` 하고 `ENV_FILE_PATH` 를 옛 경로로 되돌린 뒤 다시 배포해야 한다 — 몇 분이 걸리고 그동안 서비스가 내려간다. **9번을 실행하기 전에 8번을 반드시 확인한다.**

**11번 이후**(옛 env 파일 제거)라면 파일을 다시 만들어야 한다. 그래서 11번은 안정화가 확인된 뒤에 한다.

---

## 노드 라벨

현재 `<노드명>` (2026-09-01 확인):

```
infra_caddy=1  infra_redis=1  prod_nerd_back=1  prod_nerd_redis=1  prod_nest=1  prod_next=1
```

앱 라벨 `prod_nerd_back=1` 은 **그대로 쓴다** — 재명명 후 스택 이름과 일치하게 된다.
프론트용만 추가한다.

```bash
# 추가
docker node update --label-add prod_nerd_front=1 <노드명>

# 확인
docker node inspect --pretty <노드명> | sed -n '/Labels/,/^[A-Z]/p'
```

- 라벨은 **매니저 노드에서** 실행한다
- 라벨 추가는 이미 떠 있는 서비스를 재배치하지 않는다. 새 배포부터 적용된다
- 되돌리려면 `docker node update --label-rm prod_nerd_front <노드명>`

⚠️ `infra_redis` 는 **공유** Redis 를 뜻한다. 우리 전용 Redis 에 붙이면 의미가 어긋나므로 쓰지 않는다.

---

## 실행 체크리스트

### 저장소 (AI 작업, 한 커밋)

- [ ] `infra/docker-stack.app.yml` — 서비스 키 `back` → `app`, 주석의 스택·DNS 이름
- [ ] `.github/workflows/deploy.yml` — 스택명, **스모크 필터**, `service ps`/`logs` 대상
- [ ] `infra/docker-stack.redis.yml` — **Redis 가 이름 규칙의 예외라는 주석 추가** (이름 자체는 무변경)
- [ ] `docs/deploy.md` — 구성표·상태 확인 명령·Caddy 예시·롤백 명령 + 이름 규칙표에 Redis 예외 명시
- [ ] `docs/tasks/tasks-backend-skeleton.md` — 이름 규칙표·결정 요약
- [ ] `docs/lessons.md` — 해당 항목에 "2026-09-01 재명명" 한 줄 덧붙임 (**본문 수정 금지**)
- [ ] `pnpm ci:core` 통과 확인 (문서·YAML 변경이라 영향은 없어야 하지만 확인한다)

🚫 **`CLAUDE.md` 는 건드리지 않는다** (2026-09-01 사용자 결정). 라우팅 표 등재와 경고 병기를 하지 않으므로, 이 문서를 열어야 한다는 신호가 `CLAUDE.md` 에는 없다 — **작업자가 이 파일의 존재를 알고 있어야 한다.**

### 서버 (사용자 실행)

- [x] `free -h` 로 가용 메모리 실측 → **A안 확정** (2026-09-01: available 8.7Gi)
- [x] `cp nerd.prod.env nerd-back.prod.env` (2026-09-01 — 113B·권한 600 보존, 원본 유지 확인)
- [x] `ENV_FILE_PATH` 갱신 (2026-09-01)
- [x] `DEPLOY_STACK_DIR` 저장소별 분리 + 서버 디렉터리 생성 (2026-09-01, 백엔드·프론트 양쪽)
- [ ] `docker node update --label-add prod_nerd_front=1 <노드명>` — **프론트 작업 때 하면 된다.** 이번 재명명에는 불필요
- [x] 전환 절차 5~10 수행 (2026-09-01) — 옛 스택 제거까지 완료
- [ ] 안정화 후 정리 (절차 11) — 옛 env 파일 + **옛 stack 디렉터리 `.../infra/nerd/prod/`**
- [x] Redis 워크플로 확인 (2026-09-01) — YAML 이 새 경로로 이동, **서비스는 5일 전 그대로 Running** (스펙 무변경이라 재시작 없음). 두 워크플로가 1분 차로 병렬 실행됨

### 전환 실측 (2026-09-01)

| 확인 | 결과 |
|---|---|
| `docker ps` 헬스 | **3/3 `Up (healthy)`** |
| `docker service ps` | Running 3개, **ERROR 열 비어 있음** — 재시도 없이 한 번에 수렴 |
| readiness (컨테이너 내부) | `200 {"status":"ok","redis":{"status":"up"}}` — **새 스택에서도 overlay DNS 해석 성공** |
| 도메인 경유 liveness | **200** — Caddy 전환 확정 |
| 이미지 digest | 신·구 **완전히 동일** (`sha256:523b52c6…`) |
| 옛 스택 제거 후 | `label=com.docker.stack.namespace=prod_nerd` → **0줄**, `=prod_nerd_back` → **3줄 healthy** |

**digest 동일이 이번 전환의 핵심 증거다.** 태그는 달라도 이미지 바이트가 같으므로 재명명이 애플리케이션 코드에 아무 영향을 주지 않았음이 증명된다. 재명명 커밋에 코드가 섞이지 않았다는 뜻이기도 하다.

⚠️ 발견: 주입된 Env 에 **`EDGE_THROTTLE_ENABLED` 가 없다.** `env.validation.ts` 의 기본값 `'false'` 로 채워져 기동·동작에 문제는 없지만, **켜려면 서버 env 파일에 키를 추가**해야 한다.

### 완료 후

- [ ] 결과를 `docs/deploy.md` 에 반영
- [ ] 이 문서를 `docs/tasks/archive/` 로 이동
- [ ] `grep -rn "prod_nerd"` 재실행 — 구 이름 잔존 0건 확인
- [ ] 배운 것이 있으면 `docs/lessons.md` 에 4필드로 append

### lessons 승격 완료 (2026-09-01)

두 건을 [`../lessons.md`](../lessons.md) 에 4필드로 등재했다.

- **`docker ps` 의 `name` 필터는 부분 문자열 매칭이다** — 전환 중 실제로 6줄(신 3 + 구 3)을 반환하는 것을 확인했다. 예방 규칙은 `label=com.docker.stack.namespace=<스택명>`.
- **프로그램으로 세도 세는 방법이 틀리면 같은 결과다** — 파일별 합계 55 vs 총계 54 의 1 차이가 누락 신호였다.

### 후속 개선 (별건)

- [ ] **`deploy.yml` 스모크 테스트를 라벨 필터로 전환** — 지금은 `--filter "name=prod_nerd_back_app"` 이라 옛 스택이 사라진 현재는 문제없지만, 유사 이름 스택이 생기면 같은 함정이 재현된다. `--filter "label=com.docker.stack.namespace=prod_nerd_back"` 이 정확 일치라 견고하다. 프론트 워크플로를 만들 때 **처음부터 라벨 방식**으로 쓰고, 백엔드도 같은 커밋에서 맞춘다

---

## 위험도 요약

| 위험 | 정도 | 완화 |
|---|---|---|
| 스모크 필터가 옛 컨테이너를 집어 위양성 | **높음** | 필터를 `prod_nerd_back_app` 으로. 전환 커밋에 포함 |
| 전환 중 메모리 부족 → 스케줄 실패 | **해소됨** | 2026-09-01 실측 available 8.7Gi 로 여유 확인 |
| Caddy 전환 순간 끊김 | 낮음 (다운타임 허용됨) | 새 서비스 healthy 3/3 확인 후 reload |
| 옛 스택을 너무 일찍 제거 | 중간 | 절차 8번(도메인 200 확인) 전에는 9번 금지 |
| Redis 재명명 시 볼륨 초기화 | **높음** | **Redis 는 재명명하지 않는다** |
| 문서 잔존으로 이름이 두 벌 공존 | 낮음 | 정책 변경 커밋에서 `grep -rn "prod_nerd"` 전수 확인 |
