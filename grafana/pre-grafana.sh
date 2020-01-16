#!/bin/sh
export GF_SECURITY_ADMIN_PASSWORD=${AUTH_GRAFANA_PASSWORD}
exec /usr/local/bin/docker-entrypoint.sh "$@"
