import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  OrderAnalytics,
  OrderAnalyticsDocument,
  OrderStatus,
} from './schemas/order-analytics.schema.js';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(OrderAnalytics.name)
    private readonly orderAnalyticsModel: Model<OrderAnalyticsDocument>,
  ) {}

  private getRandomStatus(): OrderStatus {
    const rand = Math.random();
    if (rand < 0.7) {
      return OrderStatus.COMPLETED;
    }
    if (rand < 0.85) {
      return OrderStatus.CANCELLED;
    }
    return OrderStatus.REFUNDED;
  }

  seedOrders(count: number = 10000): Promise<number> {
    const orders: OrderAnalytics[] = [];
    const categories = ['Tech', 'Home', 'Fashion', 'Auto'];

    for (let i = 0; i < count; i++) {
      orders.push({
        orderId: randomUUID(),
        customerId: randomUUID(),
        category: categories[Math.floor(Math.random() * categories.length)],
        totalPrice: Math.floor(Math.random() * 1000) + 1,
        itemsCount: Math.floor(Math.random() * 10) + 1,
        status: this.getRandomStatus(),
        orderedAt: new Date(
          Date.now() - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000),
        ),
      });
    }

    return this.orderAnalyticsModel
      .insertMany(orders)
      .then((res) => res.length);
  }

  getCategoryRevenueReport(startDate: Date, endDate: Date) {
    return this.orderAnalyticsModel.aggregate([
      {
        $match: {
          status: OrderStatus.COMPLETED,
          orderedAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $project: {
          _id: 0,
          orderId: 1,
          customerId: 1,
          category: 1,
          totalPrice: 1,
          itemsCount: 1,
          status: 1,
          orderedAt: 1,
        },
      },
      {
        $group: {
          _id: '$category',
          totalRevenue: { $sum: '$totalPrice' },
          totalOrders: { $sum: 1 },
          totalItems: { $sum: '$itemsCount' },
          averageOrderValue: { $avg: '$totalPrice' },
        },
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          totalRevenue: 1,
          totalOrders: 1,
          totalItems: 1,
          averageOrderValue: { $round: ['$averageOrderValue', 2] },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
    ]);
  }

  async deleteOrders() {
    return this.orderAnalyticsModel.deleteMany({});
  }
}
