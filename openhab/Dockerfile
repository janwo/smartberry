FROM openhab/openhab:milestone

# RUN apk add --no-cache \
RUN apt-get update && apt-get install -y --no-install-recommends \
    rsync \
    curl \
    unzip \
    grep \
    jq \
    coreutils \
    findutils

COPY --chown=${USER_ID}:${GROUP_ID} ./mounts/etc/cont-init.d/ /etc/cont-init.d
COPY --chown=${USER_ID}:${GROUP_ID} ./mounts/tmp/openhab/ /tmp/${OPENHAB_HOME}
