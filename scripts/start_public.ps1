$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverDir = Join-Path $root "server"
$clientDir = Join-Path $root "client"
$ngrokConfig = Join-Path $root "ngrok.yml"

function Ensure-NgrokInstalled {
    $ngrokCommand = Get-Command ngrok -ErrorAction SilentlyContinue
    if ($ngrokCommand) {
        return $ngrokCommand.Source
    }

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "ngrok nao encontrado. Instalando automaticamente..."
        & winget install --id ngrok.ngrok -e --accept-source-agreements --accept-package-agreements | Out-Null

        $ngrokCommand = Get-Command ngrok -ErrorAction SilentlyContinue
        if ($ngrokCommand) {
            return $ngrokCommand.Source
        }
    }

    throw "ngrok nao foi encontrado. Instale em https://dashboard.ngrok.com/get-started/setup"
}

function Ensure-NgrokConfig {
    if (-not (Test-Path $ngrokConfig)) {
        @'
version: "2"
authtoken: CHANGE_ME
tunnels:
  videocall-frontend:
    proto: http
    addr: 5173
  videocall-backend:
    proto: http
    addr: 4000
'@ | Set-Content -Path $ngrokConfig -Encoding UTF8
    }
}

function Ensure-NgrokAuthToken {
    param([string]$NgrokPath)

    $token = $env:NGROK_AUTHTOKEN
    if (-not $token) {
        $configContent = Get-Content $ngrokConfig -Raw
        if ($configContent -match "authtoken:\s*(.+)") {
            $token = $matches[1].Trim()
        }
    }

    if (-not $token -or $token -eq "CHANGE_ME") {
        Write-Host "Abra https://dashboard.ngrok.com/get-started/your-authtoken e copie seu token."
        $token = Read-Host "Digite seu NGROK_AUTH_TOKEN"
    }

    if (-not $token -or $token -eq "CHANGE_ME") {
        throw "Token do ngrok obrigatorio para continuar."
    }

    & $NgrokPath config add-authtoken $token | Out-Null
    $configText = Get-Content $ngrokConfig -Raw
    $updated = $configText -replace "authtoken:\s*.*", "authtoken: $token"
    Set-Content -Path $ngrokConfig -Value $updated -Encoding UTF8
}

function Start-IfNeeded {
    param(
        [string]$WorkingDir,
        [string]$Command,
        [string]$DisplayName
    )

    $processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match "powershell|cmd|node" -and $_.CommandLine -match [regex]::Escape($Command) }

    if ($processes) {
        Write-Host "$DisplayName ja esta em execucao."
        return
    }

    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$WorkingDir'; $Command" -WorkingDirectory $root | Out-Null
    Write-Host "$DisplayName iniciado."
}

try {
    Ensure-NgrokConfig
    $ngrokPath = Ensure-NgrokInstalled
    Ensure-NgrokAuthToken -NgrokPath $ngrokPath

    Write-Host "Iniciando backend..."
    Start-IfNeeded -WorkingDir $serverDir -Command "npm install; npm run dev" -DisplayName "Backend"

    Write-Host "Iniciando frontend..."
    Start-IfNeeded -WorkingDir $clientDir -Command "npm install; npm run dev -- --host 0.0.0.0" -DisplayName "Frontend"

    Start-Sleep -Seconds 8

    function Start-NgrokAutoUpdate {
        param([string]$NgrokPath, [string]$ConfigPath)

        Write-Host "Iniciando ngrok..."
        $lastOutput = (& $NgrokPath start --all --config $ConfigPath 2>&1)
        $text = ($lastOutput | Out-String)

        if ($LASTEXITCODE -ne 0 -and ($text -match "too old|minimum supported agent version|ERR_NGROK_121")) {
            Write-Host "Versao do ngrok muito antiga para esta conta. Atualizando..."
            & $NgrokPath update | Out-Null
            Start-Sleep -Seconds 5
            $lastOutput = (& $NgrokPath start --all --config $ConfigPath 2>&1)
            $text = ($lastOutput | Out-String)
        }

        if ($LASTEXITCODE -ne 0) {
            throw ($text.Trim())
        }

        $lastOutput | ForEach-Object { Write-Host $_ }
    }

    Start-NgrokAutoUpdate -NgrokPath $ngrokPath -ConfigPath $ngrokConfig
}
catch {
    Write-Error $_.Exception.Message
    Write-Host ""
    Write-Host "Se quiser, rode manualmente:"
    Write-Host "  ngrok update"
    Write-Host "  ngrok start --all --config \"$ngrokConfig\""
    Write-Host "  start_public.bat"
    exit 1
}
