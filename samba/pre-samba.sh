#!/bin/sh
export USER0="influxdb;${AUTH_SAMBA_PASSWORD}"
export USER1="openhab;${AUTH_SAMBA_PASSWORD};9001;openhab;9001"
export USER2="grafana;${AUTH_SAMBA_PASSWORD};472;grafana;472"
exec /usr/bin/samba.sh "$@"
