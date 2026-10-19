$token = "YOUR_FIGMA_PAT"
$key = "ZkVq6Cg81nXPfwVb20OnyT"

Write-Host "=== /v1/me ==="
try {
    $me = Invoke-RestMethod -Uri "https://api.figma.com/v1/me" -Headers @{ "X-Figma-Token" = $token } -Method Get -TimeoutSec 20
    Write-Host ("User: " + $me.email + " | id=" + $me.id)
} catch {
    Write-Host ("ME ERROR: " + $_.Exception.Message)
}

Write-Host "`n=== Test file $key ==="
$urls = @(
    "https://api.figma.com/v1/files/$key",
    "https://api.figma.com/v1/files/$key`?depth=1"
)
foreach ($u in $urls) {
    Write-Host ("URL: " + $u)
    try {
        $r = Invoke-WebRequest -Uri $u -Headers @{ "X-Figma-Token" = $token } -Method Get -TimeoutSec 30 -UseBasicParsing
        Write-Host ("Status: " + $r.StatusCode)
        if ($r.StatusCode -eq 200) {
            $j = $r.Content | ConvertFrom-Json
            Write-Host ("File: " + $j.name + " | lastModified: " + $j.lastModified)
            $r.Content | Out-File -FilePath "F:\SEP490_G9_CalisHealth\assets\figma-file.json" -Encoding utf8
            Write-Host ("Saved to assets\figma-file.json")
        }
    } catch {
        $resp = $_.Exception.Response
        if ($resp) {
            Write-Host ("HTTP " + $resp.StatusCode)
            $stream = $resp.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            Write-Host ("Body: " + $reader.ReadToEnd())
        } else {
            Write-Host ("Error: " + $_.Exception.Message)
            Write-Host ("FullException: " + $_.Exception.ToString())
        }
    }
    Write-Host "---"
}
