#!/bin/sh
export USER="influxdb;test"
exec /usr/bin/samba.sh "$@"
