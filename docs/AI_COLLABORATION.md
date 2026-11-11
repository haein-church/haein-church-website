# ChatGPT·Claude 공동 작업 연결

확인일: 2026-11-11. 같은 계정의 서비스를 사용해도 AI별 인증은 자동 공유되지 않습니다. 비밀번호나 토큰을 문서·채팅·Git에 복사하지 않습니다.

## 공통 대상과 작업 순서

- GitHub 개인 계정 `haein-church`의 `haein-church/haein-church-website`만 사용합니다.
- 현재 작업 브랜치는 `codex/full-onmam-migration`입니다. 작업 전 fetch 후 변경·충돌을 확인합니다. 다른 AI의 미커밋 변경을 덮어쓰지 않습니다.
- 소스를 검증하고 commit·push한 뒤 같은 커밋을 기존 Cloudflare Pages `haein-church`의 승인된 공유 미리보기에 수동 반영합니다.
- Cloudflare 생산·미리보기 자동 배포는 중단 상태를 유지합니다. 정식 도메인 배포는 별도 지시가 필요합니다.
- Supabase는 `haein-church's Org`의 `haein-church-website` (`ambojhrewxsxdavlmkpt`), 서울 리전만 사용합니다.
- 원본 자료는 이 컴퓨터의 `migration/onmam/`에 있습니다. GitHub만 복제한 환경에는 원본 전체가 없습니다.

## 현재 확인한 인증 상태

| 서비스 | ChatGPT 작업 환경 | Claude |
|---|---|---|
| GitHub | 현재 작업 브랜치 push 성공 (`a5b5660`) | 개인 계정에 공식 Claude 앱 미설치 확인. 해인교회 저장소 하나를 선택한 설치·승인 화면 준비. 최종 승인 및 실제 push 검증 대기 |
| Cloudflare | 이 컴퓨터 Wrangler OAuth 계정 `godls1224@naver.com`, `pages:write` 확인 | 별도 인증 상태 미확인. 같은 컴퓨터의 같은 Windows 사용자로 실행하는 CLI는 기존 Wrangler 인증을 사용할 수 있으나, Claude 실행 환경에서 `whoami` 확인 필요 |
| Supabase | 브라우저에서 지정 프로젝트 로그인·서울 리전 확인. 현재 ChatGPT Supabase 커넥터는 지정 프로젝트에 권한 오류 | 별도 MCP 인증 필요. 프로젝트 한정 `.mcp.json` 준비. 인증 및 SQL 실행 권한 미검증 |

Supabase 대시보드는 현재 `GITHUB No repository connected`로 표시됩니다. GitHub 저장소 연동과 AI의 DB 관리 인증은 서로 다른 기능입니다.

## Claude Code의 Supabase 연결

이 체크아웃의 `.mcp.json`은 지정 프로젝트로 범위를 제한하며 쓰기를 지원하는 설정입니다. 비밀 키가 없고 설정 파일만으로 권한이 부여되지는 않습니다. Claude Code에서 프로젝트 설정을 검토하고 `/mcp`를 열어 Supabase Authenticate를 실행합니다. 브라우저에서 올바른 조직과 권한을 확인·승인해야 합니다. Claude Cowork는 이 파일을 자동 사용하는 것으로 가정하지 말고 해당 앱의 커넥터 인증을 별도로 확인합니다.

연결 후 테이블 목록과 읽기 쿼리부터 확인합니다. 실제 변경은 작업 목적이 있는 migration으로 남기고 검증합니다. 권한 시험만을 위해 운영 데이터를 바꾸지 않습니다.

## Cloudflare 연결 확인

Claude가 이 컴퓨터에서 같은 사용자로 실행된다면 체크아웃에서 `node node_modules/wrangler/bin/wrangler.js whoami`로 계정과 `pages:write`를 확인합니다. 별도 격리 환경의 Claude에는 이 컴퓨터의 OAuth 토큰을 복사하지 않습니다. 해당 환경의 공식 인증 절차가 필요합니다. Pages 작업에 불필요한 Workers·DNS 권한까지 확대하지 않습니다.

## 공식 문서

- Claude GitHub 연결: https://code.claude.com/docs/en/web-quickstart
- Supabase MCP 설정·인증: https://supabase.com/docs/guides/ai-tools/mcp
- Cloudflare Wrangler 인증: https://developers.cloudflare.com/workers/wrangler/commands/#whoami
