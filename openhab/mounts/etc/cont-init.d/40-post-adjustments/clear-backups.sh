#!/bin/sh
set -eu

# Add settings to main page
if [ -d ${OPENHAB_BACKUPS} ]; then
    echo "clear-backups.sh: Keep latest five backups in $OPENHAB_BACKUPS..."
    (cd ${OPENHAB_BACKUPS} && ls -tp | grep -v '/$' | tail -n +$(expr ${KEEP_OPENHAB_BACKUPS:-5} + 1) | xargs -I {} rm -- {} || true)
else
    echo "clear-backups.sh: \$OPENHAB_BACKUPS=$OPENHAB_BACKUPS not found!"
fi
