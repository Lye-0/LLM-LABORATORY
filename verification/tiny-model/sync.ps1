$ErrorActionPreference = 'Stop'
$previousEnvironment = [Environment]::GetEnvironmentVariable('UV_PROJECT_ENVIRONMENT', 'Process')
try {
    $env:UV_PROJECT_ENVIRONMENT = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) '.cache/tiny-model-venv-uv')
    uv python install 3.12.15
    if ($LASTEXITCODE -ne 0) { throw 'Pythonの準備に失敗しました。' }
    uv sync --project $PSScriptRoot --python 3.12.15 --managed-python --locked
    if ($LASTEXITCODE -ne 0) { throw '依存環境の再現に失敗しました。' }
} finally {
    [Environment]::SetEnvironmentVariable('UV_PROJECT_ENVIRONMENT', $previousEnvironment, 'Process')
}
