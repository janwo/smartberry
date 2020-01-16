#!/bin/sh
if [ ! -z ${AUTH_OPENHAB_UUID} ]
then
    mkdir -p /openhab/userdata
    echo ${AUTH_OPENHAB_UUID} > /openhab/userdata/uuid
fi
if [ ! -z ${AUTH_OPENHAB_SECRET} ]
then
    mkdir -p /openhab/userdata/openhabcloud
    echo ${AUTH_OPENHAB_SECRET} > /openhab/userdata/openhabcloud/secret
fi

echo ${AUTH_DEVICE_HOSTKEY} > /openhab/userdata/etc/host.key

sed -i "s?AUTH_INFLUXDB_PASSWORD?${AUTH_INFLUXDB_PASSWORD}?g" /tmp/openhab/userdata/config/org/openhab/influxdb.config
cp /tmp/openhab/userdata/config/org/openhab/influxdb.config /openhab/userdata/config/org/openhab/influxdb.config

filename=/openhab/userdata/config/org/openhab/addons.config
if [ ! -f $filename ]
then
    cp /tmp/openhab/userdata/config/org/openhab/addons.config.template /openhab/userdata/config/org/openhab/addons.config
fi

rm -r /tmp/openhab
