# Ограниченный доступ к VPS

7 октября 2026 создан `mu56-deploy`. Это первый этап подготовки доставки
образов, а не уже работающий CD. Пользователь не входит в docker/sudo,
не владеет конфигурацией SSH, sudo или скриптами и не читает `/srv/projects`.

Первоначально была доступна только команда `status`. Она возвращает состояние и образ
сервисов, без журналов, окружения и паролей. Оболочка, PTY,
перенаправления портов и вход по паролю отключены. Существующий root-доступ
владельца сохранён. Для проверки используется публичная часть его ключа;
закрытый ключ не передавался на сервер или GitHub.

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_selectel_vds" -o IdentitiesOnly=yes mu56-deploy@161.104.32.37 status
```

Проверено на сервере: status возвращает работающие контейнеры; чтение
backend.env и `status; id` отклонены принудительной командой; произвольный
sudo запрещён. Прямое чтение приватного файла тоже запрещено. sshd -t
прошёл, служба SSH active, 12 HTTPS GET-проверок приложения прошли.

## Состав установки

- `/usr/local/sbin/mu56-deploy-status`: root:root 0755,
  [deploy-status.py](../deploy/docker/deploy-status.py).
- `/usr/local/sbin/mu56-deploy-ssh-entry`: root:root 0755,
  [deploy-ssh-entry.sh](../deploy/docker/deploy-ssh-entry.sh).
- `/etc/ssh/sshd_config.d/60-mu56-deploy.conf`: Match User и ForceCommand.
- `/etc/ssh/authorized_keys/mu56-deploy`: публичный ключ, root:root 0644.
  sshd читает его от имени пользователя; пользователь не может изменить файл.
- `/etc/sudoers.d/mu56-deploy`: единственная разрешённая команда
  `/usr/local/sbin/mu56-deploy-status status`, без передачи своего окружения.

[setup-deploy-access.sh](../deploy/docker/setup-deploy-access.sh) принимает
публичный Ed25519-ключ через stdin. Это первичная установка, не обновление:
повторный запуск останавливается при существующем authorized_keys. Перед
запуском установить два root-owned скрипта выше, убедиться в отсутствии
одноимённых конфигураций; проверить синтаксис и сохранить административное
SSH-соединение. Не отключать root до проверки отдельного административного
пользователя — mu56-deploy его не заменяет.

## Следующий этап

Отдельный ключ CI с теми же SSH-ограничениями; сборка проверенного commit
на GitHub; доставка образов с фиксированными digest; узкий root-owned
контроллер обновления только проекта mu56. Сохранение предыдущей версии,
проверка готовности и репетиция отката. Не предоставлять CI произвольный
sudo/docker, запись в Compose/env или root-ключ владельца. Перед обновлением
проверять миграции; откат образов не восстанавливает старую схему базы.

Основной домен и GitHub Pages не менялись. Workflow доставки и команды
release/rollback добавлены следующим этапом: [IMAGE_DELIVERY.md](IMAGE_DELIVERY.md).

Справочник ограничений ключей и ForceCommand:
[OpenSSH в Ubuntu 24.04](https://manpages.ubuntu.com/manpages/noble/man8/sshd.8.html).
