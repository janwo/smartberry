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

# Add transformation services
ADDONS_FILE=${OPENHAB_HOME}/conf/services/addons.cfg
TRANSFORMATION_LINE=$(grep -e '^[^#]\s?transformation' ${ADDONS_FILE} || echo '' )
if [ ! -z ${TRANSFORMATION_LINE} ]; then
    if [[ ${TRANSFORMATION_LINE} != *"map"* ]]; then
        sed -i 's/transformation\s\?=\s\?/transformation = map,/' ${ADDONS_FILE}
    fi
else
    ## Just append last line
    echo "transformation = map" >> ${ADDONS_FILE}
fi

# Add misc services
MISC_LINE=$(grep -e '^[^#]\s?misc' ${ADDONS_FILE} || echo '' )
if [ ! -z ${MISC_LINE} ]; then
    if [[ ${MISC_LINE} != *"openhabcloud"* ]]; then
        sed -i 's/misc\s\?=\s\?/misc = openhabcloud,/' ${ADDONS_FILE}
    fi
else
    ## Just append last line
    echo "misc = openhabcloud" >> ${ADDONS_FILE}
fi

# Add automation services
AUTOMATION_LINE=$(grep -e '^[^#]\s?automation' ${ADDONS_FILE} || echo '')
if [ ! -z ${AUTOMATION_LINE} ]; then
    if [[ ${AUTOMATION_LINE} != *"jythonscripting"* ]]; then
        sed -i 's/automation\s\?=\s\?/automation = jythonscripting,/' ${ADDONS_FILE}
    fi
else
    ## Just append last line
    echo "automation = jythonscripting" >> ${ADDONS_FILE}
fi

# Add persistence services
PERSISTENCE_LINE=$(grep -e '^[^#]\s?persistence' ${ADDONS_FILE} || echo '' )
if [ ! -z ${PERSISTENCE_LINE} ]; then
    if [[ ${PERSISTENCE_LINE} != *"rrd4j"* ]]; then
        sed -i 's/persistence\s\?=\s\?/persistence = rrd4j,/' ${ADDONS_FILE}
    fi
else
    ## Just append last line
    echo "persistence = rrd4j" >> ${ADDONS_FILE}
fi
