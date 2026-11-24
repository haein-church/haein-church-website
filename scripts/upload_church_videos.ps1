# 교회 동영상 6개를 Supabase Storage에 업로드한다.
#  - 회원 전용 3개 -> church-media 버킷(비공개) 안 members/ 폴더
#  - 공개 3개      -> church-public 버킷(공개) 루트
# 원본은 프로젝트의 public/onmam-assets 에 있다(이 파일은 읽기만 한다).
# 실행 전: 같은 PowerShell 창에서 $env:SUPABASE_SERVICE_ROLE_KEY 를 설정해야 한다.
# 키 값은 이 파일이나 출력에 기록하지 않는다.

$ErrorActionPreference = 'Stop'

$key = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $key) { throw 'SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다. 이 창에서 먼저 입력하세요.' }

$host_ = 'https://ambojhrewxsxdavlmkpt.supabase.co/storage/v1/object'
$src   = Join-Path $PSScriptRoot '..\public\onmam-assets'
if (-not (Test-Path -LiteralPath $src -PathType Container)) { throw '프로젝트의 public/onmam-assets 폴더를 찾을 수 없습니다.' }

# 원본 파일명 -> 버킷, 버킷 안 경로
$map = [ordered]@{
  '11c4f85e27a2fbb6542e7cb0.mp4' = @{ bucket = 'church-media'; path = 'members/2023-06-07-special.mp4' }
  '5a3beccf4f70c2901953d9f6.mp4' = @{ bucket = 'church-media'; path = 'members/2023-05-31-special.mp4' }
  'ba3fe2fdc7adfcf1a08f4fb6.mp4' = @{ bucket = 'church-media'; path = 'members/2023-03-22-retreat-service.mp4' }
  '976dd1c2939f427535e1405e.mp4' = @{ bucket = 'church-public'; path = '2018-02-11-retreat-1.mp4' }
  '7d78422d1fde2e0e78914abd.mp4' = @{ bucket = 'church-public'; path = '2019-01-27-news.mp4' }
  '86161127cfc591870d86da79.mp4' = @{ bucket = 'church-public'; path = '2018-02-25-retreat-2.mp4' }
}

foreach ($file in $map.Keys) {
  $path = Join-Path $src $file
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "원본 파일이 없습니다: $file" }
  $target = $map[$file]
  $uri = "$host_/$($target.bucket)/$($target.path)"
  $headers = @{ Authorization = "Bearer $key"; apikey = $key; 'x-upsert' = 'true' }
  Write-Output "업로드 중: $($target.bucket)/$($target.path)"
  Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -InFile $path -ContentType 'video/mp4' | Out-Null
  Write-Output "완료: $($target.bucket)/$($target.path)"
}

Write-Output '모든 동영상 업로드가 끝났습니다.'
