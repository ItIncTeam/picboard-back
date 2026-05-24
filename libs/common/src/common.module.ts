import { Module } from '@nestjs/common';

@Module({
  providers: [
    /*MyLoggingInterceptor, MyValidationPipe*/
  ],
  exports: [
    /*MyLoggingInterceptor, MyValidationPipe*/
  ],
})
export class CommonModule {}
