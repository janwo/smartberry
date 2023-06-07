FROM openhab/openhab:4.0.0.M3-alpine

# RUN apk add --no-cache \
apt-get install \
    rsync \
    jq 

COPY --chown=${USER_ID}:${GROUP_ID} ./mounts/etc/cont-init.d/ /etc/cont-init.d
COPY --chown=${USER_ID}:${GROUP_ID} ./mounts/tmp/openhab/ /tmp/${OPENHAB_HOME}
