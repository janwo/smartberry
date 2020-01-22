#!/bin/sh
export USER0="openhab;${AUTH_SAMBA_PASSWORD};9001;openhab;9001"
export USER1="grafana;${AUTH_SAMBA_PASSWORD};472;grafana;472"
export USER2="influxdb;${AUTH_SAMBA_PASSWORD}"
exec /usr/bin/samba.sh
