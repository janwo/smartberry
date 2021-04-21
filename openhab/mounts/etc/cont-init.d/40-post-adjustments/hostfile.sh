#!/bin/sh
set -eu

# Reset hostfile to $OPENHAB_HOSTKEY
if [ ! -z ${OPENHAB_HOSTKEY+x} ]; then
    FILE=${OPENHAB_HOME}/userdata/etc/host.key
    echo "hostfile.sh: Adjust $FILE with \$OPENHAB_HOSTKEY..."
    echo ${OPENHAB_HOSTKEY} > $FILE
else
    echo 'hostfile.sh: $OPENHAB_HOSTKEY not set!'
fi
