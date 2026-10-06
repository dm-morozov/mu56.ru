#!/bin/sh
# Run a management command as the service user; PID 1 reads the root-only env file.
set -eu
if [ "$#" -eq 0 ]; then
    printf '%s\n' 'Usage: sh deploy/manage.sh <Django management command> [arguments]' >&2
    exit 2
fi
exec sudo systemd-run --wait --pipe --collect \
    --unit="mu56-manage-$$" \
    --property=User=mu56 --property=Group=mu56 \
    --property=WorkingDirectory=/srv/mu56/current/backend \
    --property=EnvironmentFile=/etc/mu56/django.env \
    /srv/mu56/current/.venv/bin/python manage.py "$@"

