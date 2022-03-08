FROM openhab/openhab:alpine-milestone

RUN apk add --no-cache \
    rsync \
    curl \
    unzip \
    grep \
    jq \
    coreutils \
    findutils

COPY --chown=${USER_ID}:${GROUP_ID} ./mounts/etc/cont-init.d/ /etc/cont-init.d
COPY --chown=${USER_ID}:${GROUP_ID} ./mounts/tmp/openhab/ /tmp/${OPENHAB_HOME}
