# Task Tracker: MySQL 자체 호스팅 (Swarm 스택)

> 상태: **완료 (2026-09-02) — DB 스택 배포 · 앱 연결 · 터널 접속까지 전부 실측.** 후속: 백업(D3) · 첫 엔티티(+첫 마이그레이션).
> 경계: 배포 구성의 정본은 [`docs/deploy.md`](../deploy.md), 코드 규약은 [`.claude/rules/code-patterns.md`](../../.claude/rules/code-patterns.md).
> 이 문서는 **DB 도입 결정의 근거와 진행 상황**을 소유한다. 확정된 사실은 배포 후 `deploy.md` 로 승격한다.
> 🚫 실제 노드명·마운트 경로·네트워크 이름을 이 문서에 적지 않는다. 전부 라벨과 시크릿으로 참조한다.

---

## 왜 방향을 바꾸나

[`tasks-backend-skeleton.md`](tasks-backend-skeleton.md) 「미결정」 표는 **"관리형 RDBMS 중 선택 · A1 자체 호스팅은 제외"** 였다.
2026-09-02 이 결정을 **뒤집는다** — 같은 Swarm 에 MySQL 을 올린다.

| 관리형을 전제로 세웠던 제약 | 자체 호스팅에서 어떻게 되나 |
|---|---|
| 동시 세션 한도가 빡빡함 (주의 사항 #2) — 풀 × 레플리카 3 계산이 장애의 현실적 경로 | **우리가 `max_connections` 를 정한다.** 제약이 메모리 예산으로 바뀐다 |
| 전 환경이 동일 DB → 테스트가 DB 에 접속하지 않음 (code-patterns §9) | **그대로 유지.** 인스턴스 1대를 전 환경이 공유하기로 확정했다 (D1) |
| 마이그레이션 실행 금지 (CLAUDE.md Never) — 모든 실행이 곧 상용 적용 | **그대로 유지.** 재검토 조건(환경별 DB 분리)이 발생하지 않았다 |
| DB 장애가 곧 외부 장애 | 같은 노드에 있으므로 **노드 장애 = 앱·Redis·DB 동시 상실**. 가용성은 오히려 내려간다 |

**얻는 것**: 세션 한도·비용 제약 해소, 네트워크 홉 제거, 환경 분리 가능성.
**잃는 것**: 백업·복구·업그레이드·모니터링이 전부 **우리 책임**이 된다. 아래 「현업 수준 설정」이 그 목록이다.

---

## 확정된 요구사항 (사용자 지시, 2026-09-02)

| 항목 | 값 |
|---|---|
| 레플리카 | **1** (named volume 단독 점유) |
| 배치 | **특정 노드 1대로 못박음** — 노드명이 아니라 **라벨**로 건다 (Redis 와 동일 방식) |
| 한국어 | utf8mb4 + 한글 정렬·이모지 저장 가능 |
| 영속성 | **블록 스토리지 위**에 데이터 디렉터리를 둔다. 부트 디스크에 쓰지 않는다 |
| 하드웨어 | OCI Ampere A1 · 12GB RAM · 2 OCPU · 블록 볼륨 58GB (`linux/arm64`) |

**블록 스토리지 연결은 가능하다.** 방식은 아래 「볼륨 설계」 참조.

---

## 확정된 결정 (2026-09-02)

| ID | 결정 | 이 결정이 강제하는 것 |
|---|---|---|
| **D1** | **인스턴스 1대를 전 환경이 공유** | 기존 규약 **전부 유지**. ↓ 「D1 이 유지시키는 규약」 |
| **D2** | **앱 TypeORM 연결까지 이번 태스크** | Step 1~5(스택) → Step 6~9(앱). 슬라이스는 나누되 한 태스크로 관리 |
| **D3** | **백업은 후속 태스크로 분리** | ⚠️ 그때까지 **데이터 유실에 대한 방어가 없다.** 「후속」 게이트로 보고 |
| **D4** | **MySQL 8.4 LTS** (`mysql:8.4`) | arm64 이미지 확인은 Step 3 에서. `mysql_native_password` 는 제거됐으나 mysql2 가 `caching_sha2_password` 를 지원하므로 영향 없음 |
| **D5** | **계정 3개 분리** — `root` / `nerd_app`(DML) / `nerd_migrator`(DDL) | `MYSQL_USER` 미사용. `infra/mysql/init-users.sh` 가 첫 초기화 때 생성 |
| **D6** | **앱은 서버 `.env` 의 `DB_PASSWORD`** 로 받는다 | 앱 비밀번호가 secret 과 `.env` 두 곳에 존재. 회전 시 둘을 한 작업으로 |
| **D7** | 이름 — DB `nerd` · 계정 `nerd_app` `nerd_migrator` | |
| **D8** | **DB 연결 실패 시 앱은 부팅 실패를 허용 + Swarm 이 포기하지 않게** (`restart_policy` 무제한) | Step 8 에서 앱 스택 `max_attempts` 제거 · `delay: 10s`. TypeORM `retryAttempts × retryDelay` 는 healthcheck 종료 시한(`start_period 30s + 15s × 3`) 안쪽. 근거 ↓ 「앱 배선 규약」 |
| **D9** | **외부 DB 접속 = SSH 터널, 포트 publish 없음** — `scripts/db-tunnel.sh` (기본 SSH 별칭 `fs-01`, 사용자 결정 2026-09-02. 주소는 `~/.ssh/config` 에만)  ⚠️ **2026-09-02 실측에서 걸림**: 컨테이너 inspect 의 Networks 에 `docker_gwbridge` 가 없어 IP 가 `<no value>` 로 나왔고, 스크립트가 검증 없이 통과시켰다(수정: IP 형식 검증 · `ExitOnForwardFailure` · 로컬 포트 선점 검사 · gwbridge 네트워크 쪽 역조회). 노트북에 로컬 MySQL 이 3306 을 점유 → 로컬 포트 3307 사용. **gwbridge 부착 확인(서버 실측)**: 컨테이너는 gwbridge 에 있으나 `docker inspect <컨테이너>` Networks 에는 overlay 만 보이고 `docker network inspect docker_gwbridge` 쪽에만 등재된다 → 스크립트가 네트워크 쪽 역조회로 IP 를 얻는다. **노트북 접속 실측 ✅** (mysql CLI 로그인 · 변수 확인) | Swarm 은 publish 를 127.0.0.1 로 못 묶는다(항상 0.0.0.0) → 노출 여부가 VCN 보안 목록 하나에 달림. 대신 컨테이너의 `docker_gwbridge` IP(호스트 로컬)로 터널. **배포 후 실측 전까지 미검증** |
| **D10** | **DB 재배포에 무중단을 기대하지 않는다** | 인스턴스 1개 · stop-first. 재시작 10~30초 동안 DB 요청 실패를 수용 |

### D1 이 유지시키는 규약 — 완화되지 않았다

자체 호스팅으로 바뀌었어도 **DB 인스턴스가 하나**라는 사실은 그대로다. CLAUDE.md 「근거의 유효기간」이 말한 재검토 조건(*환경별 DB 분리*)이 **발생하지 않았다.**

| 규약 | 상태 |
|---|---|
| 🚫 AI 는 마이그레이션을 **실행하지 않는다** (파일 작성까지) | **유지** — 모든 실행이 곧 상용 적용 |
| 🚫 테스트가 DB 에 접속하지 않는다 (code-patterns §9) | **유지** — `test/setup/forbid-db.ts` 가드를 이번에 만든다 |
| 앱 계정에 DDL 권한 없음 | **강화** — 관례를 권한으로 못박는다 |

⚠️ **로컬 개발에서 서버 DB 에 붙는 경로가 필요하다.** 호스트 포트를 publish 하지 않으므로 (`deploy.md`) 직접 접속이 안 된다. **SSH 터널**로만 붙는다 — publish 로 뚫으면 도메인을 우회한 DB 직접 노출이 생긴다. 접속 정보는 `.env` 에만 두고 저장소에 넣지 않는다.

## 설계

### 이름 규칙

`deploy.md` 「환경 추가 시」 표를 따른다 — **스택 이름 = 노드 라벨 키**.

| 대상 | 값 |
|---|---|
| 스택 | `prod_nerd_db` |
| 서비스 키 | `mysql` |
| 서비스 DNS | **`prod_nerd_db_mysql`** ← 앱의 `DB_HOST` 가 받는 값 |
| 노드 라벨 | `prod_nerd_db=1` |
| named volume | `prod_nerd_db_mysql-data` (Swarm 이 스택명을 prefix 로 붙인다) |
| 워크플로 | `.github/workflows/deploy-db.yml` (paths: `infra/docker-stack.db.yml` + 자신) |

⚠️ **Redis 의 예외(`prod_nerd_cache` / 라벨 `prod_nerd_redis`)를 반복하지 않는다.** 지금 맞춰두면 나중에 못 바꾼다 — 볼륨 이름이 스택 이름을 물기 때문이다 (Redis 가 정확히 그 이유로 고정되어 있다).

⚠️ **노드명을 YAML 에 쓰지 않는다.** `node.hostname == ...` 는 인프라 식별 정보를 저장소에 커밋하는 것이다. 라벨로 건다:

```yaml
placement:
  constraints:
    - node.labels.prod_nerd_db == 1
```

라벨 부여는 배포 **전에** 매니저에서 1회 (`docker node update --label-add prod_nerd_db=1 <노드>`).
🚫 라벨 없이 배포하면 태스크가 `no suitable node` 로 **pending 에 걸린 채 배포가 성공으로 보인다.**

### 볼륨 설계 — 블록 스토리지에 못박기

```yaml
volumes:
  mysql-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${MYSQL_DATA_DIR}     # 블록 볼륨 마운트 지점 하위. 값은 GitHub Environment 시크릿
```

**순수 bind mount(`- /경로:/var/lib/mysql`)를 쓰지 않는 이유가 이것 하나다.**
bind mount 는 경로가 없으면 **Docker 가 디렉터리를 만들어버린다.** 블록 볼륨이 어떤 이유로 마운트되지 않은 채 부팅되면, MySQL 이 **부트 디스크에 새 데이터 디렉터리를 조용히 만들고 정상 기동한다.** 며칠 뒤 볼륨을 다시 붙이면 그 사이 데이터가 사라진 것처럼 보인다.
`type: none, o: bind` 는 device 경로가 없으면 **마운트 자체가 실패**한다 — 조용한 성공보다 시끄러운 실패가 낫다.

추가 방어: 데이터 디렉터리를 마운트 지점 **바로 그 자리가 아니라 하위 디렉터리**(`<마운트>/mysql/data`)로 둔다. 블록 볼륨이 안 붙으면 부트 디스크에는 그 하위 경로가 존재하지 않아 확실히 실패한다.

**사전 준비 (매니저에서 1회, 사람이 실행)**

🚫 아래 `$MOUNT` 의 실제 값은 이 문서에 적지 않는다 (서버 경로 = 인프라 식별 정보). GitHub 시크릿 `MYSQL_DATA_DIR` 에는 `$MOUNT/mysql/data` 를 넣는다.

```bash
MOUNT=<블록 볼륨 마운트 지점>

# 1. 마운트 확인 · 파일시스템 · 재부팅 영속(fstab) 확인
findmnt "$MOUNT" -o SOURCE,FSTYPE,OPTIONS
grep -E "$MOUNT|$(findmnt -no UUID "$MOUNT")" /etc/fstab   # 비어 있으면 재부팅 시 안 붙는다
# 2. fstab 미등록이면 UUID 로 등록. 장치명(/dev/sdb)은 재부팅 시 바뀔 수 있어 쓰지 않는다
#    _netdev,nofail: OCI 권고. nofail 이 없으면 볼륨 부재 시 부팅이 emergency 모드에서 멈춘다
#    nofail 이어도 안전한 이유: 볼륨이 없으면 $MOUNT/mysql/data 가 없어 MySQL 이 시끄럽게 실패한다
#    → 부트 디스크에 조용히 쓰는 사고가 구조적으로 막힌다
# 3. 데이터 디렉터리 생성 + 소유권 (공식 이미지의 mysql uid/gid = 999)
sudo mkdir -p "$MOUNT/mysql/data" && sudo chown -R 999:999 "$MOUNT/mysql"
```

**Step 1 실측 (2026-09-02)**: ext4 · 58GB · 사용량 36K(빈 볼륨) · 마운트 ✅ · **fstab UUID 등록 + `_netdev,nofail` ✅** (장치명 grep 이 비었던 것은 UUID 로 등록돼 있었기 때문). 디렉터리·소유권·노드 라벨은 대기.

### 시크릿 — 비밀번호를 env 로 넣지 않는다

공식 이미지는 `MYSQL_ROOT_PASSWORD_FILE` · `MYSQL_PASSWORD_FILE` 을 지원한다. Swarm secret 으로 주입하면 **`docker service inspect` 와 프로세스 환경에 평문이 남지 않는다.**

| 계정 | 권한 | 용도 |
|---|---|---|
| `root` | ALL | 운영·복구 전용. 앱이 쓰지 않는다 |
| 앱 계정 | 대상 스키마에 `SELECT INSERT UPDATE DELETE` | 런타임. **DDL 권한 없음** |
| 마이그레이션 계정 | 대상 스키마에 DDL 포함 | 사람이 마이그레이션 실행할 때만 |

앱 계정에서 DDL 을 빼는 이유: CLAUDE.md 의 「마이그레이션 실행은 사람이」를 **관례가 아니라 권한으로** 강제한다.

| Swarm secret 이름 | 용도 |
|---|---|
| `prod_nerd_db_root_pw` | root. MySQL 컨테이너만 읽는다 |
| `prod_nerd_db_app_pw` | `nerd_app` |
| `prod_nerd_db_migrator_pw` | `nerd_migrator` |

⚠️ Swarm secret 은 **Swarm 전체에서 이름이 유일**해야 한다 — 다른 프로젝트와 겹치지 않게 스택 이름을 접두어로 쓴다. 스택 YAML 에서는 `external: true` 로 참조만 한다 (생성은 사람이 1회).
⚠️ **Swarm secret 은 값을 다시 읽어낼 수 없다.** 생성 전에 비밀번호 관리자에 먼저 보관한다. 잃으면 secret 을 지우고 새로 만든 뒤 MySQL 쪽 비밀번호도 `ALTER USER` 로 바꿔야 한다.

**계정 생성 방식**: `MYSQL_USER` 환경변수는 대상 DB 에 `ALL` 을 준다 — DDL 분리가 불가능하다. 대신 `/docker-entrypoint-initdb.d/` 에 `.sh` 스크립트를 `configs:` 로 넣어 `/run/secrets/*` 를 읽어 두 계정을 만든다.
⚠️ **initdb 스크립트는 데이터 디렉터리가 비어 있을 때 딱 1회만 실행된다.** 첫 배포 뒤 스크립트를 고쳐도 다시 돌지 않는다. 계정 변경은 이후로는 SQL 로 직접 한다.

**앱 쪽 전달**: 앱은 기존 패턴대로 서버 `.env` 의 `DB_PASSWORD` 로 받는다 (Redis 와 동일). 즉 **앱 비밀번호는 secret 과 `.env` 두 곳에 있다.** 한 곳만 바꾸면 앱이 접속을 못 한다 — 바꿀 때는 둘을 같은 작업으로 취급한다. `_FILE` 방식으로 앱까지 통일하는 것은 후속.

### 설정 전달 — `command:` 플래그, `configs:` 아님

`my.cnf` 를 `configs:` 로 넣지 않는다. **`docker stack deploy` 는 config 내용이 바뀌어도 교체하지 않는다** — 같은 이름의 config 가 있으면 옛 내용을 그대로 쓰거나 배포가 실패한다. 이름을 매번 바꾸는 운영 부담이 생긴다. `command: ["mysqld", "--character-set-server=utf8mb4", ...]` 로 YAML 안에 두면 diff 에 그대로 보이고 재배포로 반영된다. (initdb `.sh` 만 `configs:` 를 쓴다 — 1회 실행이라 교체 문제가 없다.)

## 현업 수준 MySQL 설정 — 무엇을 켜고 왜 켜는가

> 관리형에서는 벤더가 대신 해주던 것들이다. 자체 호스팅으로 오면서 우리 몫이 된 목록.

### 1. 문자셋·정렬 (한국어)

| 설정 | 값 | 이유 |
|---|---|---|
| `character-set-server` | `utf8mb4` | `utf8`(=utf8mb3)은 3바이트라 **이모지에서 깨진다**. 한글 자체는 3바이트지만 사용자 입력에 이모지가 안 섞인다는 보장이 없다 |
| `collation-server` | `utf8mb4_0900_ai_ci` | 유니코드 9.0 기반. 한글 정렬이 사전순으로 맞고 대소문자·악센트 무시(ai_ci) |

⚠️ `skip-character-set-client-handshake` **를 쓰지 않는다.** 클라이언트가 선언한 문자셋을 서버가 덮어쓰는 옵션이라, 드라이버 설정과 실제 인코딩이 어긋나도 조용히 넘어간다.
⚠️ `utf8mb4_ko_0900_as_cs` 는 한국어 전용처럼 보이지만 **악센트·대소문자를 구분(as_cs)** 한다. 로그인 아이디 비교 등에서 예상 밖 동작을 하므로 일반 용도에는 쓰지 않는다.

### 2. 타임존 — 기존 UTC 정책과 맞춘다

code-patterns §10 이 이미 **UTC 저장 · 표시 시점 변환**으로 확정돼 있다. DB 쪽 적용분:

| 레이어 | 값 | 함정 |
|---|---|---|
| 서버 | `default-time-zone='+00:00'` | 공식 이미지에는 **tz 테이블이 로드돼 있지 않다.** `'Asia/Seoul'` 같은 이름을 쓰면 기동 실패한다 — 오프셋 표기만 쓴다 |
| 컬럼 | `DATETIME(3)` | 🚫 **`TIMESTAMP` 를 쓰지 않는다.** 세션 TZ 기준으로 저장·조회 시 자동 변환되어 환경마다 값이 달라진다 |
| 드라이버 | mysql2 `timezone: 'Z'` | 안 주면 Node 프로세스의 로컬 TZ 로 해석한다 |

한국 시간대 표시는 **앱의 `dateKeyInTimeZone(date, KST)`** 가 담당한다. DB 를 KST 로 돌리지 않는다.

### 3. InnoDB · 메모리 예산 (12GB / 2 OCPU)

| 설정 | 제안값 | 이유 |
|---|---|---|
| `innodb_buffer_pool_size` | **1G** | 실데이터가 거의 없다. 관례인 "RAM 의 70%" 는 **DB 전용 서버 기준**이고, 여기는 앱 3레플리카 + Redis + Caddy 와 12GB 를 나눠 쓴다 |
| `innodb_flush_log_at_trx_commit` | **1** | 커밋마다 fsync. 크래시에도 커밋된 트랜잭션이 살아남는다. 2 는 빠르지만 OS 크래시 시 최대 1초를 잃는다 |
| `innodb_flush_method` | `O_DIRECT` | OS 페이지 캐시 이중 버퍼링 회피 |
| `innodb_redo_log_capacity` | 256M | 기본 100M. 쓰기 스파이크에서 체크포인트 스톨을 줄인다 |
| 컨테이너 `limits.memory` | **2G** | buffer pool 외 커넥션 버퍼·스레드 몫. limit 이 없으면 OOM 시 **커널이 무엇을 죽일지 우리가 통제하지 못한다** |

⚠️ 컨테이너 메모리 limit 을 buffer pool 과 **같게 잡지 않는다.** MySQL 은 buffer pool 밖에서도 상당량을 쓴다 — 같게 잡으면 OOMKill 로 반복 재시작한다.

### 4. 커넥션

| 설정 | 제안값 | 이유 |
|---|---|---|
| `max_connections` | 100 | 앱 풀 × 레플리카 3 + 마이그레이션·운영 여유. 관리형 무료 티어와 달리 **우리가 정한다** |
| 앱 풀 크기 | 10 | 10 × 3 = 30. 2 OCPU 에서 동시 실행 가능한 쿼리는 어차피 소수다 — 풀을 키워도 대기열이 DB 안으로 옮겨갈 뿐이다 |
| `wait_timeout` / `interactive_timeout` | 600 | 기본 28800s(8시간). 죽은 커넥션이 8시간 자리를 차지한다 |
| `max_allowed_packet` | 64M | 기본 64M(8.0+). LLM 응답 저장 시 부족하면 상향 |

⚠️ `wait_timeout` 은 **앱 풀의 idle timeout 보다 길어야 한다.** 반대면 DB 가 먼저 끊은 커넥션을 앱이 살아있다고 믿고 꺼내 쓰다 `ECONNRESET` 을 맞는다.

### 5. 내구성·복구 (자체 호스팅에서 새로 생기는 책임)

| 항목 | 값 | 비고 |
|---|---|---|
| `log_bin` | ON (8.0+ 기본) | 특정 시점 복구(PITR)의 전제. 이게 없으면 **마지막 백업 이후는 전부 소실**이다 |
| `binlog_expire_logs_seconds` | 604800 (7일) | 58GB 디스크. 무한 보존하면 디스크가 찬다 |
| `binlog_row_image` | `MINIMAL` | binlog 크기 절감 |
| `sync_binlog` | 1 | binlog 도 커밋마다 fsync. 0/N 이면 크래시 시 binlog 와 InnoDB 가 어긋난다 |
| 논리 백업 | 🚧 D3 | `mysqldump --single-transaction --routines --triggers` 일 1회 |
| 복구 리허설 | **필수** | 🚫 **복구해 본 적 없는 백업은 백업이 아니다.** 빈 컨테이너에 덤프를 넣어 기동되는지 1회 확인한다 |

### 6. 로깅 — 이 프로젝트에서 특히 주의

🚫 **`general_log` 를 켜지 않는다.** 모든 쿼리가 stdout 으로 나가고, **로그 수집 에이전트가 global 모드로 전 컨테이너를 자동 발견**한다 (`deploy.md` 관측성). 공유 로그 스택의 인제스트 한도를 순식간에 먹는다 — CLAUDE.md 의 Never 항목에 정확히 걸린다.

| 항목 | 값 |
|---|---|
| `slow_query_log` | ON · `long_query_time=1` |
| slow log 출력 | **파일** (`slow_query_log_file`), stdout 아님 |
| error log | stdout (기본) — 양이 적다 |
| `log_error_verbosity` | 2 (기본) |

⚠️ MySQL 은 기동 시 수십 줄을 stdout 에 쏟는다. 재시작 루프에 빠지면 그것만으로 로그가 쌓인다 — healthcheck `start_period` 를 넉넉히 잡는 이유가 이것이기도 하다.

### 7. 안전장치

| 설정 | 값 | 이유 |
|---|---|---|
| `sql_mode` | **기본값 유지** | `STRICT_TRANS_TABLES` · `ONLY_FULL_GROUP_BY` 포함. 느슨하게 바꾸면 잘린 문자열·잘못된 날짜가 **에러 없이 저장**된다 |
| `innodb_file_per_table` | ON (기본) | 테이블 단위 공간 회수 가능 |
| `lower_case_table_names` | **1** | ⚠️ **데이터 디렉터리 초기화 시점에만 정할 수 있다.** 나중에 바꾸면 기동이 실패하고, 되돌리려면 덤프 후 재초기화뿐이다. 리눅스 기본값 0 은 테이블명 대소문자를 구분해 개발자 노트북(대소문자 무시 FS)과 다르게 동작한다 — **첫 배포 전에 못박는다** |
| 호스트 포트 publish | **없음** | 앱·Redis 와 동일. overlay 내부에서만 닿는다. 외부 접속이 필요하면 SSH 터널 |
| `stop_grace_period` | **120s** | 기본 10s 는 **InnoDB 셧다운에 짧다.** 강제 종료되면 다음 기동이 크래시 복구로 들어가 길어진다 |
| healthcheck | `mysqladmin ping` · `start_period` **120s** | 첫 기동은 데이터 디렉터리 초기화로 오래 걸린다. 짧으면 초기화 중에 unhealthy 판정 → 재시작 루프 |
| `update_config.order` | **stop-first** | Redis 와 같은 이유 — named volume 에 두 컨테이너가 동시에 붙을 수 없다 |

⚠️ `mysqladmin ping` 은 **인증에 실패해도 서버가 살아있으면 성공을 반환한다.** liveness 로는 충분하지만 "접속 가능"의 증거는 아니다. 앱의 readiness 인디케이터가 그쪽을 맡는다.

---

## 시간 설정 점검 (2026-09-02, 저장소 전수)

원칙: **모든 층이 UTC. 한국 시간은 표시 순간에만** (`formatInTimeZone(date, KST)`).

| 층 | 설정 | 위치 | 상태 |
|---|---|---|---|
| 앱 컨테이너 | `ENV TZ=UTC` | `Dockerfile:30` | ✅ |
| **앱 프로세스 (로컬 dev 포함)** | `process.env.TZ = 'UTC'` 를 부팅 최초에 | `src/config/timezone.ts` ← `main.ts` 첫 import | ✅ 2026-09-02 추가. Node 22 런타임 반영 실측(9→0) |
| 앱 로그 | pino `isoTime` (ISO 8601 `Z`) | `src/common/logger/logger.module.ts:43` | ✅ |
| 앱 코드 | 로컬 TZ 메서드 eslint `error` · `date.utils` 헬퍼(`UTC`·`KST`) | `eslint.config.mjs` · `src/common/utils/date.utils.ts` | ✅ |
| 테스트 | `process.env.TZ = 'UTC'` | **`jest.config.js` · `test/jest-e2e.js` 상단** · `setup-tz.ts` 는 검증 가드 | ✅ **2026-09-02 수정** — 기존 setupFiles 방식은 동작하지 않았다(실측 getHours 9). 회귀 가드 추가 |
| MySQL 서버 | `--default-time-zone=+00:00` · `TZ: UTC` · `--log-timestamps=UTC` 명시 | `infra/docker-stack.db.yml` | ✅ |
| MySQL 컬럼 | `DATETIME(3)`, `TIMESTAMP` 금지 (세션 TZ 자동 변환 + 2038 한계) | Step 9 첫 엔티티에서 적용. 규약은 code-patterns §10 에 등재 ✅ | 🚧 |
| 앱 → MySQL 드라이버 | mysql2 `timezone: 'Z'` | Step 8 | 🚧 **로컬 개발(macOS, KST 프로세스)에서 특히 중요** — 없으면 같은 행을 로컬과 운영이 다르게 읽는다 |
| Redis | 시간대 개념 없음 (TTL 은 상대 초) | — | 해당 없음 |
| 호스트 OS | **KST** · NTP 동기 ✅ (`timedatectl` 2026-09-02) | 인스턴스 | ✅ **결정: 유지** — 다른 서비스가 공유. 컨테이너는 각자 UTC 라 영향 없음. 영향 받는 곳 둘: (a) `docker logs --since` 의 오프셋 없는 시각은 KST 로 해석 → `deploy.md` 에 명시 (b) 후속 백업 cron 은 KST 로 돌므로 파일명은 `date -u` 로 |
| Docker 로그 · GitHub Actions | 항상 UTC (설정 불가) | — | ✅ |

## 구현 단계

각 Step 은 implement → verify 1회를 포함한다. **Step 5 까지가 DB 슬라이스, 6 부터가 앱 슬라이스다.**

### 스택 (Step 1~5)

- [x] **Step 1** — 볼륨 마운트·ext4·fstab 영속 · 데이터 디렉터리 `999:999` · 노드 라벨 `prod_nerd_db=1` ✅ (2026-09-02, 사람이 매니저에서 실행·실측)
- [x] **Step 2** — GitHub `PROD` 시크릿 `MYSQL_DATA_DIR` · Swarm secret 3개 (`prod_nerd_db_{root,app,migrator}_pw`) ✅ (2026-09-02). 비밀번호는 사용자 비밀번호 관리자에만 존재
- [x] **Step 3** — `infra/docker-stack.db.yml` + `infra/mysql/init-users.sh` 작성 (2026-09-02). YAML 파싱·`bash -n` 통과. arm64 매니페스트: ↓ 「검증 기록」
- [x] **Step 4** — `.github/workflows/deploy-db.yml` 작성 (2026-09-02). 세 워크플로 paths **교집합 0건** 대조 완료. 사전 점검(라벨·secret·경로) 단계를 추가해 "pending 인데 성공" 을 배포 전에 막는다. `deploy.md` 구성표·독립 배포표 갱신
- [x] **Step 5** — ✅ `Deploy DB` 성공(사전 점검 · `1/1` · 스모크 `utf8mb4 / utf8mb4_0900_ai_ci / +00:00 / 1`) · ✅ 볼륨 실경로 = 블록 볼륨 · ✅ 강제 재기동 후 `ibdata`·`binlog.000001~3` 잔존 · ✅ **D9 터널 접속** (2026-09-02, 노트북 3307 → `172.18.0.11:3306`): `@@time_zone +00:00` · `@@character_set_database utf8mb4` · `CURRENT_USER() nerd_app@%` · `SHOW DATABASES` 에 `mysql` 시스템 DB 가 **안 보임** = 전역 권한 없음(D5 실증)

### 앱 (Step 6~9)

- [x] **Step 6** — `@nestjs/typeorm@^11.0.3` · `typeorm@^0.3.31` · `typeorm-transactional@^0.5.0` · `mysql2@^3.24.3` (2026-09-02). **TypeORM 1.x 를 고르지 않은 이유**: 1.0.0 은 2026-05 출시지만 `typeorm-transactional` 최신이 2023-10 이라 1.x 호환 근거가 없다. 0.3 브랜치는 2026-07 에도 릴리스됐다. `@nestjs/typeorm` 은 Nest 11 짝인 11.x. **arm64**: `mysql2` 는 `gypfile: false`(순수 JS) — 미리 깔지 않았던 이유였던 위험이 없음을 확인
- [x] **Step 7** — 코드: `DbEnvVariables`(CLI 재사용) ⊂ `EnvVariables`, `DB_POOL_SIZE`(기본 10·상한 30), `.env.example` · `.env.migration.example` · README 환경별 값 표. 서버 `.env` 5개는 사람이 넣었고 **PR #13 배포가 부팅 검증을 통과**한 것으로 확인 (2026-09-02). GitHub 시크릿 추가 없음(D6)
- [x] **Step 8** — `DatabaseModule`(`TypeOrmModule.forRootAsync` + `addTransactionalDataSource`) · 옵션은 `typeorm.options.ts` 한 곳(앱·CLI 공유, spec 으로 고정) · `main.ts` `initializeTransactionalContext(ASYNC_LOCAL_STORAGE)` · `/health/ready` 에 `db` 인디케이터 · 앱 스택 `restart_policy` 무제한(D8) · code-patterns §8 DB 예외 + §12 신설. **배포 실측 (2026-09-02, PR #13 → `Deploy` 성공, `3/3`)**: `/api/v2/health/ready` → `200 {redis: up, db: up}` · `docker service ps` 에 에러·크래시 재시작 0건
- [x] **Step 9** — `test/setup/forbid-db.ts`: 두 jest 설정의 moduleNameMapper 가 `mysql2` 를 던지는 스텁으로 교체, 양쪽 spec 으로 고정. 마이그레이션 **인프라**: `src/config/data-source.ts`(CLI 전용, 상대 import) · `pnpm migration:{show,generate,run,revert}`(빌드 산출물 + `--env-file=.env.migration`) · `src/migrations/`. **첫 마이그레이션 파일은 첫 엔티티와 함께** — 엔티티 없이 만드는 마이그레이션은 내용이 없어 규약을 보여주지 못한다(판단, 2026-09-02). 후속 태스크로 이관

### 앱 배선 규약 (Step 8 에서 지킴 — 정본은 code-patterns §12)

| 설정 | 값 | 이유 |
|---|---|---|
| `synchronize` | **`false`** | 🚫 true 면 부팅만으로 상용 스키마가 바뀐다. D1(전 환경 공유)에서는 곧 사고다 |
| `timezone` | `'Z'` | 안 주면 Node 프로세스 로컬 TZ 로 해석한다 (code-patterns §10) |
| `extra.connectionLimit` | 10 | 10 × 레플리카 3 = 30. `max_connections=100` 안에 로컬 개발자 접속분까지 들어간다 |
| `logging` | `['error']` | 🚫 쿼리 로깅을 켜지 않는다 — 공유 로그 스택 인제스트 한도 (CLAUDE.md Never) |
| `autoLoadEntities` | true | 모듈이 엔티티를 등록. 경로 glob 은 `dist` 배포에서 자주 깨진다 |

⚠️ **논점 — DB 연결 실패 시 앱이 부팅되어야 하는가.**
code-patterns §8 은 *"외부 의존이 죽어도 앱은 기동·응답한다"* 이고 Redis 는 `lazyConnect` 로 그렇게 했다. 그런데 `TypeOrmModule` 은 재시도를 모두 소진하면 **모듈 초기화가 실패해 앱이 뜨지 않는다.** 그러면 DB 장애가 곧 배포 롤백이 된다.
Step 8 에서 아래 중 하나를 고르고 **근거를 이 문서에 남긴다.**
1. `retryAttempts` 를 healthcheck 종료 시한 안쪽으로 잡고 부팅 실패를 받아들인다 + **앱 `restart_policy` 를 무제한 재시작으로** 바꿔 DB 복구 시 자동 복원 (단순 · 표준적 · DB 장애 중 배포는 롤백)
2. DataSource 를 직접 만들어 `initialize()` 실패를 흡수한다 (§8 준수 · TypeORM 은 연결 전엔 리포지토리 메타데이터가 없어 우회 배관이 필요)

**확정 (2026-09-02, D8): 1번.** Redis 는 보조 의존이라 §8 이 맞지만 DB 는 **핵심 의존**이다 — 없으면 대부분의 기능이 의미가 없고, 살아 있는 척하는 앱보다 명확히 죽어 있는 앱이 감시하기 쉽다. 현재 앱 `max_attempts: 3` 이면 **노드 재부팅 시 DB 보다 앱이 먼저 떠 3번 실패하고 영구 정지**하는 경로가 있다 — 이게 1번을 고른 결정적 이유다. code-patterns §8 에 "DB 는 예외 — 핵심 의존" 을 명시하는 것이 Step 8 산출물에 포함된다.

⚠️ **`@Transactional` 은 mock 으로 검증되지 않는다** (skeleton 주의사항 #3). 다중 테이블 쓰기 경로에 데코레이터가 붙었는지 **grep 으로 확인**하고 그 결과를 완료 보고에 넣는다.

## 검증 기록

| 항목 | 결과 | 일자 |
|---|---|---|
| `infra/docker-stack.db.yml` · `deploy-db.yml` YAML 파싱 | ✅ | 2026-09-02 |
| `init-users.sh` `bash -n` · 실행 권한 없음(`-rw-r--r--`) | ✅ | 2026-09-02 |
| 세 워크플로 `paths` 교집합 | ✅ 0건 | 2026-09-02 |
| `mysql:8.4` arm64 매니페스트 | ✅ `linux/arm64/v8` 존재 (Docker Hub API, 태그 갱신 2026-07-28) | 2026-09-02 |
| `scripts/db-tunnel.sh` `bash -n` | ✅ · 실접속은 미검증 | 2026-09-02 |
| 시간 설정 저장소 전수 점검 | ✅ ↑ 표 | 2026-09-02 |
| Node 런타임 `process.env.TZ` 변경 반영 | ✅ Node 22.21 · `getHours` 9→0 | 2026-09-02 |
| 사전 조건 — secret 3개 `docker secret ls` · 라벨 `docker node inspect` · 디렉터리 `ls -ldn` | ✅ 사용자 실측 출력 확인 | 2026-09-02 |
| D9 터널 접속 (`scripts/db-tunnel.sh fs-01 3307`) | ✅ 사용자 실측 — `nerd_app@%` 로그인 · `+00:00` · `utf8mb4` · 시스템 DB 비노출 | 2026-09-02 |
| 앱 ↔ DB 연결 (PR #13 `Deploy` run 33611354249) | ✅ `3/3` 수렴 · readiness `200 {redis: up, db: up}` · `service ps` 에러 0건 (사용자 실측) | 2026-09-02 |
| 볼륨 실경로 · 재기동 후 데이터 잔존 | ✅ 사용자 실측 (`{{.Options}}` = 블록 볼륨 경로 · 강제 재기동 후 binlog·ibdata 잔존) | 2026-09-02 |
| 배포 · 스모크 (`Deploy DB` run 33608568134) | ✅ 사전 점검 통과 · 1/1 · 실측 `utf8mb4 / utf8mb4_0900_ai_ci / +00:00 / 1` | 2026-09-02 |
| `mysql2` 네이티브 바인딩 | ✅ 없음 (`gypfile: false`) — arm64 위험 없음 | 2026-09-02 |

## 검증 (배포 후 실측할 것 — 설정 파일 확인으로 대체하지 않는다)

```sql
-- 문자셋·정렬이 실제로 적용됐나
SHOW VARIABLES LIKE 'character_set_%';   -- server/database/connection 이 utf8mb4
SHOW VARIABLES LIKE 'collation_%';
SELECT @@global.time_zone, @@session.time_zone;   -- +00:00

-- 한글·이모지 왕복 (셋 다 원문 그대로 나와야 한다)
CREATE TEMPORARY TABLE t (v VARCHAR(50));
INSERT INTO t VALUES ('한글 테스트'), ('🇰🇷 이모지'), ('가나다ㄱㄴㄷ');
SELECT v, LENGTH(v), CHAR_LENGTH(v) FROM t;
```

**앱 연결 (Step 8~9 후)**

```bash
pnpm ci:all                       # forbid-db 가드가 걸린 상태에서 전부 통과해야 한다
# readiness 가 DB 까지 보는지 (200 이어야 하고, details 에 db 가 있어야 한다)
docker exec "$cid" node -e "
require('http').get({host:'127.0.0.1',port:5501,path:'/api/v2/health/ready'},r=>{
  let b='';r.on('data',c=>b+=c);r.on('end',()=>console.log(r.statusCode,b));})"
# liveness 는 DB 가 죽어도 200 이어야 한다 (code-patterns §7)
```

```bash
# 볼륨이 정말 블록 스토리지를 가리키나 (부트 디스크였다면 여기서 드러난다)
docker volume inspect prod_nerd_db_mysql-data --format '{{.Options}}'
df -hT <마운트지점>

# 재기동 후 데이터가 남아 있나  ← 영속성은 이걸로만 증명된다
docker service update --force prod_nerd_db_mysql
```

## 위험 · 롤백

| 위험 | 완화 |
|---|---|
| 블록 볼륨 미마운트 상태로 기동 → 부트 디스크에 데이터 | `type: none, o: bind` + 하위 디렉터리. fstab 등록 확인 |
| 노드 라벨 누락 → 태스크 pending | 배포 전 `docker node inspect` 로 라벨 확인 |
| 노드 1대 = 앱·Redis·DB 동시 상실 | 이번 구성에서는 **완화 불가** |
| **백업이 없는 기간** | 🔴 D3 를 후속으로 분리했으므로 **이번 태스크 완료 시점에 데이터 유실 방어가 0** 이다. 실데이터가 쌓이기 전에 후속을 끝내는 것이 유일한 완화다 |
| `lower_case_table_names` 를 나중에 바꿈 | 기동 실패. 되돌리려면 덤프 후 재초기화 — **Step 3 에서 못박는다** |
| 메모리 압박으로 앱 레플리카 OOM | DB `limits.memory` 로 상한 고정. 배포 후 `docker stats` 실측 |
| 롤백 | 스택 제거는 즉시 가능하나 **데이터는 볼륨에 남는다.** 볼륨은 명시적으로만 지운다 |

## 후속 (별건 등재 — 이 태스크의 완료를 막지 않는다)

| 항목 | 게이트 | 비고 |
|---|---|---|
| **백업 + 복구 리허설** (D3) | 🔴 **배포 직후 조치** | 실데이터가 쌓이기 전에. 착수 시 `docs/tasks/tasks-db-backup.md` 생성 |
| `deploy.md` 승격 | ✅ 2026-09-02 | 「MySQL 스택」절·상태 확인·롤백을 `deploy.md` 로, 사용법(터널·마이그레이션)은 README 로, 함정 2건은 CLAUDE.md 로 승격. 여기는 근거만 소유한다 |
| 엔티티 네이밍·컬럼 타입 규약 | 후속 | 첫 엔티티를 쓸 때 `.claude/rules/code-patterns.md` 로 승격 |
| mysqld exporter | 후순위 | `deploy.md` 관측성 방침과 동일 — 메트릭은 별도 태스크 |

## Verification Story

- **무엇이 어떻게 바뀌었는가**: 「관리형 RDBMS 중 선택」을 번복하고 MySQL 8.4 를 같은 Swarm 에 자체 호스팅했다(스택 `prod_nerd_db`, 블록 볼륨에 named volume bind, 계정 3개 분리, 설정은 `command:` 플래그). 앱은 TypeORM 으로 붙고(`DatabaseModule`, 옵션 단일 출처, readiness `db` 인디케이터), DB 없이는 부팅 실패 + Swarm 무제한 재시작(D8). 마이그레이션은 CLI 인프라만 두고 실행은 사람 몫으로 남겼다. 곁가지로 테스트 타임존 고정이 처음부터 동작하지 않던 버그를 잡아 설정 파일 상단으로 옮기고 가드를 세웠다.
- **어떻게 동작을 확인했는가**: 설정 파일이 아니라 **떠 있는 것에 물어서**. DB — 배포 워크플로 스모크가 SQL 로 `utf8mb4 / 0900_ai_ci / +00:00 / lower_case_table_names=1` 실측, `docker volume inspect` 로 블록 볼륨 경로, 강제 재기동 후 binlog·ibdata 잔존. 앱 — `3/3` 수렴 + `/health/ready` `{redis: up, db: up}` + `service ps` 에러 0건. 접속 — 노트북 터널로 `nerd_app@%` 로그인, 변수 확인, 시스템 DB 비노출. 코드 — `ci:all`(단위 64 · E2E 18) + CLI 가 dist 에서 `ECONNREFUSED` 까지 도달. **미검증으로 남긴 것**: 없음(백업 복구 리허설은 후속 태스크의 검증 항목).
