#!/bin/sh
set -eu

if [ ! -z ${OPENHAB_UUID+x} ]; then
    mkdir -p ${OPENHAB_HOME}/userdata
    FILE=${OPENHAB_HOME}/userdata/uuid
    echo "openhabcloud.sh: Adjust $FILE with \$OPENHAB_UUID..."
    echo ${OPENHAB_UUID} > $FILE
else
    echo 'openhabcloud.sh: $OPENHAB_UUID not set!'
fi


if [ ! -z ${OPENHAB_SECRET+x} ]; then
    mkdir -p ${OPENHAB_HOME}/userdata/openhabcloud
    FILE=${OPENHAB_HOME}/userdata/openhabcloud/secret
    echo "openhabcloud.sh: Adjust $FILE with \$OPENHAB_SECRET..."
    echo ${OPENHAB_SECRET} > $FILE
else
    echo 'openhabcloud.sh: $OPENHAB_SECRET not set!'
fi
