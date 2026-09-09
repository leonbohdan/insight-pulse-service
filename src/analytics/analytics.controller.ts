import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { DateRangeDto } from './dto/date-range.dto.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('categories')
  async getCategoryRevenueReport(@Query() dateRangeDto: DateRangeDto) {
    const { startDate, endDate } = dateRangeDto;
    return this.analyticsService.getCategoryRevenueReport(startDate, endDate);
  }

  @Post('seed')
  async seedOrders(@Query('count') count: number = 10000) {
    return this.analyticsService.seedOrders(count);
  }

  @Get('orders/:orderId')
  async getOrderDetailsWithCustomer(@Param('orderId') orderId: string) {
    return this.analyticsService.getOrderDetailsWithCustomer(orderId);
  }

  @Delete('delete')
  async deleteOrders() {
    return this.analyticsService.deleteOrders();
  }
}
