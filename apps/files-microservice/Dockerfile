# Check out https://hub.docker.com/_/node to select a new base image
FROM node:20.20.2-alpine
ARG port
ARG service
ENV SERVICE=$service
ENV PORT=$port
ENV DATABASE_DIRECT_URL="postgresql://neondb_owner:npg_GoacVwi4b7dy@ep-broad-shadow-alxx727o.c-3.eu-central-1.aws.neon.tech/files_db?sslmode=require&channel_binding=require"
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

#hardcoded pnpm version
RUN npm install -g pnpm@10.13.1

# Set to a non-root built-in user `node`

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

RUN pnpm install --frozen-lockfile
RUN pnpm prisma:generate:files:deployment
RUN pnpm run build:files

# Bind to all network interfaces so that it can be mapped to the host OS

EXPOSE ${PORT}

CMD [ "pnpm", "start:prod:files" ]
