import { AppConfig } from './app.config';
import { Module } from '@nestjs/common';

@Module({
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}