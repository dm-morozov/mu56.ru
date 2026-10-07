# Interactive only: credentials are entered by the owner over SSH, never in a file.
$ErrorActionPreference = 'Stop'
$adminKeyPath = Join-Path $env:USERPROFILE '.ssh/id_ed25519_selectel_vds'
if (-not (Test-Path -LiteralPath $adminKeyPath -PathType Leaf)) {
    throw 'Не найден существующий SSH-ключ сервера: .ssh/id_ed25519_selectel_vds.'
}
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    throw 'Не найден клиент OpenSSH.'
}
Write-Host 'Создание учётной записи владельца в серверной Django admin.'
Write-Host 'Рекомендуемый логин: dm-morozov. Email можно оставить пустым.'
Write-Host 'Пароль вводится дважды и не отображается. Сохраните его в менеджере паролей.'
& ssh -tt -i $adminKeyPath -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 root@161.104.32.37 'cd /srv/projects/mu56 && docker compose exec backend python manage.py createsuperuser'
if ($LASTEXITCODE -ne 0) {
    throw 'Создание администратора не завершено. Проверьте сообщение терминала; существующие аккаунты не изменены.'
}
Write-Host 'Откройте https://dev.mu56.ru/admin/ и войдите с заданными логином и паролем.'
