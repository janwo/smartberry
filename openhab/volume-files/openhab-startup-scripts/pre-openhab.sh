#!/bin/bash -x
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

cat > /openhab/userdata/etc/host.key << ${AUTH_DEVICE_HOSTKEY}
