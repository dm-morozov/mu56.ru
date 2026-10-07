# Проверка, образы и ручная выкладка

Workflow Site checks для push в local/release-20261006 сначала проверяет
приложение, затем собирает backend/frontend на runner GitHub, публикует
ghcr.io/dm-morozov/mu56-backend и mu56-frontend при изменении исходников
приложения, Dockerfile/зависимостей или самого workflow. Только документация
и скрипты контроллера не требуют новых образов/подтверждений. Теги — полные commit SHA;
на VPS передаются digest. Рабочая база и локальные незавершённые изменения
в сборке не используются. Образы собираются с временным API из миграций CI.

Job deploy требует подтверждения dm-morozov в environment mu56-dev.
В Actions открыть текущий запуск Site checks → Review deployments →
mu56-dev → Approve and deploy. Разрешена только local/release-20261006.
По нажатию выполняется обновление одного dev.mu56.ru, основной домен
и GitHub Pages остаются прежними. Workflow_dispatch пока не используется:
default main содержит самостоятельный прежний сайт.

В environment находятся отдельный MU56_DEPLOY_KEY и закреплённый ключ
сервера MU56_HOST_KEY. Root-ключ владельца не передаётся GitHub.
GITHUB_TOKEN используется только для загрузки конкретных образов;
Docker credentials создаются во временном приватном каталоге VPS и
удаляются после pull. Токен не входит в JSON состояния релиза.

Контроллер /usr/local/sbin/mu56-release принадлежит root и принимает
строго release или rollback. Release читает ограниченный JSON через stdin;
разрешены только два точных namespace с SHA256 digest, commit 40 hex,
проверяется OCI label revision. Нет произвольной команды, пути, Compose,
порта или тома. CI не входит в docker. Пароли и env остаются root-only.

Перед заменой: проверка 4 ГиБ свободного места, migrate --check без
применения миграций, свежая ограниченная копия данных. Изменяются только
backend/frontend и уже активный worker; выключенный worker сам не включается.
Затем collectstatic и
readiness главной/API через локальный gateway. При ошибке восстанавливаются
предыдущие ссылки образов и выполняется повторная проверка готовности.
Это короткое обновление с возможным перерывом, не zero-downtime.

В /srv/projects/mu56/releases остаются current.json и previous.json,
без секретов; предыдущие образы сохраняются. Автоматический prune не
включён, расход образов нужно контролировать. База/тома не удаляются.
Откат не меняет схему БД и не стирает новые заявки/медиа. Новые миграции
требуют отдельной процедуры, доставщик останавливается при их наличии.

```powershell
ssh -i .local/deploy-access/id_ed25519_ci -o IdentitiesOnly=yes mu56-deploy@161.104.32.37 rollback
```

7 октября: первая выкладка 44ef950 прошла, возврат на прежние образы и обратно
проверен без изменений данных 22 таблиц и 27 фото. После включения worker
репетиция повторена успешно. Статус и ограничения записаны в STATUS.md.
Полный внешний HTTPS-прогон и прогрев фото после обновления выполняются
отдельно из разрешённой сети владельца. Контроллер проверяет только два URL.

Источники: [GitHub Packages с GITHUB_TOKEN](https://docs.github.com/en/packages/managing-github-packages-using-github-actions-workflows/publishing-and-installing-a-package-with-github-actions),
[публикация Docker-образов](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).
