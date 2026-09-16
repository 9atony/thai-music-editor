param(
    [string]$Source = (Join-Path $PSScriptRoot '..\resources\icon.png')
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourcePath = (Resolve-Path $Source).Path
$resRoot = Join-Path $projectRoot 'android\app\src\main\res'

$densitySizes = [ordered]@{
    mdpi = 48
    hdpi = 72
    xhdpi = 96
    xxhdpi = 144
    xxxhdpi = 192
}

$sourceImage = [System.Drawing.Bitmap]::FromFile($sourcePath)

try {
    # The supplied artwork contains generous white space. Crop to the mark before
    # adding Android-safe padding so the logo stays readable without being clipped.
    $crop = [System.Drawing.Rectangle]::new(70, 425, 1115, 375)

    function Save-LauncherBitmap {
        param(
            [int]$Size,
            [double]$LogoWidthRatio,
            [bool]$TransparentBackground,
            [string]$OutputPath
        )

        $bitmap = [System.Drawing.Bitmap]::new(
            $Size,
            $Size,
            [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
        )
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $imageAttributes = $null

        try {
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

            if ($TransparentBackground) {
                $graphics.Clear([System.Drawing.Color]::Transparent)
                $imageAttributes = [System.Drawing.Imaging.ImageAttributes]::new()
                $imageAttributes.SetColorKey(
                    [System.Drawing.Color]::FromArgb(245, 245, 245),
                    [System.Drawing.Color]::FromArgb(255, 255, 255)
                )
            } else {
                $graphics.Clear([System.Drawing.Color]::White)
            }

            $targetWidth = [int][Math]::Round($Size * $LogoWidthRatio)
            $targetHeight = [int][Math]::Round($targetWidth * $crop.Height / $crop.Width)
            $targetX = [int][Math]::Round(($Size - $targetWidth) / 2)
            $targetY = [int][Math]::Round(($Size - $targetHeight) / 2)
            $target = [System.Drawing.Rectangle]::new($targetX, $targetY, $targetWidth, $targetHeight)

            if ($null -ne $imageAttributes) {
                $graphics.DrawImage(
                    $sourceImage,
                    $target,
                    $crop.X,
                    $crop.Y,
                    $crop.Width,
                    $crop.Height,
                    [System.Drawing.GraphicsUnit]::Pixel,
                    $imageAttributes
                )
            } else {
                $graphics.DrawImage($sourceImage, $target, $crop, [System.Drawing.GraphicsUnit]::Pixel)
            }

            $directory = Split-Path -Parent $OutputPath
            New-Item -ItemType Directory -Force -Path $directory | Out-Null
            $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            if ($null -ne $imageAttributes) {
                $imageAttributes.Dispose()
            }
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }

    foreach ($entry in $densitySizes.GetEnumerator()) {
        $directory = Join-Path $resRoot ("mipmap-{0}" -f $entry.Key)
        $legacySize = [int]$entry.Value
        $foregroundSize = [int]($legacySize * 2.25)

        Save-LauncherBitmap -Size $legacySize -LogoWidthRatio 0.84 -TransparentBackground $false -OutputPath (Join-Path $directory 'ic_launcher.png')
        Save-LauncherBitmap -Size $legacySize -LogoWidthRatio 0.84 -TransparentBackground $false -OutputPath (Join-Path $directory 'ic_launcher_round.png')
        Save-LauncherBitmap -Size $foregroundSize -LogoWidthRatio 0.72 -TransparentBackground $true -OutputPath (Join-Path $directory 'ic_launcher_foreground.png')
    }

    Save-LauncherBitmap -Size 512 -LogoWidthRatio 0.84 -TransparentBackground $false -OutputPath (Join-Path $projectRoot 'resources\icon-512.png')
} finally {
    $sourceImage.Dispose()
}

Write-Output 'Android launcher icons generated from resources/icon.png'
