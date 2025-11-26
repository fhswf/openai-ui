FROM node:20-alpine as build

ARG VERSION=0.0.0
ARG BUILD_SHA=unknown

WORKDIR /app

COPY package.json /app
COPY yarn.lock /app
COPY . /app

RUN corepack enable && YARN_ENABLE_SCRIPTS=false yarn install --frozen-lockfile 
ENV NODE_ENV=production
ENV VITE_API_URL=/api/v1/chat/completions
ENV VITE_API_BASE_URL=https://openai.ki.fh-swf.de/api/v1
ENV VITE_LOGIN_URL=/api/login
ENV VITE_LOGOUT_URL=/api/logout
ENV VITE_USER_URL=/api/user
ENV VITE_DASHBOARD_URL=/api/dashboard
ENV VITE_VERSION=$VERSION
ENV VITE_BUILD_SHA=$BUILD_SHA

RUN NODE_ENV=production yarn run build

FROM nginx:1.29-bookworm

COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]