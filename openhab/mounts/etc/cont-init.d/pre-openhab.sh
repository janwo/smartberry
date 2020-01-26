#!/bin/sh
# Set openhabcloud
if [ ! -z ${AUTH_OPENHAB_UUID} ]
then
    mkdir -p /openhab/userdata
    echo ${AUTH_OPENHAB_UUID} > ${OPENHAB_HOME}/userdata/uuid
fi
if [ ! -z ${AUTH_OPENHAB_SECRET} ]
then
    mkdir -p /openhab/userdata/openhabcloud
    echo ${AUTH_OPENHAB_SECRET} > ${OPENHAB_HOME}/userdata/openhabcloud/secret
fi

# Set hostfile
echo ${AUTH_DEVICE_HOSTKEY} > ${OPENHAB_HOME}/userdata/etc/host.key

# Set influxdb
sed -i "s?AUTH_INFLUXDB_PASSWORD?${AUTH_INFLUXDB_PASSWORD}?g" /tmp/openhab/conf/services/influxdb.cfg

# Remove non standard files within conf-folder
find ${OPENHAB_HOME}/conf/sitemaps -type f -name 'core-*.sitemap' -delete
find ${OPENHAB_HOME}/conf/items -type f -name 'core-*.items' -delete
find ${OPENHAB_HOME}/conf/scripts -type -name 'core-*' -delete
find ${OPENHAB_HOME}/conf/rules -type f -name 'core-*.rules' -delete
find ${OPENHAB_HOME}/conf/transform -type f -name 'core-*.map' -delete

# Overwrite files including conf-folder
rsync -a /tmp/openhab/ ${OPENHAB_HOME}
chown -R openhab:openhab ${OPENHAB_HOME}
