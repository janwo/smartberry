#!/bin/bash
export GF_SECURITY_ADMIN_PASSWORD=${AUTH_GRAFANA_PASSWORD}
exec /run.sh "$@"
