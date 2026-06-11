FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:prod

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server.js .
RUN npm install express
EXPOSE 3000
CMD ["node", "server.js"]
