# Docker-развёртывание одной версии mu56.ru

Compose-проект `mu56` находится на VPS в `/srv/projects/mu56`. Первоначальный
адрес — `dev.mu56.ru`; основной домен остаётся на прежнем GitHub Pages.
Постоянный второй экземпляр приложения не запускается.

## Состав

PostgreSQL, Django/Gunicorn, Next.js и внутренний Nginx запускаются отдельно.
Django и Next.js разделяют сетевое пространство внутреннего шлюза и слушают
только localhost. Единственный порт Compose — `127.0.0.1:18080`.
Общий системный Nginx принимает HTTPS и передаёт запросы этому порту.
Другому сайту нужны собственный Compose-проект, сеть, порт и volumes.

Приложения работают от UID 10001, без Linux capabilities, с read-only корнем
и отдельными постоянными volumes. База, загруженные фотографии и кэш сохраняются
при пересоздании контейнеров. Telegram worker выключен профилем; уведомления
не отправляются, пока не настроены и не проверены отдельно.

## Первая установка

Собирать образы на рабочем компьютере или CI, не на VPS с 2 ГБ RAM:

```sh
docker build -f deploy/docker/backend.Dockerfile -t mu56-backend:RELEASE .
docker build -f deploy/docker/frontend.Dockerfile -t mu56-frontend:RELEASE .
docker save -o images.tar mu56-backend:RELEASE mu56-frontend:RELEASE
```

Копировать только конфигурацию из `deploy/docker` и архив образов.
`ai-context`, `.local`, рабочая БД и секреты не входят в build context.
Образы приложения содержат публичные изображения из frontend; изменения
этих изображений требуют новой сборки. Загруженные фотографии Django — volume.

В приватной папке VPS выполнить `python3 prepare_env.py . --host dev.mu56.ru`.
Скрипт создаёт новые пароли локально на сервере и отказывается перезаписывать
существующие настройки. В `.env` задать BACKEND_IMAGE, FRONTEND_IMAGE,
DATABASE_IMAGE, GATEWAY_IMAGE и SITE_HOST; образы PostgreSQL/Nginx фиксировать
по проверенным digest. Файлы `*.env`, `.env` и `bootstrap-role.sql` не публиковать.

```sh
docker load -i images.tar
docker compose config --quiet
docker compose up -d database gateway
docker compose run --rm storage-init
docker compose exec -T database psql -U bootstrap -d mu56 -v ON_ERROR_STOP=1 < bootstrap-role.sql
docker compose run --rm backend python manage.py migrate --noinput
# Только в пустую БД: каталог без заявок, пользователей и очереди.
docker compose run --rm -v /srv/projects/mu56/catalog:/catalog:ro backend python manage.py import_catalog /catalog --replace-migration-defaults
docker compose run --rm backend python manage.py collectstatic --noinput
docker compose up -d backend frontend
```

Импортировать только bundle с manifest и проверенными контрольными суммами.
Исторические фотографии скрытых персонажей остаются скрытыми; перенос
каталога не меняет is_listed. Архив каталога держать вне публичных volume.

Внешний Nginx: `edge-http.conf` для ACME, затем `edge-https.conf.example`.
Заменить ALLOWED_IP на сеть владельца. Проверить nginx -t перед reload.
Let's Encrypt webroot `/var/lib/letsencrypt`; после продления сертификата
выполнять проверку и reload Nginx через deploy hook Certbot.

## Проверка и обновление

`python scripts/check_staging.py https://dev.mu56.ru` проверяет только GET,
страницы, непустой API, noindex, robots и пустой sitemap. Отдельно проверить
сохранение заявки с CSRF, фотографии и серверный расчёт цены.
Доступ ограничен IP: при смене сети добавить новый согласованный адрес.

До следующего обновления сохранить резерв БД/media вне VPS, проверить
восстановление, записать SHA исходников и image ID. Загрузить новые образы,
сохранить предыдущую .env и только потом заменить ссылки на образы.
Миграции выполнять осознанно: возврат старого образа не откатывает схему.
Не применять `docker compose down -v` и глобальный prune.

Это первоначальная ручная выкладка. Автоматическая сборка/доставка Docker
образов, ограниченный deploy-пользователь, внешние резервы и репетиция
отката остаются следующими этапами. Переключение mu56.ru согласуется отдельно.
