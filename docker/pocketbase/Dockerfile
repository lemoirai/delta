FROM alpine:3.22

ARG PB_VERSION
ARG TARGETARCH

RUN apk add --no-cache ca-certificates unzip wget \
 && test -n "$PB_VERSION" \
 && cd /tmp \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
 && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/checksums.txt" \
 && grep " pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip\$" checksums.txt | sha256sum -c - \
 && mkdir -p /pb \
 && unzip -q "pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" pocketbase -d /pb \
 && rm -f /tmp/*.zip /tmp/checksums.txt

COPY entrypoint.sh /entrypoint.sh
# Strip CR in case Git on Windows checked the script out with CRLF endings.
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

EXPOSE 8090
ENTRYPOINT ["/entrypoint.sh"]
