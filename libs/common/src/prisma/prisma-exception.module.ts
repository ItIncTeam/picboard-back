import { DynamicModule, Module, Provider } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { PrismaExceptionFilter } from './prisma-exception.filter';
import {
  PRISMA_EXCEPTION_OPTIONS,
  PrismaExceptionOptions,
} from './prisma-exception.constants';

@Module({})
export class PrismaExceptionModule {
  static forRoot(options: PrismaExceptionOptions): DynamicModule {
    return PrismaExceptionModule.build({
      provide: PRISMA_EXCEPTION_OPTIONS,
      useValue: options,
    });
  }

  static forRootAsync(options: {
    imports?: any[];
    inject?: any[];
    useFactory: (
      ...args: any[]
    ) => Promise<PrismaExceptionOptions> | PrismaExceptionOptions;
  }): DynamicModule {
    return PrismaExceptionModule.build(
      {
        provide: PRISMA_EXCEPTION_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      },
      options.imports ?? [],
    );
  }

  private static build(
    optionsProvider: Provider,
    imports: any[] = [],
  ): DynamicModule {
    return {
      module: PrismaExceptionModule,
      imports,
      providers: [
        optionsProvider,
        { provide: APP_FILTER, useClass: PrismaExceptionFilter },
      ],
    };
  }
}
