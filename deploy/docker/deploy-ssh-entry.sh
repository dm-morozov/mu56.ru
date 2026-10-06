#!/bin/sh
# Root-owned forced SSH command. Do not evaluate client command text.
set -eu
case "${SSH_ORIGINAL_COMMAND:-}" in
  status) exec /usr/bin/sudo -n /usr/local/sbin/mu56-deploy-status status ;;
  release) exec /usr/bin/sudo -n /usr/local/sbin/mu56-release release ;;
  rollback) exec /usr/bin/sudo -n /usr/local/sbin/mu56-release rollback ;;
  *) printf '%s\n' 'Only status is enabled; shell and deployment are disabled.' >&2; exit 64 ;;
esac
