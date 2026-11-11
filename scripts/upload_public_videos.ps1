# 공개 동영상 3개를 Supabase Storage 공개 버킷(church-public)에 업로드한다.
# 실행 전: 같은 PowerShell 창에서 $env:SUPABASE_SERVICE_ROLE_KEY 를 설정해야 한다.
# 키 값은 이 파일이나 출력에 기록하지 않는다.

$ErrorActionPreference = 'Stop'

$key = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $key) { throw 'SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다. 이 창에서 먼저 입력하세요.' }

$base = 'https://ambojhrewxsxdavlmkpt.supabase.co/storage/v1/object/church-public'
$src  = Join-Path $PSScriptRoot '..\migration\onmam\excluded-videos-full'
if (-not (Test-Path -LiteralPath $src -PathType Container)) { throw '프로젝트의 migration/onmam/excluded-videos-full에 원본 영상을 준비하세요.' }

# 원본 파일명 -> 공개 버킷 안 경로
$map = [ordered]@{
  '976dd1c2939f427535e1405e.mp4' = '2018-02-11-retreat-1.mp4'
  '86161127cfc591870d86da79.mp4' = '2018-02-25-retreat-2.mp4'
  '7d78422d1fde2e0e78914abd.mp4' = '2019-01-27-news.mp4'
}

foreach ($file in $map.Keys) {
  $path = Join-Path $src $file
  $dest = $map[$file]
  $headers = @{ Authorization = "Bearer $key"; apikey = $key; 'x-upsert' = 'true' }
  Write-Output "업로드 중: $dest"
  Invoke-RestMethod -Method Post -Uri "$base/$dest" -Headers $headers -InFile $path -ContentType 'video/mp4' | Out-Null
  Write-Output "완료: $dest"
}

Write-Output '공개 동영상 업로드가 끝났습니다.'
