# 데이터베이스 설계 (DATABASE_SCHEMA)

- 갱신일: 2026-11-09
- 상태: 기존 마이그레이션 파일을 기준으로 정리. 실제 Supabase 적용 상태는 **미확인** (대상 프로젝트 확인 필요).

## 기존 마이그레이션 파일

- `supabase/migrations/202610200001_onmam_staging.sql`: 온맘 자료 스테이징
- `supabase/migrations/202610200002_membership_approval.sql`: 회원 가입 승인
- `supabase/migrations/20261102022722_online_cms_and_slides.sql`: 온라인 CMS, 슬라이드

파일 내용은 이 문서 작성 시점에 전부 검토하지 않았다. 테이블 목록은 적용 전에 파일을 열어 확인해야 한다.

## 명령서 기준 필요 테이블 (검토 대상)

site_settings, menus, pages, boards, posts, post_attachments, media_files, categories, admin_users, user_roles, audit_logs, migration_records

## 반드시 고려할 항목

- 원본 게시글 ID와 신규 ID 매핑 (`migration_records`)
- 원본 URL 매핑
- 메뉴 계층 관계
- 게시판별 권한
- 공개·비공개 설정
- 파일과 게시글 연결
- 작성일·수정일 보존
- 중복 방지 (원본 게시판 ID + 원본 글 ID 유니크 키 권장)
- 관리자 작업 이력
- 재실행 가능성 (업서트 기준)

## 보안

- 모든 테이블 RLS 기본 활성화
- 공개 조회는 공개 게시글에만 제한 SELECT
- 비공개 게시글과 회원 개인정보는 공개 API로 조회 불가
- `service_role` 키는 프런트엔드에 두지 않음
