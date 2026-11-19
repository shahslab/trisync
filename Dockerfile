# TriSync's web app (the PWA) on Fly.io at https://trisync.fly.dev: build the static web
# export, then serve it with nginx. Deploy with `fly deploy` from the repo root.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN EXPO_NO_DOTENV=1 npx expo export -p web --output-dir dist

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
