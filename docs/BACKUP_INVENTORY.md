# 백업 목록 (BACKUP_INVENTORY)

- 갱신일: 2026-11-09
- 위치: `migration/onmam/` (Git 제외, 로컬 전용)

| 파일/폴더 | 내용 | 수량 |
|---|---|---:|
| `content.jsonl` | 게시글·고정 페이지 전체 데이터 | 732 (페이지 7, 게시글 725) |
| `content-index.csv` | 제목, 날짜, 원문 URL, 저장 상태 목록 | 732 행 |
| `inventory.json` | 게시판별 목록 | 게시판 32 |
| `catalog.json` | 메뉴 대응표 | 메뉴 39 |
| `archive.sqlite` | 검색용 DB | - |
| `records/` | 개별 자료 JSON | 732 |
| `raw/content/` | 게시글 원문 HTML | 725 |
| `raw/lists/` | 게시판 목록 HTML (최신) | - |
| `raw/lists_prev_20261020/` | 게시판 목록 HTML (이전, 2026-10-20 기준) | - |
| `raw/intro_prev_20261020.html` | 메뉴 페이지 원본 (이전) | 1 |
| `assets/` | 이미지·첨부·미디어 원본 | 3,474 |
| `asset-records/` | URL, 파일명, SHA-256, 용량 대응표 | 3,474 |
| `unavailable-files.csv` | 원본 404 파일 목록 | 25 |
| `errors.jsonl` | 수집 오류 기록 | 25 (모두 404) |
| `report.json` | 수집 요약 | - |

백업은 공개 페이지에서 로그인 없이 수집했다. 관리자 측 원본 자료는 포함되지 않는다.
