
# Test script for profile and survey endpoints
$baseUrl = "http://localhost:8080"
$memberEmail = "demo.member@calishealth.com"
$memberPassword = "Test@123"

Write-Host "=== CalisHealth API Test ===" -ForegroundColor Green

# Test 1: Login
Write-Host "`n1. Testing LOGIN endpoint..."
$loginBody = @{email=$memberEmail; password=$memberPassword} | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body $loginBody `
  -UseBasicParsing `
  -ErrorAction SilentlyContinue

if ($loginResp.StatusCode -eq 200) {
  $loginData = $loginResp.Content | ConvertFrom-Json
  $token = $loginData.accessToken
  Write-Host "SUCCESS: Login successful (200)" -ForegroundColor Green
  Write-Host "  Token: $($token.Substring(0, 40))..."
  
  # Test 2: Profile GET
  Write-Host "`n2. Testing GET /api/profile endpoint..."
  $profileResp = Invoke-WebRequest -Uri "$baseUrl/api/profile" `
    -Method GET `
    -Headers @{Authorization = "Bearer $token"} `
    -UseBasicParsing `
    -ErrorAction SilentlyContinue
  
  if ($profileResp.StatusCode -eq 200) {
    $profile = $profileResp.Content | ConvertFrom-Json
    Write-Host "SUCCESS: Profile retrieved (200)" -ForegroundColor Green
    Write-Host "  Email: $($profile.email)"
    Write-Host "  Role: $($profile.role)"
    Write-Host "  Member Level: $($profile.member.levelName)"
    Write-Host "  Days Per Week: $($profile.member.daysPerWeek)"
  } else {
    Write-Host "FAILED: Profile GET error $($profileResp.StatusCode)" -ForegroundColor Red
    Write-Host $profileResp.Content
  }
  
  # Test 3: Start Survey Session
  Write-Host "`n3. Testing POST /api/survey-sessions (Start Survey)..."
  $sessionBody = @{surveyCode="CALISHEALTH_ONBOARDING"} | ConvertTo-Json
  $sessionResp = Invoke-WebRequest -Uri "$baseUrl/api/survey-sessions" `
    -Method POST `
    -Headers @{Authorization = "Bearer $token"} `
    -ContentType "application/json" `
    -Body $sessionBody `
    -UseBasicParsing `
    -ErrorAction SilentlyContinue
  
  if (($sessionResp.StatusCode -eq 201) -or ($sessionResp.StatusCode -eq 200)) {
    $session = $sessionResp.Content | ConvertFrom-Json
    $sessionId = $session.id
    Write-Host "SUCCESS: Survey session started ($($sessionResp.StatusCode))" -ForegroundColor Green
    Write-Host "  Session ID: $sessionId"
    Write-Host "  Status: $($session.status)"
  } else {
    Write-Host "FAILED: Survey session error $($sessionResp.StatusCode)" -ForegroundColor Red
    Write-Host $sessionResp.Content
  }
  
} else {
  Write-Host "FAILED: Login error $($loginResp.StatusCode)" -ForegroundColor Red
  Write-Host $loginResp.Content
}

Write-Host "`nTest Complete" -ForegroundColor Green
