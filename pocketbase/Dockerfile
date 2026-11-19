# TriSync's account server: PocketBase with the userdata schema (pb_migrations/).
# Data lives on the Fly volume mounted at /pb/pb_data (see fly.toml).
FROM alpine:3.20

ARG PB_VERSION=0.40.6
ARG PB_SHA256=0e1f609158ed945f809f8a02ae012aa0427129c66ebb63c1aee76f2c0309373f

RUN apk add --no-cache ca-certificates unzip
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN echo "${PB_SHA256}  /tmp/pb.zip" | sha256sum -c - \
 && unzip /tmp/pb.zip -d /pb \
 && rm /tmp/pb.zip

COPY pb_migrations /pb/pb_migrations

EXPOSE 8080
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8080", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations"]
