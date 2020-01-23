#!/bin/sh
export USER1="influxdb;${AUTH_SAMBA_PASSWORD}"
export USER2="openhab;${AUTH_SAMBA_PASSWORD};9001;openhab;9001"
export USER3="grafana;${AUTH_SAMBA_PASSWORD};472;grafana;472"
echo $USER1
echo $USER2
echo $USER3
exec /usr/bin/samba.sh "$@"
