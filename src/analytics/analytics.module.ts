import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OrderAnalytics,
  OrderAnalyticsSchema,
} from './schemas/order-analytics.schema.js';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsController } from './analytics.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrderAnalytics.name, schema: OrderAnalyticsSchema },
    ]),
  ],
  providers: [AnalyticsService],
  exports: [MongooseModule, AnalyticsService],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
