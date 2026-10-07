# Превью ссылки для мессенджеров — 8 октября 2026

## Обложка

**Актуальная версия после уточнения владельца:** `frontend/public/media/social-preview-20261008-v2.jpg`, JPEG 1200 × 630 px, 232 733 байта. Справа использована обработанная фотография с главной `bumblebee-children-party.png` с мягким освещением лиц. Текст и фирменная композиция сохранены. Версия ниже — первоначальная, сохранена для истории. Код подключает v2; локальный GET файла вернул 200/image/jpeg, OG и Twitter указывают на v2. Production не обновлялся.

Файл: `frontend/public/media/social-preview-20261008.jpg`, JPEG, 1200 × 630 px, 241 597 байт. Создан встроенным imagegen с опорой на `bumblebee-live.jpg` и `logo.png`; экспортирован в целевой размер JPEG. Исходные фотографии/логотип не изменены. Обложка — дизайнерская композиция, а не новый неизменённый документальный кадр.

Крупный текст: «Праздник, который дети не забудут». Дополнительно: «Аниматоры · Трансформеры · Шоу», «Оренбург», `mu56.ru`. Нет изменяемых цен и неподтверждённых заявлений.

## Подключение

Общий объект `socialPreviewImage` в `frontend/src/lib/seo.ts`: абсолютный URL через действующий SITE_URL, размеры, MIME, alt. Используется в корневых Open Graph/Twitter Card и как обложка по умолчанию в `pageMetadata`. Собственные Open Graph фотографии персонажей и отдельных услуг сохраняются. Аналитика, индексация, canonical, заголовки, сервер и заявки не менялись.

Проверено на текущем production GET: до изменения `https://mu56.ru/` отдаёт OG/Twitter со старой фотографией `/media/bumblebee-live.jpg`. Новая обложка подключена **локально**, публикация не выполнялась. После штатной выкладки проверить публичный JPEG (200, image/jpeg), HTML главной и реальное новое превью в Telegram/MAX. Обновление кэшированных карточек мессенджера не подтверждено. Новое имя файла исключает использование прежнего адреса картинки, но не гарантирует немедленный повторный обход страницы мессенджером.

Локально `http://127.0.0.1:3001/`: OG/Twitter указывают на новый файл, размеры 1200/630 присутствуют. GET изображения: 200, image/jpeg, 241 597 байт. TypeScript прошёл. Commit/push/deploy и отправка сообщений не выполнялись.

## Финальный промпт (встроенный imagegen)

### Уточнение v2

Use case: compositing, precise localized edit. Input 1 is the APPROVED final 1200x630 social preview banner and is the edit target. Input 2 is the correct edited bright photograph currently used on the website homepage and is the replacement photo. Change ONLY the photographic region on the RIGHT of input 1, inside the existing yellow curved border. Replace it with the exact scene from input 2: brightly evenly illuminated children's faces without the older hard cast shadows. Preserve people's identities, expressions, costumes, objects, natural skin and photographic authenticity from input 2. Match current framing and positions as closely as possible. Do NOT alter the left panel, logo, lettering, Cyrillic text, font, colors, spacing, lower decoration, kite, yellow border, size or overall approved composition. Preserve every text character exactly as in input 1, with no additions. No new people, no new details, no artificial beauty treatment. Output the corrected banner only, same 1200:630 wide aspect.

### Первоначальная композиция

Use case: ads-marketing / compositing. Create a polished premium Open Graph link-preview banner for Russian children's celebration company 'Мир Улыбок' in Orenburg. Landscape aspect EXACTLY 1200:630 (1.905:1), full bleed opaque. Input image 1 is REAL documentary celebration photo: preserve children's identities, faces, costumes and the scene, use a creatively framed crop as right-hand 52% photo panel, no new people or changing expressions. Input image 2 is the exact existing brand logo with colorful flying kite and Cyrillic lettering: preserve its design and exact name, use modestly in upper left. Left 48% is warm ivory #fffdf5 with dark navy #162b3b oversized editorial typography and restrained orange #ff6435 accent. Sophisticated clean art direction, generous whitespace, graceful rounded photo edge, subtle small kite-inspired accent only, no generic party clipart, no glitter, no fake 3D gold, no app/device mockup, no border outside canvas. Readable at small chat thumbnail size. Text verbatim: brand 'Мир Улыбок'; headline on two or three lines 'Праздник, который дети не забудут'; supporting small but clear 'Аниматоры · Трансформеры · Шоу'; bottom 'Оренбург' and 'mu56.ru'. No prices, no phone, no buttons, no invented awards or numbers. Photo must visually dominate emotionally while text remains very clear. All key text and faces within 55px safe margin. Output the finished banner only.
