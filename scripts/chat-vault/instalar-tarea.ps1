# 02-nov · CHAT de /nuevo · ADENDA 3 · registra la tarea de Windows que sincroniza el vault al chat cada 3 minutos.
# NO se ejecuta hasta que: (1) CC3 certifique, (2) quien aplica base haya creado chat_vault_docs. Reversa: .\instalar-tarea.ps1 -Quitar
# La llave de servicio NO se guarda aquí: la tarea la pide a Doppler en cada corrida (Doppler debe estar iniciado en esta computadora).
param([switch]$Quitar)
$nombre = 'ZeroRisk-SincronizarVaultChat'
if ($Quitar) { Unregister-ScheduledTask -TaskName $nombre -Confirm:$false -ErrorAction SilentlyContinue; Write-Host "tarea quitada"; exit 0 }
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$cmd = "doppler run -p zero-risk -c prd -- node scripts/chat-vault/sincronizar.mjs >> `"$env:LOCALAPPDATA\zero-risk-chat-vault.log`" 2>&1"
$accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -Command `"Set-Location '$repo'; $cmd`""
$disparador = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 3)
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $disparador -Settings $ajustes -Description 'Sincroniza el vault (lista blanca, sin secretos) a Supabase para el chat de /nuevo' -Force | Out-Null
Write-Host "tarea registrada: cada 3 minutos"
