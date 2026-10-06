# Автоматическая проверка новой версии

В GitHub работает `.github/workflows/ci.yml`. Он проверяет push и pull
request в ветках нового приложения: состав релиза, Django, отсутствие
незаписанных миграций, тесты catalog/leads, production-сборку Next.js и
TypeScript. Frontend собирается с запущенным API и каталогом из миграций,
а не с рабочей базой владельца.

Используются Ubuntu 24.04, Python 3.12.14, Node 24.18.0, pnpm 11.19.0 и
отдельный PostgreSQL 18. Python-зависимости закреплены в requirements,
frontend устанавливается с `--frozen-lockfile`. GitHub Actions закреплены
полными SHA; обновления выполняются осознанно после проверки.

У workflow только право чтения кода; сохранение Git-учётных данных выключено.
Рабочие секреты, заявки и media не загружаются. Telegram явно выключен,
worker не запускается. Указанный пароль относится только к временному
контейнеру CI. Публикация, сервер и GitHub Pages в workflow отсутствуют.

## Статус

6 октября 2026 ветка `local/release-20261006` опубликована в
`dm-morozov/mu56.ru`. Первый [запуск CI](https://github.com/dm-morozov/mu56.ru/actions/runs/37522791706)
для SHA `967809a02fc393613f7e216286d0ddbd04c37c13` завершился успешно:
установка закреплённых зависимостей, проверка состава релиза, Django и
миграции, тесты catalog/leads, production-сборка Next.js и TypeScript.
Прежняя main сохранила SHA `85ffba6cc879a7e4a4fa9cd0e6e9cb5b11ac282e`.
Сайт на сервер не выкладывался; CI не меняет GitHub Pages.

GitHub показал предупреждение о Node 20 во внутренних runtime закреплённых
actions: runner выполняет их на Node 24. Проверки прошли; обновление SHA
actions до версий с нативным Node 24 планируется отдельным изменением.

6 октября локально прошли 103 теста catalog/leads в уникальной временной
PostgreSQL-базе; база удалена тестовым runner после завершения. Telegram
выключен. Проверка состава релиза прошла для 436 файлов-кандидатов без
находок заданных сигнатур; это не аудит всей Git-истории. `diff --check`
не обнаружил ошибок пробелов. Workflow проверен actionlint 1.7.12 без
ошибок; архив валидатора сверён с опубликованным SHA256 и сохранён только
в исключённой `.local/ci-tools`. Shellcheck и pyflakes в этом проходе
не запускались. Первый полный workflow на GitHub также прошёл успешно,
как указано выше.

Справочники действий: [setup-node](https://github.com/actions/setup-node),
[setup-python](https://github.com/actions/setup-python),
[pnpm/action-setup](https://github.com/pnpm/action-setup).
