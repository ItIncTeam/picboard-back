import { ConfigModule } from '@nestjs/config';
import { join } from 'path';

/*//simplified
export const configModule = ConfigModule.forRoot({
  envFilePath: [
    /!*process.env.ENV_FILE_PATH?.trim(),*!/
    `apps/users-microservice/.env.${process.env.NODE_ENV}.local`,
    `apps/users-microservice/.env.${process.env.NODE_ENV}`,
    'apps/users-microservice/.env.production',
  ],
  isGlobal: true,
});*/

/*//dimych
export const configModule = ConfigModule.forRoot({
  envFilePath: [
    process.env.ENV_FILE_PATH?.trim() || '',
    join(
      __dirname,
      'env',
      `apps/users-microservice/src/env/.env.${process.env.NODE_ENV}.local`,
    ),
    join(
      __dirname,
      'env',
      `apps/users-microservice/src/env/.env.${process.env.NODE_ENV}`,
    ),
    join(__dirname, 'env', 'apps/users-microservice/.env.production'),
  ].filter((path): path is string => Boolean(path)),
  isGlobal: true,
});*/

//For env files in a Nest monorepo, process.cwd() is often simpler because it points to the directory where you started the Node process, while __dirname points to the compiled file’s location, which may move under dist/ after build.If your current config file ends up compiled into something like dist/apps/users-microservice/..., then __dirname may no longer line up with your repository root the way you expect. process.cwd() is usually more stable for repo-root-based paths, especially when you start Nest commands from the monorepo root.
export const configModule = ConfigModule.forRoot({
  envFilePath: [
    process.env.ENV_FILE_PATH?.trim(),
    join(
      process.cwd(),
      'apps/users-microservice/src/env/.env.' + process.env.NODE_ENV + '.local',
    ),
    join(
      process.cwd(),
      'apps/users-microservice/src/env/.env.' + process.env.NODE_ENV,
    ),
    join(process.cwd(), 'apps/users-microservice/src/env/.env'),
  ].filter((path): path is string => Boolean(path)),
  isGlobal: true,
});
