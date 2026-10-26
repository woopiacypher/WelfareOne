# 학생 PC Oracle 원격 접속 및 WelfareOne 연결

이 문서는 학생 한 명의 Windows PC에 설치된 Oracle Database 21c XE를 같은 수업망의 다른 PC에서 사용하고, WelfareOne의 Spring Boot 서비스에 연결하는 절차다. 배포 스크립트는 Oracle 설치 프로그램이 아니며, **Windows Oracle Database 21c XE가 이미 설치된 PC**를 원격 접속 서버로 준비한다.

## 배포 파일 확인

현재 제공된 배포본은 `02_remote_access` 폴더에 있다. `00_먼저읽기.txt`, `01`~`04` 배치 파일 외에도 배치 파일이 호출하는 `*.ps1`, `Prepare-Database.sql`, `공통접속정보.txt`가 같은 폴더에 있어야 한다. 폴더 전체를 압축 해제하고 보조 파일을 분리하거나 이름을 바꾸지 않는다. `내PC_접속정보.txt`는 각 서버 PC에서 준비를 마친 뒤 생성되는 파일이다.

| 파일 | 역할 |
|---|---|
| `00_먼저읽기.txt` | 실행 전 요구 사항과 빠른 순서 |
| `01_내PC_원격접속준비.bat` | 실행한 PC의 DB·계정·Listener·방화벽 설정 및 접속 검사 |
| `02_내PC_접속확인.bat` | 서버 PC 자신의 현재 IP로 접속 확인 |
| `03_다른PC_접속확인.bat` | 상대방이 알려 준 IP로 접속 확인 |
| `04_설정전점검.bat` | 설정을 바꾸지 않는 사전 점검 |
| `README.md` | 배포본 상세 설명, 수동 점검 및 오류 해결 |
| `Common.ps1`, `Network-Cidr.ps1`, `Prepare-Database.sql`, `Set-RemoteFirewall.ps1`, `Setup-StudentOracle.ps1`, `Test-RemoteOracle.ps1` | 배치 파일이 호출하는 구현 파일 |
| `공통접속정보.txt` | 수업용 계정 정보. 비밀번호가 평문으로 있으므로 비공개로 취급 |
| `내PC_접속정보.txt` | 서버별 IP와 서비스 정보. 실행 후 만들어지며 새 배포 ZIP에는 넣지 않음 |

이 스크립트 묶음은 **Windows Oracle Database 21c XE, CDB, 기본 `LISTENER`, 인스턴스 `XE`**를 대상으로 한다. 19c, 23ai/26ai Free, 다중 Oracle Home, 사용자 지정 Listener 등은 자동 설정 대상이 아니다. 해당 경우 이 배치 파일로 설정하지 말고 DBA가 해당 Oracle 버전의 절차를 적용한다.

## 서버 PC 준비 순서

1. `README.md`의 준비물과 자동 변경 내용을 읽는다. Oracle XE 서버가 설치되어 있어야 하며 SQL Developer만 설치된 PC는 DB 서버가 아니다.
2. 같은 수업 LAN/Wi-Fi에서 다른 PC와 통신 가능한지 확인한다. 게스트 Wi-Fi의 단말 격리나 VLAN 정책이 통신을 막을 수 있다.
3. 먼저 `04_설정전점검.bat`를 실행해 현재 IP, Oracle 설치와 권한, 적용 예정 Listener 주소 및 방화벽 범위를 살핀다. 이 단계는 설정을 적용하지 않는다.
4. 준비 내용에 문제가 없으면 `01_내PC_원격접속준비.bat`를 우클릭해 **관리자 권한으로 실행**한다. Oracle 설치 Windows 사용자의 로컬 OS 인증 권한(보통 `ORA_DBA`)도 필요하다. 스크립트는 SYS/SYSTEM 암호를 요청하지 않는다.
5. 네트워크 인터페이스 후보가 여러 개면 실제로 학생 간 연결할 수업망을 고른다. 마지막 `[전체 완료]`가 확인되어야 설정과 검사까지 끝난 것이다.
6. 생성된 `내PC_접속정보.txt`에서 서버 IP만 확인해 접속할 학생에게 전달한다. IP 또는 LAN/Wi-Fi가 바뀌면 01을 다시 실행하고 새 IP를 알려 준다.

