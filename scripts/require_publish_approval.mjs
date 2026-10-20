if (process.env.HAEIN_ALLOW_PUBLISH !== '1') {
  console.error('인터넷 배포가 비활성화되어 있습니다. 사용자의 명시적인 배포 요청 전에는 로컬에서만 작업하세요.');
  process.exit(1);
}
