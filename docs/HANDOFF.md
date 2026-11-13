# 공동 작업 인수 문서 (HANDOFF)

ChatGPT와 Claude가 같은 저장소에서 번갈아 작업합니다. 이 문서를 먼저 읽고 이어서 진행하세요.

## 작업 규칙

- 작업 브랜치: `codex/full-onmam-migration` (기본 브랜치 `master`와 구분)
- 만든 단계마다 커밋하고 바로 push합니다. 다음 AI는 원격 최신 커밋에서 이어갑니다.
- **배포 금지:** 사용자가 "배포"라고 명시하기 전에는 Cloudflare에 배포하지 않습니다. 배포 스크립트(`scripts/deploy_pages_preview.mjs`)도 실행하지 않습니다.
- 원본 자료(`migration/onmam/`, `src/data/onmam.json`, `public/onmam-assets/`, `.env`)는 Git에 올리지 않습니다. 원본 파일은 삭제하지 않습니다.
- 커밋 메시지 끝에 작성한 AI의 공동 작성 줄을 넣습니다. 예: `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`
- 기존 관리자 기능(`src/pages/admin/`, `src/lib/online-cms.ts`), 숨김 글 보호(`functions/_middleware.ts`)는 사용자 지시 없이 제거하지 않습니다.

## 현재 상태 (2026-11-13)

- 메인 슬라이더: 최근 커밋 `a5b5660`(ChatGPT 작성)의 성경 구절 슬라이드와 `public/images/hero/` 사진을 사용합니다.
- 슬라이더 사진 교체(교회 사진 등)는 Claude 쪽 로컬 작업이었지만, 현재 저장소에는 반영되어 있지 않습니다. 필요하면 현재 저장소 기준으로 다시 적용해야 합니다.
- 공유 미리보기 기록: 사용자의 명시 요청 없이 한 번 배포되었습니다(커밋 `9b1c68d`, `https://codex-preview-20261102.haein-church-9j8.pages.dev`). 이는 규칙 위반이었고, 이후 배포는 사용자 지시가 있을 때만 합니다.
- 정식 운영 도메인(`haein-church.kr`)은 변경하지 않았습니다.

## 다음 작업 (우선순위)

1. 메인 슬라이더 이미지 검토: 교회임이 드러나는 밝은 사진으로 교체. 사진마다 출처와 라이선스를 기록(`docs/IMAGE_CREDITS.md`).
2. 관리자 슬라이더 편집(`/admin/sliders`)은 DB 변경이 필요하므로 사용자 승인 후 진행.
3. 교회 실제 사진이 확보되면 교회 소개 슬라이드에 반영.

## 확인 명령

```bash
git fetch origin
git log --oneline -5 origin/codex/full-onmam-migration
```
