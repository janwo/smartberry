#!/bin/sh
export USER1="influxdb;${AUTH_SAMBA_PASSWORD}"
exec /usr/bin/samba.sh "$@"
