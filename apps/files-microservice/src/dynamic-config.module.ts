import { ConfigModule } from '@nestjs/config';
import { join } from 'path';

export const configModule = ConfigModule.forRoot({
  envFilePath: [
    process.env.ENV_FILE_PATH?.trim(),
    join(
      process.cwd(),
      'apps/files-microservice/src/env/.env.' + process.env.NODE_ENV + '.local',
    ),
    join(
      process.cwd(),
      'apps/files-microservice/src/env/.env.' + process.env.NODE_ENV,
    ),
    join(process.cwd(), 'apps/files-microservice/src/env/.env'),
  ].filter((path): path is string => Boolean(path)),
  isGlobal: true,
});
