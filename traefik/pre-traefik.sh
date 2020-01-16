#!/bin/sh
HASHED=$(openssl passwd -1 ${AUTH_OPENHAB_PASSWORD})
sed -i "s?AUTH_OPENHAB_PASSWORD?${HASHED}?g" /etc/traefik/traefik.toml
#exec /traefik "$@"
