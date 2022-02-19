FROM crazymax/samba:latest
COPY ./config.yml /data/config.yml
COPY ./entrypoint.sh /pre-entrypoint.sh
ENTRYPOINT [ "/pre-entrypoint.sh" ]
CMD [ "smbd", "-F", "--debug-stdout", "--no-process-group" ]
