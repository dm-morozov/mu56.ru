#!/bin/sh
# Read-only checks on the prepared Linux server. Does not enable/restart services.
set -eu
for path in /srv/mu56/shared/media /srv/mu56/shared/static \
    /srv/mu56/shared/private-cache /srv/mu56/shared/next-cache /srv/mu56/backups; do
    test -d "$path"
done
test -f /srv/mu56/current/frontend/.next/BUILD_ID
test -L /srv/mu56/current/frontend/.next/cache
sudo systemd-analyze verify /etc/systemd/system/mu56-backend.service \
    /etc/systemd/system/mu56-frontend.service /etc/systemd/system/mu56-telegram.service \
    /etc/systemd/system/mu56-backup.service /etc/systemd/system/mu56-backup.timer
sudo nginx -t
sh /srv/mu56/current/deploy/manage.sh check --deploy --fail-level ERROR
sh /srv/mu56/current/deploy/manage.sh migrate --check
printf '%s\n' 'Preflight passed. Service start, real HTTPS, form and Telegram still need acceptance checks.'
