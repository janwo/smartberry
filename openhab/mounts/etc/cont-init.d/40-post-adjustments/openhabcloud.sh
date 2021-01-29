#!/bin/sh
set -eu

# Reset openhabcloud to $AUTH_OPENHAB_UUID
if [ ! -z ${AUTH_OPENHAB_UUID+x} ]; then
    mkdir -p ${OPENHAB_HOME}/userdata
    FILE=${OPENHAB_HOME}/userdata/uuid
    echo "openhabcloud.sh: Adjust $FILE with \$AUTH_OPENHAB_UUID..."
    echo ${AUTH_OPENHAB_UUID} > $FILE
else
    echo 'openhabcloud.sh: $AUTH_OPENHAB_UUID not set!'
fi


if [ ! -z ${AUTH_OPENHAB_SECRET+x} ]; then
    mkdir -p ${OPENHAB_HOME}/userdata/openhabcloud
    FILE=${OPENHAB_HOME}/userdata/openhabcloud/secret
    echo "openhabcloud.sh: Adjust $FILE with \$AUTH_OPENHAB_SECRET..."
    echo ${AUTH_OPENHAB_SECRET} > $FILE
else
    echo 'openhabcloud.sh: $AUTH_OPENHAB_SECRET not set!'
fi
