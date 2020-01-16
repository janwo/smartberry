#!/bin/sh
export USER='openhab;' + ${AUTH_SAMBA_PASSWORD}
exec /usr/bin/samba.sh "$@"
