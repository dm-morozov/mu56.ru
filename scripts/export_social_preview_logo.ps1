param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent)
)

# Compose the original brand artwork without redrawing its kite or lettering.
Add-Type -AssemblyName System.Drawing
$mediaPath = Join-Path $ProjectRoot 'frontend/public/media'
$banner = [System.Drawing.Bitmap]::new((Join-Path $mediaPath 'social-preview-20261008-v3.jpg'))
$logo = [System.Drawing.Bitmap]::new((Join-Path $mediaPath 'logo.png'))
$graphics = [System.Drawing.Graphics]::FromImage($banner)
$brush = [System.Drawing.SolidBrush]::new($banner.GetPixel(350, 100))
try {
    $graphics.FillRectangle($brush, 30, 25, 335, 150)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($logo, [System.Drawing.Rectangle]::new(48, 60, 300, 86))
    $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
    $parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
    try {
        $parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]95)
        $banner.Save((Join-Path $mediaPath 'social-preview-20261008-v5.jpg'), $encoder, $parameters)
    } finally {
        $parameters.Dispose()
    }
} finally {
    $brush.Dispose()
    $graphics.Dispose()
    $logo.Dispose()
    $banner.Dispose()
}
