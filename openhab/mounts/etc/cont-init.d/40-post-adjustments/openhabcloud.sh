#!/bin/sh
set -eu

# Reset openhabcloud to $AUTH_OPENHAB_UUID
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
