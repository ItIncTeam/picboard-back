import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: './schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url:
      env('DATABASE_DIRECT_URL') ||
      'postgresql://dummy:dummy@localhost:5432/dummy',
  },
});
