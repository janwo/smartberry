#!/bin/sh
export USER_2="influxdb;test"
export USER_1="openhab;test;9001;openhab;9001"
export USER_3="grafana;test;472;grafana;472"
exec /usr/bin/samba.sh "$@"
