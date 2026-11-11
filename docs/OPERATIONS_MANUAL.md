# 운영 설명서 (OPERATIONS_MANUAL)

- 갱신일: 2026-11-11
- 현재 확인 범위는 `PROJECT_STATUS.md`, 남은 항목은 `OPEN_ISSUES.md`를 먼저 읽습니다. 백업 자동화와 실제 관리자 계정 최종 점검은 별도입니다.

## 로컬 확인

1. `START-LOCAL.cmd`를 실행한다.
2. 브라우저에서 `http://127.0.0.1:4321/boards/`를 연다.
3. 외부 인터넷에는 공개되지 않는다.

## 데이터 다시 수집 (온맘 원본 변경 시)

```text
python scripts/archive_onmam.py
python scripts/import_onmam.py
python scripts/prepare_onmam_site.py
node node_modules/astro/bin/astro.mjs build
python scripts/check_local_site.py
```

주의: 목록 페이지는 캐시되므로, 새 글을 찾으려면 `migration/onmam/raw/lists/`와 `raw/intro_*.html`을 먼저 옮겨야 한다. 주보 제목 수정은 재수집 시 되돌아간다.

## 백업

- 원본 백업은 `migration/onmam/`에 있다. Git에 올리지 않는다.
- 백업 무결성은 `docs/BACKUP_VERIFICATION.md`의 SHA-256 검증으로 확인한다.
- 자동 백업(DB, 파일)은 아직 설정하지 않았다.

## 배포

- 자동 배포는 중지 상태를 유지합니다.
- 먼저 현재 작업 브랜치를 커밋·push합니다. 원본 백업과 실제 `.env`는 제외합니다.
- 공유 미리보기 업데이트가 요청된 경우 `HAEIN_ALLOW_PUBLISH=1`을 해당 명령 환경에 설정하고 `node scripts/deploy_pages_preview.mjs`를 실행합니다.
- 도구는 원격 브랜치와 HEAD 일치를 확인하고 빌드한 뒤 같은 커밋으로 기존 `haein-church` Pages 프로젝트의 `codex-preview-20261102` 미리보기를 업데이트합니다.
- 주소: https://codex-preview-20261102.haein-church-9j8.pages.dev/
- 정식 도메인 변경은 별도 지시가 필요합니다. 커밋·URL은 `migration/references/`의 비공개 배포 기록에 보존합니다.

## 미완료

- 관리자 기능 검증, 권한 검증, 복원 테스트, 도메인 연결.
