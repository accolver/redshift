# syntax=docker/dockerfile:1
ARG GO_VERSION=1.26.5
FROM golang:${GO_VERSION}-bookworm AS nak-builder
RUN GOBIN=/out go install github.com/fiatjaf/nak@v0.19.7

FROM debian:bookworm-slim
ARG TARGETARCH
ARG GH_VERSION=2.96.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl coreutils git jq \
    && rm -rf /var/lib/apt/lists/* \
    && case "$TARGETARCH" in amd64) GH_ARCH=amd64 ;; arm64) GH_ARCH=arm64 ;; *) exit 1 ;; esac \
    && curl -fsSL "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_${GH_ARCH}.tar.gz" -o /tmp/gh.tar.gz \
    && tar -xzf /tmp/gh.tar.gz -C /tmp \
    && mv "/tmp/gh_${GH_VERSION}_linux_${GH_ARCH}/bin/gh" /usr/local/bin/gh \
    && rm -rf /tmp/gh*
COPY --from=nak-builder /out/nak /usr/local/bin/nak
COPY tests/release/container-entrypoint.sh /usr/local/bin/redshift-release-test
RUN chmod 0755 /usr/local/bin/nak /usr/local/bin/redshift-release-test
ENTRYPOINT ["/usr/local/bin/redshift-release-test"]
