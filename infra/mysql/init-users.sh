#!/usr/bin/bash
# 첫 초기화 1회: 앱 계정(DML 만)·마이그레이션 계정(DDL 포함)을 만든다.
#
# 공식 이미지 엔트리포인트가 이 파일을 **source** 한다 (실행 권한이 없을 때).
# 그래서 엔트리포인트의 함수 `docker_process_sql` 과 환경변수 `MYSQL_DATABASE` 를 그대로 쓴다.
# ⚠️ 실행 권한을 주면 별도 프로세스로 돌아 위 함수가 없다 — 스택 YAML 의 mode: 0444 가 이를 보장한다.
# ⚠️ 데이터 디렉터리가 비어 있을 때만 실행된다. 이후 계정 변경은 SQL 로 직접 한다.
# ⚠️ `set -e/-u` 를 여기서 바꾸지 않는다. source 되므로 엔트리포인트의 셸 옵션을 오염시킨다.
#
# 앱 계정에서 DDL 을 빼는 이유: 「마이그레이션 실행은 사람이」(CLAUDE.md) 를 관례가 아니라 권한으로 강제한다.

app_pw="$(< /run/secrets/prod_nerd_db_app_pw)"
migrator_pw="$(< /run/secrets/prod_nerd_db_migrator_pw)"

# 비밀번호는 `openssl rand -base64` 산출물이라 SQL 문자열 안에서 이스케이프가 필요한 문자(작은따옴표·역슬래시)가 없다.
docker_process_sql <<EOSQL
CREATE USER IF NOT EXISTS 'nerd_app'@'%' IDENTIFIED BY '${app_pw}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${MYSQL_DATABASE}\`.* TO 'nerd_app'@'%';

CREATE USER IF NOT EXISTS 'nerd_migrator'@'%' IDENTIFIED BY '${migrator_pw}';
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO 'nerd_migrator'@'%';

FLUSH PRIVILEGES;
EOSQL

unset app_pw migrator_pw
