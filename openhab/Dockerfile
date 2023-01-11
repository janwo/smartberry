FROM openhab/openhab:3.4.1-alpine

RUN apk add --no-cache \
    rsync \
    jq 

COPY --chown=${USER_ID}:${GROUP_ID} ./mounts/etc/cont-init.d/ /etc/cont-init.d
COPY --chown=${USER_ID}:${GROUP_ID} ./mounts/tmp/openhab/ /tmp/${OPENHAB_HOME}
