#!/bin/sh
# Set openhabcloud
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

# Set hostfile
echo ${AUTH_DEVICE_HOSTKEY} > /openhab/userdata/etc/host.key

# Set influxdb
sed -i "s?AUTH_INFLUXDB_PASSWORD?${AUTH_INFLUXDB_PASSWORD}?g" /tmp/openhab/userdata/config/org/openhab/influxdb.config

# Remove non standard files within conf-folder
find /openhab/conf/sitemaps -type f ! -name 'customsitemap-*.sitemap' ! -name 'home.sitemap' ! -name 'readme.txt' -delete
find /openhab/conf/items -type f ! -name 'customitem-*.items' ! -name 'readme.txt' -delete
find /openhab/conf/scripts -type f ! -name 'customscript-*.py' ! -name 'readme.txt' -delete
find /openhab/conf/rules -type f ! -name 'customrule-*.rules' ! -name 'readme.txt' -delete
find /openhab/conf/transform -type f ! -name 'customtransform-*.map' ! -name 'readme.txt' -delete

# Overwrite files including conf-folder
find /tmp/openhab -type f -exec cp --parents {} /openhab \;