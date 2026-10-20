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
