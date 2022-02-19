#!/bin/bash
mkdir /run/secrets && echo ${SAMBA_PASSWORD} > /run/secrets/password
./entrypoint.sh 