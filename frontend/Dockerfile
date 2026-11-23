# syntax=docker/dockerfile:1
# Builds either frontend app: docker build --build-arg APP=storefront|admin
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/api-client/package.json packages/api-client/
COPY storefront/package.json storefront/
COPY admin/package.json admin/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
ARG APP
RUN test -n "$APP" && npm run build -w "$APP"

FROM nginxinc/nginx-unprivileged:1.27-alpine
ARG APP
ENV BACKEND_URL=http://backend:8000 \
    MEDIA_URL=http://minio:9000 \
    MEDIA_BUCKET=fruchi-media \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    NGINX_ENVSUBST_FILTER="^(BACKEND_URL|MEDIA_URL|MEDIA_BUCKET|NGINX_LOCAL_RESOLVERS)$"
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/${APP}.locations.conf /etc/nginx/app-locations.conf
COPY --from=build /app/${APP}/dist /usr/share/nginx/html
EXPOSE 8080
