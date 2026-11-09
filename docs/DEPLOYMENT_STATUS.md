# 배포 상태 (DEPLOYMENT_STATUS)

- 갱신일: 2026-11-09

| 항목 | 상태 | 비고 |
|---|---|---|
| 로컬 빌드 | 구현 완료 및 테스트 통과 | `astro build` 835 페이지 |
| 로컬 점검 | 테스트 통과 | `scripts/check_local_site.py`: 누락 링크 0, noindex 적용 |
| Cloudflare Pages | 자동 배포 중지 상태 | `migration/README.md`에 따라 공개 배포 금지 |
| 과거 배포 기록 | 확인됨 | 프로젝트 `haein-church-9j8`, 2026-11-02 미리보기 배포 기록 (로그 기준) |
| 운영 공개 | 사용자 승인 대기 | 승인 없이 공개하지 않음 |
| GitHub push | 할 내용 없음 | 추적 중인 변경 없음 (데이터는 Git 제외) |

로컬 확인 방법은 `migration/README.md`의 `START-LOCAL.cmd` 항목을 참고한다.
