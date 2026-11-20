# Check out https://hub.docker.com/_/node to select a new base image
FROM node:20.20.2-alpine
ARG port
ARG service
ENV SERVICE=$service
ENV PORT=$port
# Set to a non-root built-in user `node`

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

#hardcoded pnpm version
RUN npm install -g pnpm@10.13.1

USER node

RUN mkdir -p /home/node/dist/${SERVICE}
WORKDIR /home/node/dist/${SERVICE}


COPY --chown=node package.json pnpm-lock.yaml pnpm-workspace.yaml nest-cli.json tsconfig.json ./
COPY --chown=node apps ./apps
COPY --chown=node libs ./libs
COPY --chown=node prisma ./prisma

RUN pnpm install --frozen-lockfile
RUN pnpm prisma:generate:posts:deployment
RUN pnpm run build:posts



EXPOSE ${PORT}

CMD [ "pnpm", "start:prod:posts" ]
