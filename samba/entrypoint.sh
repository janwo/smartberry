#!/bin/bash
mkdir -p /run/secrets && echo ${SAMBA_PASSWORD} > /run/secrets/password
./entrypoint.sh "$@"