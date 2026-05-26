# Check out https://hub.docker.com/_/node to select a new base image
FROM node:20.11-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

# Install pnpm globally
# RUN npm install -g pnpm@latest-9

# Set to a non-root built-in user `node`
USER node

# Create app directory (with user `node`)
RUN mkdir -p /home/node/dist/app

WORKDIR /home/node/dist/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)

#COPY --chown=node package*.json ./

COPY --chown=node package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

ENV PORT=3001
# Bundle app source code
COPY --chown=node . .

RUN pnpm prisma:generate:users
RUN pnpm run build:users

# Опционально: удаляем dev-зависимости после сборки (если не нужны в runtime)
# RUN pnpm prune --prod

# Bind to all network interfaces so that it can be mapped to the host OS

EXPOSE ${PORT}

CMD [ "pnpm", "start:prod:users" ]
