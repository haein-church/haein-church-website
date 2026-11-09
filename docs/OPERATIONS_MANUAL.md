# 운영 설명서 (OPERATIONS_MANUAL)

- 갱신일: 2026-11-09
- 상태: 초안. 관리자 기능과 백업 자동화는 검증 전이다.

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

- 자동 배포는 중지 상태다. 공개 배포는 사용자 승인 후에만 진행한다.

## 미완료

- 관리자 기능 검증, 권한 검증, 복원 테스트, 도메인 연결.
