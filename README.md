# 해인교회 홈페이지

Astro + Supabase 기반의 해인교회 홈페이지 소스입니다. 작업은 이 컴퓨터에서 진행하며, 인터넷 배포는 사용자의 명시적 지시 전까지 중단합니다. Cloudflare 자동 배포도 비활성화 상태를 유지합니다.

## 로컬 실행

1. Node.js 22.12 이상과 pnpm을 준비한 후 `pnpm install --frozen-lockfile`을 실행합니다.
2. Onmam 백업은 개인정보와 대용량 첨부파일을 포함할 수 있어 GitHub에 올리지 않습니다. 이 컴퓨터의 `migration/onmam/`에 보관된 백업으로 `python scripts/prepare_onmam_site.py`를 실행하여 로컬 데이터와 첨부파일을 준비합니다. 자세한 내용은 [백업 안내](migration/README.md)를 확인하세요.
3. Supabase 연결은 `.env.example`을 참고해 로컬 `.env`에 공개용 프로젝트 URL·anon 키만 설정합니다. 실제 프로젝트 생성과 DB 적용 전에는 회원가입 화면에 연결 준비 안내가 표시됩니다.
4. `pnpm build` 후 `START-LOCAL.cmd`로 `http://127.0.0.1:4321`에서 확인하거나 `pnpm dev`로 로컬 개발 서버를 실행합니다.

## 회원 승인 및 개인정보 보호

- `/join/`: 이메일·비밀번호 회원가입과 승인 신청
- `/membership/`: 본인의 승인 대기·승인 완료·거절 상태 확인
- `/admin/`: 지정된 관리자만 신청 목록 조회 및 승인·거절 처리
- [Supabase 설정 순서와 실제 적용이 필요한 항목](supabase/MEMBERSHIP-SETUP.md)
- `pnpm test:membership`: 원격 연결 없이 PostgreSQL 접근 정책과 승인 절차 검증

비밀번호는 Supabase Auth가 관리합니다. 이름·이메일·가입 인사는 RLS와 관리자 전용 RPC로 보호하며 실제 회원 데이터, 원본 백업, 환경변수, 비밀 키는 GitHub에 저장하지 않습니다. 관리자 권한은 회원의 입력값이나 최초 가입 순서로 부여하지 않습니다.

검색 차단을 위한 robots/noindex를 유지합니다. 로컬 데이터와 첨부파일은 저장소에 포함되지 않으므로 새 checkout에서는 해당 자료를 준비해야 전체 게시판을 빌드할 수 있습니다. 현재 개발 단계의 소스 push는 인터넷 홈페이지 배포와 별개입니다.

## 전체 메뉴 관리와 전체 자료 복원

원래 온맘닷컴의 상위 메뉴 8개와 하위 메뉴 42개(게시판 35개·안내 페이지 7개)는
`src/data/site-menu.json`에서 관리합니다. 홈, 전체 메뉴, 분야별 안내, 게시판에서 같은
메뉴 정보를 사용하며 원본 게시판·글 ID는 유지합니다. 기존 관리자 회원 승인 코드는 보존합니다.

`pnpm dev`로 백그라운드 개발 서버를 시작한 뒤 `http://127.0.0.1:4321/admin/site/`를
열면 메뉴 이름·설명·순서·표시 변경과 메뉴 추가, 모든 게시판의 글 작성·수정·숨김,
안내 페이지 편집, 사진·첨부 추가, 원본 복원을 사용할 수 있습니다.
Supabase가 연결되어 있으면 지정 관리자 로그인 후 온라인으로 저장합니다.
대표 슬라이드와 모든 메뉴의 사진·영상·문서 업로드를 지원하며, 원본 자료는 보존하고
변경 내용과 이력을 별도 저장합니다. 연결이 없는 로컬 개발 서버에서는 기존 로컬 편집을 사용합니다.
새 관리자는 홈페이지 가입 후 서버의 관리자 목록에 명시적으로 등록해야 합니다.
GitHub 로그인만으로 홈페이지 관리자 권한을 자동 부여하지 않습니다.

본문은 텍스트로 편집합니다. 제목·날짜만 변경하면 원래 본문 서식을 유지하고,
본문을 바꿔도 기존 사진·음성·영상·첨부는 보존합니다. 자료 수정본은 Git에서 제외한
`src/data/onmam-edits.json`에, 저장 전 상태는 `migration/onmam/local-history/`에,
추가 첨부 원본은 `migration/onmam/local-uploads/`에 보관합니다.
메뉴 숨김은 탐색 메뉴의 표시 옵션이며 접근 권한이나 비밀글 기능과는 별개입니다.

전체 자료는 기존 백업과 분리한 스냅샷으로 수집합니다. 아래 Python 명령은 이 컴퓨터의
번들 런타임으로 실행합니다. 원격 변경·로그인 우회·업로드는 수행하지 않습니다.

```text
python scripts/archive_onmam.py --all-boards --output migration/onmam/snapshots/2026-11-02 --reuse-assets migration/onmam
node scripts/audit_onmam_backup.mjs --archive migration/onmam/snapshots/2026-11-02
python scripts/prepare_onmam_site.py --archive migration/onmam/snapshots/2026-11-02
pnpm build
python scripts/check_local_site.py
pnpm test:cms
```

`--reuse-assets`는 해시가 일치하는 파일만 재사용합니다. 목록과 본문은 새 스냅샷에서
다시 읽으며, 중단한 스냅샷은 동일 명령으로 이어갈 수 있습니다. `unavailable-files.csv`는
원본 서버에서 내려받지 못한 자료 목록입니다. 외부 영상 주소 보존은 영상 원본 확보와
구분합니다. 게시글·페이지의 수집 오류가 남으면 사이트 자료 준비를 중단합니다.

원본 CI는 `migration/onmam/branding/`의 JPEG와 SHA-256 기록으로 보존하고
`src/data/branding.json`에서 연결합니다. 220×63 원본은 재제작·크롭·색상 변경 없이
상단·하단·로그인 화면 로고로 사용합니다. 동일한 원본 파일을 `public/brand/`에도 포함합니다.

## 공유 미리보기와 온라인 관리자

공유 미리보기는 사용자가 요청한 경우에만 기존 Cloudflare Pages `haein-church` 프로젝트의
`codex-preview-20261102` 브랜치로 수동 업로드합니다. 정식 도메인 전환은 별도 작업이며
생산 및 미리보기 자동 배포는 계속 중단합니다. 미리보기의 기존 첨부는 온맘닷컴 원본 주소를
참조하므로 원본 서버의 유지가 필요합니다. 전체 로컬 백업은 별도로 보존합니다.

2026-11-02에 지정된 서울 리전 Supabase 프로젝트의 회원 승인 및 온라인 CMS 스키마를
적용하고 공개 조회 API를 확인했습니다. 관리자 계정 등록과 실제 계정으로 업로드하는
최종 확인은 별도입니다. `pnpm test:cms`는 합성 자료로 권한·수정 충돌·이력을 검증합니다.
원본 숨김은 Pages middleware가 HTML과 자료 JSON에서도 검사하며,
미리보기 환경에는 `.env.example`의 공개 Supabase 연결값이 필요합니다.

로컬 서버 관리: `pnpm astro dev status`, `pnpm astro dev logs`, `pnpm astro dev stop`.
`START-LOCAL.cmd`의 빌드 결과 미리보기에는 편집 API가 없으므로 편집 시에는 `pnpm dev`를 사용합니다.
