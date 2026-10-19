$token = "YOUR_FIGMA_PAT"
$key = "ZkVq6Cg81nXPfwVb20OnyT"
$hdr = @{ "X-Figma-Token" = $token }

Write-Host "Waiting 3 min for full rate limit cooldown..."
Start-Sleep -Seconds 180

# Single fetch - save to file
$url = "https://api.figma.com/v1/files/$key"
$out = "F:\SEP490_G9_CalisHealth\assets\figma-full.json"
try {
    $r = Invoke-WebRequest -Uri $url -Headers $hdr -Method Get -TimeoutSec 60 -UseBasicParsing
    Write-Host ("Status: " + $r.StatusCode)
    if ($r.StatusCode -eq 200) {
        $r.Content | Out-File -FilePath $out -Encoding utf8
        $size = (Get-Item $out).Length
        Write-Host ("Saved: " + $out + " (" + [math]::Round($size/1KB, 1) + " KB)")
        $j = $r.Content | ConvertFrom-Json
        Write-Host ("Document: " + $j.document.name)
        Write-Host ("Pages: " + $j.document.children.Count)
        foreach ($p in $j.document.children) {
            Write-Host ("  - '" + $p.name + "' id=" + $p.id)
        }
    }
} catch {
    Write-Host ("ERROR: " + $_.Exception.Message)
    if ($_.Exception.Response) {
        $s = $_.Exception.Response.GetResponseStream()
        $rdr = New-Object System.IO.StreamReader($s)
        Write-Host ("Body: " + $rdr.ReadToEnd())
    }
}
