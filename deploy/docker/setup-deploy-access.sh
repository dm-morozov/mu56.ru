#!/bin/sh
# Run as root with a public Ed25519 key on stdin. No private key is transferred.
set -eu
[ "$(id -u)" = 0 ] || exit 1
[ ! -e /etc/ssh/authorized_keys/mu56-deploy ] || exit 1
[ ! -e /etc/sudoers.d/mu56-deploy ] || exit 1
[ ! -e /etc/ssh/sshd_config.d/60-mu56-deploy.conf ] || exit 1
[ -x /usr/local/sbin/mu56-deploy-status ] || exit 1
[ -x /usr/local/sbin/mu56-deploy-ssh-entry ] || exit 1
IFS= read -r key
printf '%s\n' "$key" | /usr/bin/ssh-keygen -lf /dev/stdin >/dev/null
case "$key" in 'ssh-ed25519 '*) ;; *) exit 1 ;; esac
if ! id mu56-deploy >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/mu56-deploy --shell /bin/sh mu56-deploy
fi
# Stop if a pre-existing account has privileges we did not create.
[ "$(id -Gn mu56-deploy)" = mu56-deploy ] || exit 1
install -d -o root -g root -m 0755 /var/lib/mu56-deploy /etc/ssh/authorized_keys
[ ! -e /etc/ssh/authorized_keys/mu56-deploy ] || exit 1
printf 'restrict %s\n' "$key" > /etc/ssh/authorized_keys/mu56-deploy
# sshd reads this public key as the target user; root owns it to prevent edits.
chmod 0644 /etc/ssh/authorized_keys/mu56-deploy
cat > /etc/sudoers.d/mu56-deploy <<'EOF'
Defaults:mu56-deploy !setenv
mu56-deploy ALL=(root) NOPASSWD: /usr/local/sbin/mu56-deploy-status status
EOF
chmod 0440 /etc/sudoers.d/mu56-deploy
visudo -cf /etc/sudoers.d/mu56-deploy
cat > /etc/ssh/sshd_config.d/60-mu56-deploy.conf <<'EOF'
Match User mu56-deploy
    AuthorizedKeysFile /etc/ssh/authorized_keys/mu56-deploy
    ForceCommand /usr/local/sbin/mu56-deploy-ssh-entry
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    PermitTTY no
    DisableForwarding yes
Match all
EOF
/usr/sbin/sshd -t
systemctl reload ssh
