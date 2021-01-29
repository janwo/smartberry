#!/bin/sh
set -eu

# Reset hostfile to $AUTH_DEVICE_HOSTKEY
if [ ! -z ${AUTH_DEVICE_HOSTKEY+x} ]
then
    echo ${AUTH_DEVICE_HOSTKEY} > ${OPENHAB_HOME}/userdata/etc/host.key
fi
