#!/bin/sh
set -eu

# Set openhabcloud
if [ ! -z ${AUTH_OPENHAB_UUID+x} ]
then
    mkdir -p ${OPENHAB_HOME}/userdata
    echo ${AUTH_OPENHAB_UUID} > ${OPENHAB_HOME}/userdata/uuid
fi
if [ ! -z ${AUTH_OPENHAB_SECRET+x} ]
then
    mkdir -p ${OPENHAB_HOME}/userdata/openhabcloud
    echo ${AUTH_OPENHAB_SECRET} > ${OPENHAB_HOME}/userdata/openhabcloud/secret
fi

# Set hostfile
if [ ! -z ${AUTH_DEVICE_HOSTKEY+x} ]
then
    echo ${AUTH_DEVICE_HOSTKEY} > ${OPENHAB_HOME}/userdata/etc/host.key
fi

# Remove non standard files within conf-folder
find ${OPENHAB_HOME}/conf/sitemaps -type f -name 'core_*.sitemap' -delete
find ${OPENHAB_HOME}/conf/items -type f -name 'core_*.items' -delete
find ${OPENHAB_HOME}/conf/rules -type f -name 'core_*.rules' -delete
find ${OPENHAB_HOME}/conf/transform -type f -name 'core_*.map' -delete

# Overwrite files including conf-folder
ls /tmp/${OPENHAB_HOME}/conf/automation/lib/python/personal
rsync -av -rv /tmp/${OPENHAB_HOME}/ ${OPENHAB_HOME}

# Allow internal ssh connections
RUNTIME_FILE=${OPENHAB_HOME}/conf/services/runtime.cfg
sed -n -e 's/[#\s]*\(org.apache.karaf.shell:sshHost\s\?=\s\?\)[^\s]*/\10.0.0.0/' ${RUNTIME_FILE}

# Start addons.cfg transformations
ADDONS_FILE=${OPENHAB_HOME}/conf/services/addons.cfg

# => transformation
TRANSFORMATION_LINE="$(grep -E '^[^#]?\s?transformation' ${ADDONS_FILE} || echo '' )"
if [ "${TRANSFORMATION_LINE}" != '' ]; then
    if [[ "${TRANSFORMATION_LINE}" != *"map"* ]]; then
        sed -n -e 's/transformation\s\?=\s\?/transformation = map,/' ${ADDONS_FILE}
    fi
else
    ## Just append last line
    echo "transformation = map" >> ${ADDONS_FILE}
fi

# => misc
MISC_LINE="$(grep -E '^[^#]?\s?misc' ${ADDONS_FILE} || echo '' )"
if [ "${MISC_LINE}" != '' ]; then
    if [[ "${MISC_LINE}" != *"openhabcloud"* ]]; then
        sed -n -e 's/misc\s\?=\s\?/misc = openhabcloud,/' ${ADDONS_FILE}
    fi
else
    ## Just append last line
    echo "misc = openhabcloud" >> ${ADDONS_FILE}
fi

# => automation
AUTOMATION_LINE="$(grep -E '^[^#]?\s?automation' ${ADDONS_FILE} || echo '')"
if [ "${AUTOMATION_LINE}" != '' ]; then
    if [[ "${AUTOMATION_LINE}" != *"jythonscripting"* ]]; then
        sed -n -e 's/automation\s\?=\s\?/automation = jythonscripting,/' ${ADDONS_FILE}
    fi
else
    ## Just append last line
    echo "automation = jythonscripting" >> ${ADDONS_FILE}
fi

# => persistence
PERSISTENCE_LINE="$(grep -E '^[^#]?\s?persistence' ${ADDONS_FILE} || echo '' )"
if [ "${PERSISTENCE_LINE}" != '' ]; then
    if [[ "${PERSISTENCE_LINE}" != *"rrd4j"* ]]; then
        sed -n -e 's/persistence\s\?=\s\?/persistence = rrd4j,/' ${ADDONS_FILE}
    fi
else
    ## Just append last line
    echo "persistence = rrd4j" >> ${ADDONS_FILE}
fi
