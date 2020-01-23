#!/bin/sh
#export USER1="influxdb;test"
export USER="openhab;test;9001;openhab;9001"
#export USER3="grafana;test;472;grafana;472"
exec /usr/bin/samba.sh "$@"
