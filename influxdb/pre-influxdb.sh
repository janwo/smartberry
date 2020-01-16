#!/bin/sh
export INFLUXDB_USER_PASSWORD = ${AUTH_INFLUXDB_PASSWORD}
exec /entrypoint.sh "$@"
