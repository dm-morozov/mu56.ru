# Мир Улыбок — mu56.ru

Подготовка Linux-размещения, службы Django/Next/Telegram, HTTPS и проверки: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Обычный локальный запуск Windows описан ниже.

Готовы Django-каталог, админка, публичный API, страницы и сохранение заявок. PostgreSQL и уведомления владельцу в Telegram подключены локально. Календарь ещё не подключён. Живой mu56.ru не изменён.

## Основа

Перенос каталога без тестовых заявок и серверные копии данных: [docs/DATA_TRANSFER.md](docs/DATA_TRANSFER.md), [docs/BACKUPS.md](docs/BACKUPS.md).

Полная локальная проверка Linux через Docker Desktop: `./scripts/check_linux_stack.ps1`. Изолированная база, production build, HTTPS, заявка и восстановление; основной сайт не переключается. Инструкция и ограничения: [docs/LINUX_QA.md](docs/LINUX_QA.md).

Python 3.12+, Django 5.2 LTS, Django REST Framework, PostgreSQL и Psycopg 3. Django 5.2 поддерживается до апреля 2028: [официальная таблица](https://www.djangoproject.com/download/). Зависимости закреплены в `backend/requirements.txt`. Фронтенд использует React, TypeScript, Next.js и Redux Toolkit.

Реализованы персонажи, предложения, тарифы, этапы пакетов и контакты. Существующие записи при повторном наполнении не перезаписываются. Цены неизвестных дополнений не придуманы; женские роли остаются с отметкой «Доступность уточняйте». Новые тарифы шоу после трансформеров подтверждены владельцем 30.09.2026.

## Быстрый локальный запуск в PowerShell

**Для ежедневных правок с 9 октября используйте Docker Desktop:** проект
`mu56-local`, сайт http://127.0.0.1:3000/, админка http://127.0.0.1:8001/admin/.
Окружение создано, исходники подключены напрямую, правки подхватываются без
выкладки. После запуска Docker ранее работающие контейнеры запускаются снова.
Команды и различия баз: [docs/LOCAL_DOCKER.md](docs/LOCAL_DOCKER.md).

```powershell
.\scripts\dev_docker.ps1 Start
```

Ниже сохранена прежняя инструкция запуска процессов Windows. Не запускайте
одновременно её frontend на 3000 и Docker frontend на том же порту.

Для обычного запуска после перезагрузки компьютера откройте **два терминала PowerShell**. Окружение `.venv`, зависимости фронтенда и база уже подготовлены в этой рабочей папке. Активация `.venv` не обязательна: команды обращаются к её Python напрямую.

**Терминал 1 — PostgreSQL и Django:**

```powershell
cd C:\GitHub\mu56.ru
.\scripts\dev_postgres.ps1 Start
.\.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000
```

**Терминал 2 — сайт из последней сборки:**

```powershell
cd C:\GitHub\mu56.ru
npm.cmd --prefix frontend run start
```

Сайт: [http://127.0.0.1:3000/](http://127.0.0.1:3000/). Админка: [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/).

Оставляйте оба терминала работающими. `127.0.0.1` открывает сайт только на этом компьютере. Для остановки нажмите `Ctrl+C` в соответствующем терминале. Закрытие терминалов или перезагрузка компьютера может остановить серверы; тогда повторите запуск. Один сервер должен занимать один порт: если порт уже занят, сначала проверьте терминал с ранее запущенным процессом.

`npm.cmd` установлен вместе с Node.js и доступен в обычном PowerShell. `pnpm` был доступен в среде Codex, но в пользовательском терминале может отсутствовать; для запуска готового проекта он не нужен. Активация Python-окружения не устанавливает Node.js или `pnpm`.

### Замена фотографий персонажей

Заменяйте PNG в `frontend/public/media/characters`, сохраняя имя файла и прозрачность. В режиме `start` после замены остановите фронтенд (`Ctrl+C`), выполните `npm.cmd --prefix frontend run build`, затем `npm.cmd --prefix frontend run start`. Фотографии подключены через статические импорты: содержимое нового файла получает новый адрес при сборке, поэтому прежняя уменьшенная копия из кеша не подставляется вместо него. Простого обновления страницы до пересборки недостаточно. Резервные копии с другими именами не подключаются автоматически.

**Терминал 3 — уведомления Telegram, если нужно получать заявки:**

```powershell
cd C:\GitHub\mu56.ru
.\scripts\dev_telegram.ps1 Worker
```

Бот уже настроен локально. Обработчик отправляет ожидающие уведомления владельцу; без него заявки сохраняются в админке, а отправка ждёт запуска обработчика. Этот терминал также оставляйте работающим. Повторная настройка бота при каждом запуске не требуется. Подробнее: [docs/TELEGRAM.md](docs/TELEGRAM.md).

## Первоначальная подготовка Django

Следующие команды нужны при подготовке новой базы или обновлении схемы/начального наполнения, а не при каждом открытии сайта. `createsuperuser` создаёт новую учётную запись; существующую повторно создавать не нужно.

На этом компьютере подготовлен отдельный PostgreSQL на порту 55456. Его база и случайный локальный пароль находятся в `.local/`, вне Git. Скрипт рассчитан на установленный PostgreSQL 18 по стандартному пути; существующая служба компьютера не изменяется. В первом запуске процесса вне ограниченной среды может понадобиться разрешение Codex.

```powershell
cd C:\GitHub\mu56.ru
& .\scripts\dev_postgres.ps1 Start
.\.venv\Scripts\python.exe backend\manage.py migrate
.\.venv\Scripts\python.exe backend\manage.py seed_catalog
.\.venv\Scripts\python.exe backend\manage.py seed_offering_content
.\.venv\Scripts\python.exe backend\manage.py seed_character_content
.\.venv\Scripts\python.exe backend\manage.py seed_character_photos
.\.venv\Scripts\python.exe backend\manage.py seed_editorial
.\.venv\Scripts\python.exe backend\manage.py createsuperuser
.\.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000
```

В новом терминале `dev_postgres.ps1 Load` загружает параметры подключения, `Stop` останавливает только отдельный кластер. Этот локальный пользователь — владелец тестового кластера; на сервере использовать отдельного пользователя приложения с ограниченными правами.

Альтернатива для первого просмотра — локальная SQLite, без PostgreSQL. Это режим разработки, а не основная база проекта.

```powershell
cd C:\GitHub\mu56.ru
# Окружение .venv уже создано в этой рабочей папке.
$env:DJANGO_USE_SQLITE = '1'
.\.venv\Scripts\python.exe backend\manage.py migrate
.\.venv\Scripts\python.exe backend\manage.py seed_catalog
.\.venv\Scripts\python.exe backend\manage.py seed_offering_content
.\.venv\Scripts\python.exe backend\manage.py seed_character_content
.\.venv\Scripts\python.exe backend\manage.py seed_character_photos
.\.venv\Scripts\python.exe backend\manage.py seed_editorial
.\.venv\Scripts\python.exe backend\manage.py createsuperuser
.\.venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000
```

Админка: http://127.0.0.1:8000/admin/. Логин и пароль задаются локально командой `createsuperuser`. Учётная запись с готовым паролем в проект не добавлена. `/health/` проверяет ответ приложения, а не соединение с базой или доставку заявок.

Если окружение нужно создать заново, используйте установленный Python:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

На текущем компьютере путь Python 3.13 в системном launcher оказался нерабочим. Окружение создано на доступном Python 3.12.14 из встроенного runtime Codex; это локальная особенность, не требование сервера.

## Подключение PostgreSQL

Создайте отдельные базу `mu56` и пользователя с правами на неё, затем задайте параметры в своём терминале. Не публикуйте пароль в чате или репозитории.

```powershell
Remove-Item Env:DJANGO_USE_SQLITE -ErrorAction SilentlyContinue
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '5432'
$env:PGDATABASE = 'mu56'
$env:PGUSER = 'mu56'
$dbPassword = Read-Host 'Пароль пользователя PostgreSQL' -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $dbPassword).Password
.\.venv\Scripts\python.exe backend\manage.py migrate
.\.venv\Scripts\python.exe backend\manage.py seed_catalog
.\.venv\Scripts\python.exe backend\manage.py seed_offering_content
.\.venv\Scripts\python.exe backend\manage.py seed_character_content
.\.venv\Scripts\python.exe backend\manage.py seed_character_photos
.\.venv\Scripts\python.exe backend\manage.py seed_editorial
```

Существующий PostgreSQL компьютера не изменялся. Отдельный процесс запущен с разрешением вне sandbox. Миграции, наполнение и тесты успешно выполнены на PostgreSQL.

## Проверки

```powershell
& .\scripts\dev_postgres.ps1 Load
.\.venv\Scripts\python.exe backend\manage.py check
.\.venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run
.\.venv\Scripts\python.exe backend\manage.py test catalog leads
```

59 тестов проверяют каталог, цены и состав программ, повторное наполнение, галереи, статьи, сохранение заявок, CSRF, ограничения доступа и очередь уведомлений. 2 октября в восстановленной копии с заново установленными зависимостями прошли 57 тестов и сборка; два последующих теста проверяют наполнение описаний услуг. Управление описаниями: [docs/OFFERING_CONTENT.md](docs/OFFERING_CONTENT.md).

Контракт API и формат заявки — в `docs/API.md`. Заявки обрабатываются в админке; уведомления получает Дмитрий в Telegram при работающем обработчике. Настройка: [docs/TELEGRAM.md](docs/TELEGRAM.md). Секреты хранятся вне Git.

## Что дальше

Первая версия дизайна, каталога и формы готова. Направление и скриншоты — `docs/DESIGN.md`.

1. Подготовить конфигурацию production, сервисы и порядок развёртывания/отката.
2. Согласовать внешнее хранение резервных копий и данные владельца для политики.
3. Подготовить тестовое размещение на Selectel, затем согласовать публичный запуск.

Актуальный план: [docs/ROADMAP.md](docs/ROADMAP.md); проверенное восстановление: [docs/BACKUPS.md](docs/BACKUPS.md). Git создан локально; удалённый репозиторий пока не подключён.

## Запуск фронтенда

Сначала запустите Django и локальный PostgreSQL по инструкции выше. Для разработки с автоматическим обновлением после правок используйте в отдельном терминале:

```powershell
cd C:\GitHub\mu56.ru
npm.cmd --prefix frontend run dev
```

Предпросмотр: http://127.0.0.1:3000/. Для просмотра готовой сборки используйте `run start` из быстрого запуска. Он не подхватывает изменения кода автоматически. После правок остановите фронтенд, проверьте и пересоберите его:

```powershell
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run start
```

Не запускайте `dev` и `start` одновременно на порту 3000. Перед сборкой остановите работающий фронтенд. Если `start` сообщает, что production build отсутствует, сначала выполните `run build`. Если Node.js установлен недавно, откройте новый терминал, чтобы обновился PATH; наличие инструментов можно проверить командами `node --version` и `npm.cmd --version`.

Зависимости в текущем `frontend/node_modules` уже установлены: для обычного запуска не выполняйте установку заново. При восстановлении проекта на другом компьютере зависимости устанавливаются отдельно по закреплённому `frontend/pnpm-lock.yaml`, через доступный там pnpm:

```powershell
pnpm --dir frontend install --frozen-lockfile
```

Node.js 24 использован локально. Вызов `npm.cmd run` запускает существующие скрипты и не меняет lock-файл. `BACKEND_ORIGIN` задаёт адрес Django, по умолчанию `http://127.0.0.1:8000`. `SITE_URL` задаёт будущий адрес сайта, `SITE_INDEXING_ENABLED=true` включает индексацию только после подготовки публичного запуска. Фото выдаются через адаптивную оптимизацию Next.js Image; исходники сохранены.

Локальный бизнес-контекст и исходные материалы собраны в `ai-context/`: `project-overview.md`, `requirements.md`, `references/`, `internal/`, `artifacts/`. Новые фотографии, видео и документы можно складывать в `ai-context/inbox/`. Вся папка исключена из Git; на новом компьютере её нужно переносить отдельно. Корневой `AGENTS.md` задаёт порядок чтения контекста. Код находится в `backend/`, `frontend/` и `scripts/`, технические инструкции — в `docs/`, архитектурный план — в [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Перед публикацией состав репозитория проверить отдельно.


## Уточнения по дизайну и каталогу — 1 октября

Выезд описан как праздник на площадке клиента: в помещении или на улице. Большие герои используют карточки с фотографией на всю ширину; прозрачные изображения сохраняют композицию в полный рост. В шапке и футере — исходный SVG-змей и текстовое название бренда.

Новый год представлен одной программой «Новогодняя сказка: Дед Мороз и Снегурочка», всегда два героя. Тарифы 15/30/45/60 минут: 3500/4500/5000/6000 ₽. Час со звуком — 8000 ₽. Старые отдельные карточки скрыты, их адреса перенаправляются на /new-year.

У 35 публичных персонажей есть описания; команда seed_character_content заполняет только пустые тексты. Редактировать описания можно в Django Admin. Галереи есть у 15 персонажей/программ и скрываются, если фотографий нет. Галереи управляются через Django Admin и поступают на сайт из API без пересборки фронтенда. Выбранные фотографии архива импортированы в Django командой seed_character_photos. Инструкция: docs/GALLERIES.md.

Скриншоты уточнений: docs/design/revisions/. Production build и 19 backend-тестов прошли.

## Отзывы и статьи

Добавлены реальные отзывы из материалов владельца и три начальные авторские статьи. Управление в Django Admin, черновики и публикация по дате. Инструкция: [docs/EDITORIAL.md](docs/EDITORIAL.md). Проверены 27 backend-тестов, production build и поведение новых страниц в браузере.

## SEO

Canonical, поисковые описания, JSON-LD и динамическая карта сайта подготовлены. Локальная индексация выключена. Настройка и проверки: [docs/SEO.md](docs/SEO.md). Проверены 67 страниц в двух режимах; действующий mu56.ru не изменён.

## Оптимизация и следующие этапы

Фото выдаются через Next.js Image с адаптивными размерами и WebP; оригиналы сохранены. Проверка: `.venv/Scripts/python.exe scripts/check_images.py` при работающих серверах. План дальнейшей работы и политика AI-поиска: [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md).
