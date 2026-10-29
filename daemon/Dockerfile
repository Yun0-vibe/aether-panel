// Builds a small static Go binary; run on any Linux node with Docker.
FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /daemon .

FROM alpine:3.20
RUN apk add --no-cache docker-cli ca-certificates tzdata
COPY --from=build /daemon /usr/local/bin/daemon
EXPOSE 8080
ENTRYPOINT ["daemon"]
