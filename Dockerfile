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

COPY --chown=node package.json pnpm-lock.yaml pnpm-workspace.yaml nest-cli.json tsconfig.json ./
COPY --chown=node apps ./apps
COPY --chown=node libs ./libs
COPY --chown=node prisma ./prisma

RUN pnpm install --frozen-lockfile

ENV PORT=4325
# Bundle app source code


RUN pnpm prisma:generate:users:prod
RUN pnpm run build:users

# Опционально: удаляем dev-зависимости после сборки (если не нужны в runtime)
# RUN pnpm prune --prod

# Bind to all network interfaces so that it can be mapped to the host OS

EXPOSE ${PORT}

CMD [ "pnpm", "start:prod:users" ]
