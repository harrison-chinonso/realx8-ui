# Realx8-Ui — static build served by nginx.
#
# The image ships a reverse proxy for /api and /uploads, so the app can keep
# using the relative base and stay same-origin (no CORS). Point it at the
# backend with API_TARGET at RUN time:
#
#   docker build -t realx8-ui .
#   docker run -p 8080:80 -e API_TARGET=http://realx8-core:3000 realx8-ui
#
# To skip the proxy and call the API cross-origin instead, build with
# --build-arg VITE_API_BASE_URL=https://api.example.com/api and make sure that
# origin is in Realx8-Core's CORS_ORIGIN.

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
# Baked in at BUILD time — Vite inlines import.meta.env into the bundle, so this
# cannot be changed later by setting an env var on the container.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine
# nginx:alpine renders /etc/nginx/templates/*.template through envsubst on
# startup, which is how API_TARGET reaches the config without a rebuild.
ENV API_TARGET=http://core:3000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
