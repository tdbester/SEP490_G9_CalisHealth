$token = "YOUR_FIGMA_PAT"
$key = "ZkVq6Cg81nXPfwVb20OnyT"
$nodeId = "2012-277"
$hdr = @{ "X-Figma-Token" = $token }

# 1) Fetch node 2012-277 (the page) full tree
Write-Host "=== Fetching node $nodeId (depth 8) ==="
$u1 = "https://api.figma.com/v1/files/$key/nodes?ids=$nodeId&depth=8"
$r1 = Invoke-RestMethod -Uri $u1 -Headers $hdr -Method Get -TimeoutSec 60
$r1 | ConvertTo-Json -Depth 50 | Out-File -FilePath "F:\SEP490_G9_CalisHealth\assets\figma-node.json" -Encoding utf8
Write-Host ("Node type: " + $r1.nodes.$nodeId.document.type + " | name: " + $r1.nodes.$nodeId.document.name)

# 2) Styles (color/text/effect styles)
Write-Host "`n=== Fetching file styles ==="
$u2 = "https://api.figma.com/v1/files/$key/styles"
$r2 = Invoke-RestMethod -Uri $u2 -Headers $hdr -Method Get -TimeoutSec 30
$r2 | ConvertTo-Json -Depth 30 | Out-File -FilePath "F:\SEP490_G9_CalisHealth\assets\figma-styles.json" -Encoding utf8
Write-Host ("Styles count: " + $r2.meta.styles.Count)
$r2.meta.styles | Select-Object -First 10 key_type, name | Format-Table | Out-String | Write-Host

# 3) Render node 2012-277 to PNG (scale 2x)
Write-Host "`n=== Rendering node $nodeId to PNG (scale 2) ==="
$u3 = "https://api.figma.com/v1/images/$key`?ids=$nodeId&format=png&scale=2"
$r3 = Invoke-RestMethod -Uri $u3 -Headers $hdr -Method Get -TimeoutSec 60
Write-Host ("Image URL: " + $r3.images.$nodeId)
if ($r3.images.$nodeId) {
    $pngUrl = $r3.images.$nodeId
    $pngPath = "F:\SEP490_G9_CalisHealth\assets\figma-page-2012-277.png"
    Invoke-WebRequest -Uri $pngUrl -OutFile $pngPath -UseBasicParsing
    $size = (Get-Item $pngPath).Length
    Write-Host ("Saved: " + $pngPath + " (" + $size + " bytes)")
}

Write-Host "`nDONE"