### 01 실행 전 변경 영향

01은 실습 PDB `WELFAREONE_ORACLE_DB`가 없으면 만들고 열림 상태를 저장하며, `WELFAREONE` 사용자와 수업용 권한·공간을 설정한다. 이미 `WELFAREONE` 사용자가 있으면 암호를 배포본의 공통 수업용 암호로 바꾸고 계정 잠금을 푼다. 기존 테이블과 자료는 스크립트가 삭제하지 않지만, 이 계정을 사용하는 다른 프로그램의 접속 암호도 맞춰야 한다.

01은 선택된 현재 IP를 기준으로 기본 Listener 주소와 서비스 등록 주소를 설정하고, 같은 서브넷에서 TCP 1521로 들어오는 방화벽 연결을 허용한다. Listener 설정을 바꾸면 Listener가 재시작될 수 있다. PDB·계정·Listener·방화벽 작업은 하나의 원자적 변경이 아니므로 중간 실패가 모든 단계를 자동 원복하지 않는다. 오류가 나면 배포본 `README.md`를 확인한 뒤 원인을 해결하고 재실행한다. 데이터베이스 초기화나 백업 복원은 이 배치의 기능이 아니다.

비밀번호가 들어 있는 `공통접속정보.txt`와 서버별 `내PC_접속정보.txt`를 저장소, 공개 공유 폴더, 새 배포 ZIP에 넣지 않는다. 수업용 공통 암호를 공유해야 하면 승인된 비공개 채널을 사용하고, 실습 종료 후에는 계정 암호를 교체한다.

## 다른 PC에서 접속 확인

1. 서버 학생에게 현재 IP를 받는다.
2. 클라이언트 PC에서 `03_다른PC_접속확인.bat`를 실행하고 상대 서버의 IPv4 주소를 입력한다. `http://`나 `:1521`을 붙이지 않는다.
3. TCP 연결뿐 아니라 `WELFAREONE` 계정 로그인과 PDB 조회의 성공 여부를 확인한다. 클라이언트에 SQL*Plus가 없어 TCP만 검사된 경우에는 SQL Developer로도 로그인을 확인한다.
4. `02_내PC_접속확인.bat`는 서버 자신의 현재 IP로 같은 연결 검사를 한다. 02와 03은 조회 전용이며 DB·계정·Listener·방화벽 설정을 변경하지 않는다.

SQL Developer 접속은 **Basic**, **Service name** 방식으로 설정한다.

| 항목 | 값 |
|---|---|
| Username | `WELFAREONE` |
| Password | 승인된 비공개 채널의 수업용 접속 암호 |
| Role | `Default` |
| Hostname | 서버 PC가 알려 준 현재 IP |
| Port | `1521` |
| Service name | `WELFAREONE_ORACLE_DB` |

테스트 결과가 Success인지 확인한다. 접속 후 아래 조회로 로그인 사용자와 대상 PDB를 검증할 수 있다.

```sql
SELECT SYS_CONTEXT('USERENV','SESSION_USER') AS LOGIN_USER,
       SYS_CONTEXT('USERENV','CON_NAME') AS DATABASE_NAME,
       SYS_CONTEXT('USERENV','NETWORK_PROTOCOL') AS PROTOCOL,
       SYS_CONTEXT('USERENV','IP_ADDRESS') AS CLIENT_IP
FROM DUAL;
```

기대 결과는 `WELFAREONE`, `WELFAREONE_ORACLE_DB`, `tcp`다.

## WelfareOne 테이블과 Spring 연결

