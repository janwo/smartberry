FROM crazymax/samba:latest
COPY ./config.yml /data/config.yml
RUN echo "${SAMBA_PASSWORD}" > /run/secrets/password
