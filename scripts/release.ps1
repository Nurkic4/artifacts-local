$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    npm run package
    if ($LASTEXITCODE -ne 0) { throw 'Artifacts packaging failed; see the build output.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    Add-Type -AssemblyName System.IO.Compression
    foreach ($edition in @('standalone', 'codex-plugin')) {
        $source = Join-Path $projectRoot "dist/$edition"
        $archive = Join-Path $projectRoot "dist/artifacts-$edition-0.1.0.zip"
        if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive }
        $zip = [System.IO.Compression.ZipFile]::Open($archive, [System.IO.Compression.ZipArchiveMode]::Create)
        try {
            Get-ChildItem -LiteralPath $source -File -Recurse -Force | ForEach-Object {
                $entryName = $_.FullName.Substring($source.Length + 1).Replace('\', '/')
                if ($entryName -notmatch '(^|/)\.artifacts/') {
                    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
                }
            }
        } finally {
            $zip.Dispose()
        }
        Write-Output $archive
    }
} finally {
    Pop-Location
}
