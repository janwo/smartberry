FROM crazymax/samba:latest
COPY ./config.yml /data/config.yml
RUN mkdir /run/secrets && echo "${SAMBA_PASSWORD}" > /run/secrets/password