원격 접속 준비 배포본은 PDB와 앱 사용자를 준비하지만 WelfareOne 테이블을 만들지는 않는다. 신규 스키마라면 **SQL Developer에서 `WELFAREONE` 사용자로 위 PDB 서비스에 접속한 상태로** [`oracle_schema.sql`](oracle_schema.sql)을 한 번 실행한다. 기존 운영/실습 데이터가 있는 스키마에 초기화용 DROP 구문을 실행하지 않는다. 테이블 목록은 다음처럼 확인한다.

```sql
SELECT table_name FROM user_tables ORDER BY table_name;
```

Spring Boot는 `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` 환경 변수로 연결 정보를 받는다. `app/memberJoin/src/main/resources/application.yml`의 기본 URL은 기존 서버를 가리킬 수 있으므로 새 서버를 쓸 때는 세 변수를 새 값으로 지정한다.

```text
DB_URL=jdbc:oracle:thin:@//<서버_IP>:1521/WELFAREONE_ORACLE_DB
DB_USERNAME=WELFAREONE
DB_PASSWORD=<비공개 채널에서 확인한 접속 암호>
```

예를 들어 Windows PowerShell의 현재 프로세스에 설정하고 Spring을 시작하려면 저장소 루트에서 다음을 실행한다. `<서버_IP>`를 상대방 서버 주소로 바꾸고, 비밀번호는 프롬프트에 입력한다.

```powershell
$env:DB_URL = "jdbc:oracle:thin:@//<서버_IP>:1521/WELFAREONE_ORACLE_DB"
$env:DB_USERNAME = "WELFAREONE"
$env:DB_PASSWORD = Read-Host "Oracle password"
Set-Location app\memberJoin
.\gradlew.bat bootRun
```

기동 로그에서 Oracle JDBC 연결이 만들어지고 Spring Boot가 정상 시작되는지 확인한다. 서버 PC의 IP가 바뀌면 접속 문자열도 새 IP로 갱신한다. 운영 서비스는 비밀번호를 셸 기록·문서·Git에 두지 말고 OS 또는 클라우드 비밀 저장소에서 주입한다.

## 접속 실패 시 확인

| 증상 | 먼저 확인할 사항 |
|---|---|
| 시간 초과 또는 TCP 연결 실패 | IP가 최신인지, 서버 전원이 켜져 있는지, 같은 수업망인지, 방화벽과 Wi-Fi 단말 격리 정책 |
| `ORA-12541` | 서버의 Listener가 실행 중이고 1521에서 대기하는지 |
| `ORA-12514` | 서비스명이 `WELFAREONE_ORACLE_DB`인지, PDB가 열려 있고 Listener에 `READY`로 등록됐는지 |
| `ORA-01017` | 사용자명, 암호, 접속 대상 서버 IP 확인 |
| `ORA-28000` | 계정 잠금 상태 확인. 서버 관리자에게 문의 |
| `ORA-00942` | DDL을 `WELFAREONE` 스키마에서 실행했는지 확인 |
| TCP 성공, SQL 로그인 실패 | 네트워크는 연결된 상태이므로 서비스명·계정·암호를 별도 확인 |

배포본의 상세 수동 점검, Listener/NETCA 절차, 방화벽 규칙 범위와 나머지 오류 해결은 같은 폴더의 `README.md`를 따른다. 학교망이나 외부 네트워크 정책을 우회하지 말고, 승인되지 않은 인터넷 포트 공개나 라우터 포트 포워딩을 추가하지 않는다.

## Oracle 공식 참고 자료

- [Oracle Database 21c XE 다운로드](https://www.oracle.com/database/technologies/xe-downloads.html)
- [Oracle Database XE 21c Windows 설치 안내](https://docs.oracle.com/en/database/oracle/oracle-database/21/xeinw/)
- [Oracle Database XE 21c 접속 안내](https://docs.oracle.com/en/database/oracle/oracle-database/21/xeinw/connecting-oracle-database-xe.html)
