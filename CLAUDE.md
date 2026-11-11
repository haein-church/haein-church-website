# 해인교회 홈페이지 작업 안내

먼저 `AGENTS.md`를 읽고 따릅니다.

두 AI의 서비스별 인증 상태와 연결 방법은 `docs/AI_COLLABORATION.md`를 확인합니다. 프로젝트 한정 Supabase MCP 설정은 `.mcp.json`에 있으며 별도 OAuth 인증이 필요합니다.

상태·운영 문서는 `docs/PROJECT_STATUS.md`, `docs/OPEN_ISSUES.md`, `docs/OPERATIONS_MANUAL.md`, `docs/BACKUP_VERIFICATION.md`에 있습니다. Astro 변경 전에는 `AGENTS.md`의 공식 가이드를 확인합니다.

- 저장소: `haein-church/haein-church-website`
- 현재 작업 브랜치: `codex/full-onmam-migration`. 기본 브랜치 `master`와 구분해서 확인합니다.
- 로컬 작업 폴더: `C:\Users\icjjokbang\Desktop\해인교회 홈페이지 만드는 중`
- 공유 미리보기: https://codex-preview-20261102.haein-church-9j8.pages.dev/
- Cloudflare Pages: 기존 `haein-church` 프로젝트. 이 미리보기는 `codex-preview-20261102` 브랜치로 수동 업로드합니다.
- Supabase: `haein-church's Org`의 서울 리전 `haein-church-website` (`ambojhrewxsxdavlmkpt`). 다른 계정이나 프로젝트에는 작업하지 않습니다.

## 현재 소스

- `src/components/HeroSlider.astro`, `src/data/hero-slides.json`: 요한복음 3:16·에베소서 4:2–3 슬라이드. 에베소서 사진은 해인교회가 온맘에 올린 실제 새가족 환영 장면입니다.
- `src/components/SiteNavigation.astro`, `src/layouts/Layout.astro`: 모바일 메뉴·가독성·터치 영역.
- `src/components/ArchiveContent.astro`, `src/data/video-source-links.json`: 미확보 영상 88개에 대응하는 게시글 49개의 Band 원본 연결. 별도 보존된 영상 5개는 직접 열기 링크도 제공합니다. Band 내 실제 재생은 로그인·가입 상태에 따라 확인이 필요합니다.
- `src/pages/admin/site.astro`, `src/lib/online-cms.ts`: 기존 관리자 기능. 기존 관리자 코드를 보존합니다.
- `functions/_middleware.ts`: 숨김 글의 정적 HTML·JSON 접근 보호. 삭제하지 않습니다.

## 원본 자료와 빌드

공개 원본 글 1,987건·안내 페이지 7건을 합쳐 로컬 준비 자료는 1,994건입니다. 원본·첨부·검증 보고서 및 환경변수는 Git에서 제외합니다. GitHub만 새로 내려받으면 모든 원본 데이터가 함께 생기지 않습니다.

- 원본 백업: `migration/onmam/` 및 그 아래 별도 스냅샷
- 준비 데이터: `src/data/onmam.json` (비공개 로컬 파일)
- 첨부: `public/onmam-assets/` (비공개 로컬 파일)
- 검증 기록: `migration/references/2026-11-11/` (비공개 로컬 파일)
- 환경변수: `.env.example`을 참고하고 실제 `.env`는 커밋하지 않습니다.
- 로컬 실행: `pnpm dev` (`127.0.0.1`에만 바인딩)
- 서버는 `astro dev --background`로 실행하고 `astro dev status`, `astro dev logs`, `astro dev stop`으로 관리합니다.
- 빌드: `pnpm build`
- 검증: `pnpm test:cms`, `pnpm test:membership`

공유 미리보기 패키지는 `scripts/prepare_share_preview.mjs --remote-assets`로 준비합니다. 이 모드는 일부 기존 사진·첨부를 온맘 원본 주소로 연결하며, 원본 파일 전체를 새 온라인 저장소에 옮겼다는 뜻은 아닙니다. 원본 백업은 이 컴퓨터에 보존합니다.

변경 소스를 커밋·push한 뒤 같은 커밋으로 Cloudflare 미리보기를 업데이트합니다. 정식 도메인 배포와 자동 배포 재활성화는 별도 사용자 지시가 필요합니다. 온맘 원본을 삭제하지 않습니다.
