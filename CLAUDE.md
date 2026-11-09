## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## 해인교회 프로젝트 (작업 재개 시 먼저 읽기)

- 목표: 온맘닷컴에 의존하지 않는 해인교회 독립 홈페이지 구축 및 데이터 이전
- 상태 문서: `docs/PROJECT_STATUS.md` (먼저 읽기), `docs/OPEN_ISSUES.md`
- 기존 홈페이지: https://haein-church.onmam.com/ (로그인 팝업 `#loginPop`은 사용하지 않음)
- 기술 스택: Astro, Supabase, Cloudflare Pages, GitHub (명령서 기본안은 Next.js였으나 현재 구현은 Astro)
- 원본 자료: `migration/onmam/` (Git 제외, 로컬 전용). 검증은 `docs/BACKUP_VERIFICATION.md`
- 연결 대상 (비밀정보 제외): GitHub `haein-church/haein-church-website`, Cloudflare Pages `haein-church-9j8`(확인), Supabase 프로젝트 미확인
- 완료 단계: 원본 공개 자료 백업·검증, 신규 기록 반영, Astro 빌드
- 실행 명령: `docs/OPERATIONS_MANUAL.md` 참고
- 미해결 문제와 승인 대기 항목: `docs/OPEN_ISSUES.md`
- 공개 배포, 도메인 연결, 외부 서비스 생성·변경, 기존 자료 삭제는 사용자 승인 후에만 진행한다.
