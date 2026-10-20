# 온맘 해인교회 자료 이관

## 홈페이지 적용 상태

백업한 고정 페이지 7개와 게시글 721개를 실제 Astro 홈페이지에 연결했다.
`/boards/`에서 전체 메뉴와 검색을, `/boards/<게시판ID>/`에서 목록과 페이지 이동을,
`/posts/<게시판ID>/<글ID>/`에서 개별 글을 확인한다.
교회소개·예배안내·오시는 길도 원본 자료로 연결했다.
기존 관리자·가입신청·로그인·회원 승인 함수의 코드는 유지했다.
현재 게시판의 백업 자료는 로컬 JSON에서 표시하며 Supabase 업로드는 아직 하지 않았다.

`scripts/prepare_onmam_site.py`는 본문을 정리하고 이미지를 로컬 경로로 바꾸며,
`src/data/onmam.json`과 `public/onmam-assets/`를 만든다. 가능한 경우 파일을 하드 링크로
연결해 원본 이미지를 중복 복사하지 않는다. 두 경로 모두 Git에서 제외한다.

```text
python scripts/prepare_onmam_site.py
node node_modules/astro/bin/astro.mjs build
python scripts/check_local_site.py
```

`START-LOCAL.cmd`를 실행하면 빌드된 홈페이지를 `http://127.0.0.1:4321/boards/`에서 볼 수 있다.
외부 인터넷에는 공개되지 않으며 서버는 이 컴퓨터의 loopback에만 바인딩한다.
Cloudflare 운영/미리보기 자동 배포를 중지했다. 모든 화면에 noindex를 설정하고
robots.txt와 X-Robots-Tag 설정도 추가했다. `deploy` 명령도 기본 차단한다.
사용자가 명시적으로 인터넷 배포를 요청하기 전에는 배포하거나 자동 배포를 다시 켜지 않는다.

원본: https://haein-church.onmam.com/

요청한 교회소개(인사말·비전·연혁·섬기는 사람들 포함), 예배안내, 오시는 길,
주보, 새가족반, 찬양, 교육/훈련, 사랑방, 부서소개, 선교사역, 커뮤니티의 하위 메뉴를 수집한다.
교회소식 분류에서는 요청한 주보만 포함한다. 성가대와 우리들의 찬양은 각각 별도 게시판이다.

## 로컬 자료

`onmam/`은 Git에서 제외한 이관용 원본 폴더다. 아직 공개 홈페이지에 배포하거나 Supabase로 전송하지 않는다.

- `index.html`: 분류·게시판·제목으로 검색하고 본문을 열 수 있는 로컬 자료실
- `catalog.json`: 원본 메뉴 대응표(빈 게시판도 유지)
- `inventory.json`: 모든 게시판 페이지와 게시글 목록
- `content.jsonl`: Supabase 이관에 사용할 게시글·고정 페이지·영상 주소·첨부 정보
- `content-index.csv`: 제목, 날짜, 원문 주소, 저장 상태 목록
- `archive.sqlite`: 검색 가능한 로컬 데이터베이스
- `records/`: 개별 자료 JSON
- `raw/`: 원문 페이지 HTML(목록과 게시글)
- `assets/`: 사진·첨부 원본, `asset-records/`: URL·파일명·SHA-256·용량 대응표
- `preview/`: 내려받은 이미지로 연결한 로컬 본문
- `report.json`, `errors.jsonl`: 수집 결과와 확인이 필요한 항목
- `unavailable-files.csv`: 원본에서 404 등을 반환하는 파일과 해당 게시글 대응표

공개 읽기 요청만 수행한다. 로그인·비밀글·삭제글은 우회하지 않는다.
유튜브·외부 임베드 영상은 재생 주소를 보존하며 영상 원본을 내려받았다는 뜻이 아니다.
댓글은 원문 페이지에서 제공되는 내용만 보존하며, 별도 로그인이 필요한 댓글은 포함하지 않는다.
본문이 이미지인 주보는 이미지 원본으로 보존한다(OCR로 본문을 재작성하지 않는다).
열람수는 수집 시점 기준이며 원래 수집 전 수치와 다를 수 있다.

## 다시 수집하기

`scripts/archive_onmam.py`를 Python으로 실행한다. `beautifulsoup4`가 필요하며
이 작업에서는 프로젝트 내부 `.migration-tools/`에 설치했다.
정상 저장한 파일은 재사용하므로 중단 이후 다시 실행할 수 있다.

```text
python -m pip install --target .migration-tools -r scripts/requirements-onmam.txt
python scripts/archive_onmam.py
python scripts/import_onmam.py
```

두 번째 명령은 기본적으로 네트워크 전송 없이 목록 완전성과 파일 SHA-256을 검증한다.
원본 서버에서 삭제되거나 만료된 파일은 별도로 집계한다. 실제 전송은 기본적으로
해당 파일이 남아 있으면 중단한다. 목록을 확인한 뒤 원문 참조를 남긴 상태로 이관하려면
`--allow-unavailable-assets` 옵션을 명시해야 한다.

## Supabase 준비

`supabase/migrations/202610200001_onmam_staging.sql`은 이관 대기용 테이블과 비공개
`onmam-import` Storage 버킷을 만든다. `anon`과 `authenticated`에는 조회 권한을 주지 않는다.
기존 `news`, `gallery` 등 서비스 테이블을 덮어쓰지 않는다.

프로젝트를 생성한 뒤 이 SQL을 적용하고, 관리자용 키를 프로세스 환경변수
`SUPABASE_SERVICE_ROLE_KEY`와 URL을 `SUPABASE_URL`로 설정한 환경에서만 다음을 실행한다.
키는 파일·GitHub·채팅·공개 프런트엔드 환경변수에 저장하지 않는다.

```text
python scripts/import_onmam.py --apply
```

동일 원문 키로 upsert하므로 재실행 시 중복을 만들지 않는다. 사진은 비공개 버킷,
본문은 `published=false`로 저장한다. 공개 페이지 연결·게시 권한·사진 공개 여부 확인과
HTML 재검증은 실제 공개 작업 단계에서 수행한다. 외부 영상 플레이어는 원문 주소로
보존한다. 원본 서버에서 사라진 파일은 누락 목록을 보고 원본을 보완해야 한다.
