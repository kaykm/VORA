# Compose production preview images exported by inspecionar-dossie.mjs.
# Windows' bundled GDI+ only adds labels. Browser UI layout is not tested.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$resultsPath = Join-Path $projectRoot 'tests/resultados'
$preview = Get-Content -LiteralPath (Join-Path $resultsPath 'dossie-previas.json') -Raw | ConvertFrom-Json
$cellWidth = 400
$cellHeight = 292
$image = [System.Drawing.Bitmap]::new($cellWidth * 4, $cellHeight * 4)
$graphics = [System.Drawing.Graphics]::FromImage($image)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#182d22'))
$titleFont = [System.Drawing.Font]::new('Arial', 13, [System.Drawing.FontStyle]::Bold)
$detailFont = [System.Drawing.Font]::new('Arial', 10)
$titleBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#edf2e9'))
$detailBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#b4c1b7'))
try {
 for ($index = 0; $index -lt $preview.shots.Count; $index++) {
  $shot = $preview.shots[$index]
  $offsetX = ($index % 4) * $cellWidth
  $offsetY = [Math]::Floor($index / 4) * $cellHeight
  $modelImage = [System.Drawing.Image]::FromFile((Join-Path $resultsPath $shot.file))
  try { $graphics.DrawImage($modelImage, [System.Drawing.Rectangle]::new($offsetX, $offsetY, $cellWidth, 218)) }
  finally { $modelImage.Dispose() }
  $graphics.DrawString($shot.name, $titleFont, $titleBrush, [single]($offsetX + 12), [single]($offsetY + 222))
  $graphics.DrawString($shot.dimensions, $detailFont, $detailBrush, [single]($offsetX + 12), [single]($offsetY + 244))
  $graphics.DrawString($shot.status, $detailFont, $detailBrush, [single]($offsetX + 12), [single]($offsetY + 264))
 }
 $targetPath = Join-Path $resultsPath 'dossie-previas.png'
 $image.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
 Write-Output "Prévias do dossiê renderizadas em $targetPath"
} finally {
 $titleBrush.Dispose(); $detailBrush.Dispose(); $titleFont.Dispose(); $detailFont.Dispose()
 $graphics.Dispose(); $image.Dispose()
}
