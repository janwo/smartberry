#!/bin/sh
set -eu

# Add settings to main page
echo "clear-backups.sh: Keep latest five backups in $OPENHAB_BACKUPS..."
(cd ${OPENHAB_BACKUPS} && ls -tp | grep -v '/$' | tail -n +$(expr ${KEEP_OPENHAB_BACKUPS:-5} + 1) | xargs -I {} rm -- {})
