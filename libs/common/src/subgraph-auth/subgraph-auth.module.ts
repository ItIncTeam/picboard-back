import { DynamicModule, Module } from '@nestjs/common';
import { SubgraphGatewayAuthMiddleware } from './subgraph-gateway-auth.middleware';
import {
  SUBGRAPH_AUTH_OPTIONS,
  SubgraphAuthOptions,
} from '@app/common/subgraph-auth/sungraph-auth.constants';

@Module({})
export class SubgraphAuthModule {
  static forRoot(options: SubgraphAuthOptions): DynamicModule {
    return {
      module: SubgraphAuthModule,
      providers: [
        {
          provide: SUBGRAPH_AUTH_OPTIONS,
          useValue: options,
        },
        SubgraphGatewayAuthMiddleware,
      ],
      exports: [SUBGRAPH_AUTH_OPTIONS, SubgraphGatewayAuthMiddleware],
    };
  }

  static forRootAsync(options: {
    inject?: any[];
    imports?: any[];
    useFactory: (
      ...args: any[]
    ) => Promise<SubgraphAuthOptions> | SubgraphAuthOptions;
  }): DynamicModule {
    return {
      module: SubgraphAuthModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: SUBGRAPH_AUTH_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
        SubgraphGatewayAuthMiddleware,
      ],
      exports: [SUBGRAPH_AUTH_OPTIONS, SubgraphGatewayAuthMiddleware],
    };
  }
}
