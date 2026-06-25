# ---- Build stage ----
FROM node:18-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# npm ci deterministik; npm surum-drift lock uyusmazliginda npm install'a duser.
RUN npm ci || npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ---- Serve stage ----
FROM nginx:1.27-alpine AS serve

# Angular 18 application builder emits the static site under dist/<project>/browser.
# Verified locally: output dir is dist/frontend/browser (index.html present).
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
