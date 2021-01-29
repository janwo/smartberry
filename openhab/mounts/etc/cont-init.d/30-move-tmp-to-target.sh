#!/bin/sh
set -eu

# Copy tmp openhab directory to live openhab directory
rsync -av -rv /tmp/${OPENHAB_HOME}/ ${OPENHAB_HOME}
