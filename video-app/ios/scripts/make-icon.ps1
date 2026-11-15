# Zeichnet das App-Symbol (1024x1024, ohne Alphakanal) nach Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png
# Aufruf: powershell -ExecutionPolicy Bypass -File scripts\make-icon.ps1
Add-Type -AssemblyName System.Drawing

$size = 1024
$target = Join-Path $PSScriptRoot '..\Resources\Assets.xcassets\AppIcon.appiconset\icon-1024.png'
$target = [System.IO.Path]::GetFullPath($target)

$bg = [System.Drawing.ColorTranslator]::FromHtml('#0B0F14')
$accent = [System.Drawing.ColorTranslator]::FromHtml('#2DD4BF')

# 24 Bit RGB: kein Alphakanal
$bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.Clear($bg)

$c = $size / 2.0

# Offener Ring: ca. 300 Grad, Luecke oben rechts, runde Enden
$radius = 330.0
$pen = New-Object System.Drawing.Pen $accent, 56
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$rect = New-Object System.Drawing.RectangleF ([single]($c - $radius)), ([single]($c - $radius)), ([single](2 * $radius)), ([single](2 * $radius))
$g.DrawArc($pen, $rect, [single]-15, [single]300)

# Wiedergabe-Dreieck mit abgerundeten Ecken (Fuellung + Kontur mit runden Ecken)
$off = 16.0
$pts = @(
  (New-Object System.Drawing.PointF ([single]($c - 110 + $off)), ([single]($c - 140))),
  (New-Object System.Drawing.PointF ([single]($c - 110 + $off)), ([single]($c + 140))),
  (New-Object System.Drawing.PointF ([single]($c + 170 + $off)), ([single]$c))
)
$brush = New-Object System.Drawing.SolidBrush $accent
$g.FillPolygon($brush, $pts)
$tpen = New-Object System.Drawing.Pen $accent, 44
$tpen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$g.DrawPolygon($tpen, $pts)

$g.Dispose()
$bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Geschrieben: $target"
