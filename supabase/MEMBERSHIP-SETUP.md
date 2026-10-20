# 회원가입 · 승인 · 개인정보 보호 설정

현재 구현은 로컬 코드입니다. 실제 Supabase 프로젝트에 아래 SQL을 적용하고 환경변수를 연결하기 전에는 가입·승인이 작동하지 않습니다. 인터넷 배포는 별도 지시가 있을 때만 진행합니다.

## 연결 순서

1. 지정된 `haein-church-website` 프로젝트를 Seoul (`ap-northeast-2`)에 생성합니다.
2. 기존 소식/갤러리 테이블·Storage 설정이 있다면 먼저 준비하고, `migrations/202610200002_membership_approval.sql`을 한 번 적용합니다. SQL은 기존 신청을 삭제하지 않습니다. 과거 이메일 신청은 `user_id`가 없는 경우 자동 승인하지 않으며 담당자가 확인해야 합니다.
3. Auth 설정에서 이메일/비밀번호 가입 및 **이메일 인증**을 켭니다. 최소 비밀번호 길이를 12자로 설정합니다. 가입 API의 속도 제한을 유지하고 실제 공개 전에 CAPTCHA와 SMTP를 구성합니다.
4. 로컬 테스트 시 Auth Site URL은 `http://127.0.0.1:4321`, 허용 Redirect URL은 `http://127.0.0.1:4321/membership/`로 설정합니다. 향후 공개 시에는 승인받은 실제 HTTPS 주소만 추가합니다.
5. `.env`에 해당 프로젝트의 `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`를 저장합니다. 공개용 anon/publishable 키만 사용합니다. **service-role/secret 키를 PUBLIC 변수나 GitHub에 넣지 않습니다.** `.env*`는 예시 파일 외에 Git에서 제외합니다.
6. 담당자가 확인한 관리자 계정을 Auth에 만들고 이메일 인증을 완료합니다. SQL Editor에서 확인된 UUID만 `private.church_admins(user_id)`에 등록합니다. 이메일·UUID를 코드에 하드코딩하지 않습니다. 최초 가입자를 자동 관리자로 지정하지 않습니다. 관리자 등록은 별도 권한 부여이므로 실제 적용 직전에 계정을 확인합니다.

```sql
-- 실제 담당자의 확인된 Auth UUID를 대입하여 SQL Editor에서만 실행합니다.
insert into private.church_admins(user_id) values ('확인된-관리자-UUID');
```

## 동작과 보호 범위

- `/join/`: 이름·이메일·비밀번호, 선택 가입 인사, 수집 이용 동의. Supabase Auth 계정 생성 트리거가 승인 대기 신청을 만들고 동의 시각을 기록합니다. 개인정보와 비밀번호를 브라우저 로그나 Git 파일에 남기지 않습니다.
- `/login/` → 일반 회원은 `/membership/`, 지정 관리자는 `/admin/`. 이메일 인증과 교회 가입 승인은 별도입니다. 로그인했다고 관리자 또는 승인 회원이 되지 않습니다.
- `/admin/`: 대기/승인/거절 필터, 대기 건수, 승인·거절 처리, 처리 시각. 목록의 가입 인사는 HTML로 실행하지 않고 문자로 표시합니다.
- DB RLS: 비로그인 사용자는 신청 테이블에 접근할 수 없습니다. 일반 회원은 자기 신청만 읽을 수 있습니다. 사용자에게 신청 INSERT/UPDATE/DELETE 권한을 주지 않습니다. 관리자 명단은 private 스키마에 두고 클라이언트에서 읽거나 수정하지 못하게 합니다.
- `review_join_request` RPC: 실제 관리자 여부, 이메일 인증, 대기 상태를 검사하고 행 잠금으로 중복 처리를 방지합니다. 상태·처리자·처리 시각을 함께 기록합니다. `is_approved_member()`는 향후 회원 전용 자료 정책에 사용할 수 있습니다. 기존 공개 게시판의 공개 범위는 바꾸지 않습니다.
- 기존 소식/갤러리와 해당 이미지 버킷의 쓰기 작업에도 관리자 제한을 추가합니다. 해당 테이블을 나중에 새로 만들면 관리자 제한 정책을 함께 구성해야 합니다. 기존 허용 정책과 권한이 없으면 이 migration만으로 쓰기 권한이 새로 생기지 않습니다.
- 기존 `approve-member` 함수는 검증된 사용자의 JWT로 같은 RPC를 호출하며 service-role을 사용하지 않습니다. 새 관리자 화면은 RPC를 직접 사용하므로 Edge 함수 배포가 필수는 아닙니다.

## 운영 전에 남은 확인

실제 Supabase 설정·초기 관리자 지정·이메일 발송은 아직 적용되지 않았습니다. 실제 연결 후 별도 시험 계정으로 이메일 인증 → 승인 대기 → 관리자 승인/거절 → 본인 상태 조회를 확인해야 합니다. 관리자 Supabase/GitHub/Cloudflare 계정에는 MFA를 적용하고 접근자를 최소화합니다. 탈퇴·삭제 요청은 관리자가 Auth 계정과 관련 데이터를 함께 처리하고, 백업 보관 기간·개인정보처리방침·문의 창구는 운영자가 확정해야 합니다. 현재 동의 안내는 운영 전 검토가 필요한 초안입니다.

테스트: `node --test scripts/test_membership.mjs`. 로컬 임시 PostgreSQL(PGlite)에서 가상 계정만 생성하며 원격 서비스에는 연결하지 않습니다.

구현 근거: [Supabase 사용자 데이터와 RLS](https://supabase.com/docs/guides/auth/managing-user-data), [서버에서 사용자 검증](https://supabase.com/docs/reference/javascript/auth-getuser).
