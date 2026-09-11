import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { CustomerLoaderFactory } from './analytics/loaders/customer.loader.js';

import depthLimit from 'graphql-depth-limit';
import {
  getComplexity,
  simpleEstimator,
  fieldExtensionsEstimator,
} from 'graphql-query-complexity';
import { GraphQLError } from 'graphql';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    AnalyticsModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [AnalyticsModule],
      inject: [CustomerLoaderFactory],
      useFactory: (customerLoaderFactory: CustomerLoaderFactory) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        sortSchema: true,
        playground: true,
        validationRules: [depthLimit(5)],
        plugins: [
          {
            async requestDidStart({ schema }) {
              return {
                async didResolveOperation({ request, document }) {
                  const complexity = getComplexity({
                    schema,
                    operationName: request.operationName,
                    query: document,
                    variables: request.variables,
                    estimators: [
                      fieldExtensionsEstimator(),
                      simpleEstimator({ defaultComplexity: 1 }),
                    ],
                  });

                  const maxComplexity = 100;

                  if (complexity > maxComplexity) {
                    throw new GraphQLError(
                      `Query complexity is too high: ${complexity}. Maximum allowed: ${maxComplexity}`,
                    );
                  }
                },
              };
            },
          },
        ],
        context: ({ req, res }: { req: any; res: any }) => ({
          req,
          res,
          customerLoader: customerLoaderFactory.createLoader(),
        }),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
