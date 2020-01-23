#!/bin/sh
export GF_SECURITY_ADMIN_PASSWORD=${AUTH_GRAFANA_PASSWORD}
sed -i "s?DATASOURCE_INFLUXDB_USER_PASSWORD?${AUTH_INFLUXDB_PASSWORD}?g" /etc/grafana/provisioning/datasources.yml
exec /run.sh "$@"
