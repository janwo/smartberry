#!/bin/sh
set -eu

# Reset hostfile to $AUTH_DEVICE_HOSTKEY
if [ ! -z ${AUTH_DEVICE_HOSTKEY+x} ]
then
    FILE=${OPENHAB_HOME}/userdata/etc/host.key
    echo "hostfile.sh: Adjust $FILE with \$AUTH_DEVICE_HOSTKEY..."
    echo ${AUTH_DEVICE_HOSTKEY} > $FILE
else
    echo 'hostfile.sh: $AUTH_DEVICE_HOSTKEY not set!'
fi
