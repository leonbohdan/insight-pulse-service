import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AnalyticsService } from './analytics.service.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsResolver } from './analytics.resolver.js';

import {
  OrderAnalytics,
  OrderAnalyticsSchema,
} from './schemas/order-analytics.schema.js';
import { Product, ProductSchema } from './schemas/product.schema.js';
import { Customer, CustomerSchema } from './schemas/customer.schema.js';

import { CustomerLoaderFactory } from './loaders/customer.loader.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrderAnalytics.name, schema: OrderAnalyticsSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Customer.name, schema: CustomerSchema },
    ]),
  ],
  providers: [AnalyticsService, AnalyticsResolver, CustomerLoaderFactory],
  exports: [MongooseModule, AnalyticsService, CustomerLoaderFactory],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
