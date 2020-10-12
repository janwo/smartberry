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

# Remove non standard files within conf-folder
find ${OPENHAB_HOME}/conf/sitemaps -type f -name 'core_*.sitemap' -delete
find ${OPENHAB_HOME}/conf/items -type f -name 'core_*.items' -delete
find ${OPENHAB_HOME}/conf/rules -type f -name 'core_*.rules' -delete
find ${OPENHAB_HOME}/conf/transform -type f -name 'core_*.map' -delete

# Overwrite files including conf-folder
rsync -a /tmp/openhab/ ${OPENHAB_HOME}
chown -R openhab:openhab ${OPENHAB_HOME}

# Add transformation services
MISC_LINE=$(grep '^[[:space:]]\?transformation' ${OPENHAB_HOME}/conf/services/addons.cfg)
if [ $? -eq 0 ]; then
    if [[ ${MISC_LINE} != *"map"* ]]; then
        sed -i 's/transformation\s\?=\s\?/transformation = map,/' ${OPENHAB_HOME}/conf/services/addons.cfg
    fi
else
    ## Just append last line
    echo "transformation = map" >> ${OPENHAB_HOME}/conf/services/addons.cfg
fi

# Add misc services
MISC_LINE=$(grep '^[[:space:]]\?misc' ${OPENHAB_HOME}/conf/services/addons.cfg)
if [ $? -eq 0 ]; then
    if [[ ${MISC_LINE} != *"openhabcloud"* ]]; then
        sed -i 's/misc\s\?=\s\?/misc = openhabcloud,/' ${OPENHAB_HOME}/conf/services/addons.cfg
    fi
else
    ## Just append last line
    echo "misc = openhabcloud" >> ${OPENHAB_HOME}/conf/services/addons.cfg
fi

# Add persistence services
MISC_LINE=$(grep '^[[:space:]]\?persistence' ${OPENHAB_HOME}/conf/services/addons.cfg)
if [ $? -eq 0 ]; then
    if [[ ${MISC_LINE} != *"mapdb"* ]]; then
        sed -i 's/persistence\s\?=\s\?/persistence = mapdb,/' ${OPENHAB_HOME}/conf/services/addons.cfg
    fi
else
    ## Just append last line
    echo "persistence = mapdb" >> ${OPENHAB_HOME}/conf/services/addons.cfg
fi
