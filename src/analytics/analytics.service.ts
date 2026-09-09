import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';

import {
  OrderAnalytics,
  OrderAnalyticsDocument,
  OrderStatus,
} from './schemas/order-analytics.schema.js';
import { Product, ProductDocument } from './schemas/product.schema.js';
import {
  Customer,
  CustomerDocument,
  TierStatus,
} from './schemas/customer.schema.js';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(OrderAnalytics.name)
    private readonly orderAnalyticsModel: Model<OrderAnalyticsDocument>,

    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,

    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
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

  async seedOrders(count: number = 10000): Promise<{
    customers: number;
    products: number;
    orders: number;
  }> {
    await this.deleteOrders();

    // Generate 100 customers
    const tiers = Object.values(TierStatus);

    const customers: Customer[] = Array.from({ length: 100 }, (_, i) => ({
      _id: randomUUID(),
      name: `Customer ${i + 1}`,
      email: `customer_${i + 1}_${Date.now()}@example.com`,
      tier: tiers[Math.floor(Math.random() * tiers.length)],
    }));

    // Generate 50 products
    const categories = ['Tech', 'Home', 'Fashion', 'Auto'];

    const products: Product[] = Array.from({ length: 50 }, (_, i) => {
      const category =
        categories[Math.floor(Math.random() * categories.length)];
      const costPrice = Math.floor(Math.random() * 150) + 10;

      return {
        _id: randomUUID(),
        sku: `SKU-${category.toUpperCase()}-${1000 + i}`,
        title: `${category} Product ${i + 1}`,
        costPrice,
      };
    });

    // Insert customers and products
    const [savedCustomers, savedProducts] = await Promise.all([
      this.customerModel.insertMany(customers),
      this.productModel.insertMany(products),
    ]);

    // Generate orders with random customers and products
    const orders: OrderAnalytics[] = [];

    for (let i = 0; i < count; i++) {
      const customer =
        savedCustomers[Math.floor(Math.random() * savedCustomers.length)];
      const category =
        categories[Math.floor(Math.random() * categories.length)];

      // Pick 1–4 random products per order
      const itemsCountInOrder = Math.floor(Math.random() * 4) + 1;
      const orderItems = [];
      let calculatedTotalPrice = 0;
      let totalQuantity = 0;

      for (let j = 0; j < itemsCountInOrder; j++) {
        const product =
          savedProducts[Math.floor(Math.random() * savedProducts.length)];
        const quantity = Math.floor(Math.random() * 3) + 1;

        const markup = 1 + Math.random() * 0.6 + 0.2;
        const unitPrice = Math.round(product.costPrice * markup);

        orderItems.push({
          productId: product._id,
          quantity,
          price: unitPrice,
        });

        calculatedTotalPrice += unitPrice * quantity;
        totalQuantity += quantity;
      }

      orders.push({
        orderId: randomUUID(),
        customerId: customer._id,
        category,
        totalPrice: calculatedTotalPrice,
        itemsCount: totalQuantity,
        status: this.getRandomStatus(),
        orderedAt: new Date(
          Date.now() - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000),
        ),
        items: orderItems,
      });
    }

    // Insert orders
    const savedOrders = await this.orderAnalyticsModel.insertMany(orders);

    return {
      customers: savedCustomers.length,
      products: savedProducts.length,
      orders: savedOrders.length,
    };
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

  async getOrderDetailsWithCustomer(orderId: string) {
    const [order] = await this.orderAnalyticsModel.aggregate([
      {
        $match: {
          orderId,
        },
      },
      {
        $lookup: {
          from: this.customerModel.collection.name,
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer',
        },
      },
      {
        $unwind: {
          path: '$customer',
          preserveNullAndEmptyArrays: true,
        },
      },
    ]);

    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    return order;
  }

  async deleteOrders() {
    const [orders, customers, products] = await Promise.all([
      this.orderAnalyticsModel.deleteMany({}),
      this.customerModel.deleteMany({}),
      this.productModel.deleteMany({}),
    ]);

    return {
      deletedOrders: orders.deletedCount,
      deletedCustomers: customers.deletedCount,
      deletedProducts: products.deletedCount,
    };
  }
}
