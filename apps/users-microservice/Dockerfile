# Check out https://hub.docker.com/_/node to select a new base image
FROM node:20.11-alpine
ARG port
ARG service
ENV SERVICE=$service
ENV PORT=$port

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Set to a non-root built-in user `node`

RUN corepack enable

USER node

# Create app directory (with user `node`)
RUN mkdir -p /home/node/dist/${SERVICE}

WORKDIR /home/node/dist/${SERVICE}

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)

COPY --chown=node package.json pnpm-lock.yaml pnpm-workspace.yaml nest-cli.json tsconfig.json ./
COPY --chown=node apps ./apps
COPY --chown=node libs ./libs
COPY --chown=node prisma ./prisma

#COPY --chown=node package*.json ./

RUN pnpm install --frozen-lockfile

# Bundle app source code
#COPY --chown=node . .

RUN pnpm prisma:generate:users:prod
RUN pnpm run build:users
#RUN npm run build:${SERVICE}

# Bind to all network interfaces so that it can be mapped to the host OS

EXPOSE ${PORT}

CMD [ "pnpm", "start:prod:users" ]

#CMD npm run 'start:users-microservice'
