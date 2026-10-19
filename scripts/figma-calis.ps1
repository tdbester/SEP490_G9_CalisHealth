$token = "YOUR_FIGMA_PAT"
$key = "I2DEmHUcXFOZYcBoG88LKQ"
$hdr = @{ "X-Figma-Token" = $token }

$out = "F:\SEP490_G9_CalisHealth\assets\figma-calis.json"
Write-Host "=== Single attempt @ " + (Get-Date -Format "HH:mm:ss") + " ==="
try {
    $r = Invoke-WebRequest -Uri "https://api.figma.com/v1/files/$key" -Headers $hdr -Method Get -TimeoutSec 60 -UseBasicParsing
    Write-Host ("Status: " + $r.StatusCode)
    if ($r.StatusCode -eq 200) {
        $r.Content | Out-File -FilePath $out -Encoding utf8
        $size = (Get-Item $out).Length
        Write-Host ("Saved: $out ($([math]::Round($size/1KB,1)) KB)")
        $j = $r.Content | ConvertFrom-Json
        Write-Host ("Document: '" + $j.document.name + "'")
        Write-Host ("Pages: " + $j.document.children.Count)
        foreach ($p in $j.document.children) {
            Write-Host ("  - '" + $p.name + "' id=" + $p.id)
            if ($p.children) {
                foreach ($c in $p.children | Select-Object -First 20) {
                    Write-Host ("      - '" + $c.name + "' id=" + $c.id + " type=" + $c.type)
                }
            }
        }
    }
} catch {
    $resp = $_.Exception.Response
    if ($resp) {
        Write-Host ("HTTP " + $resp.StatusCode)
        $s = $resp.GetResponseStream()
        $rdr = New-Object System.IO.StreamReader($s)
        Write-Host ("Body: " + $rdr.ReadToEnd())
    } else {
        Write-Host ("Err: " + $_.Exception.Message)
    }
}
