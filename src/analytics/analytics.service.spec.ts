import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics.service.js';
import {
  Customer,
  TierStatus,
} from './schemas/customer.schema.js';
import {
  OrderAnalytics,
  OrderStatus,
} from './schemas/order-analytics.schema.js';
import { Product } from './schemas/product.schema.js';

describe('AnalyticsService', () => {
  let service: AnalyticsService;

  const mockOrderModel = {
    aggregate: vi.fn(),
    insertMany: vi.fn(),
    deleteMany: vi.fn(),
  };

  const mockProductModel = {
    collection: { name: 'products' },
    insertMany: vi.fn(),
    deleteMany: vi.fn(),
  };

  const mockCustomerModel = {
    collection: { name: 'customers' },
    insertMany: vi.fn(),
    deleteMany: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getModelToken(OrderAnalytics.name),
          useValue: mockOrderModel,
        },
        {
          provide: getModelToken(Product.name),
          useValue: mockProductModel,
        },
        {
          provide: getModelToken(Customer.name),
          useValue: mockCustomerModel,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrderDetailsWithCustomer', () => {
    it('should return order details when found', async () => {
      const mockOrder = {
        orderId: 'order-123',
        customerId: 'customer-123',
        customer: {
          _id: 'customer-123',
          name: 'Jane Doe',
          email: 'jane@example.com',
          tier: TierStatus.GOLD,
        },
      };

      mockOrderModel.aggregate.mockResolvedValue([mockOrder]);

      const result = await service.getOrderDetailsWithCustomer('order-123');

      expect(result).toEqual(mockOrder);
      expect(mockOrderModel.aggregate).toHaveBeenCalledWith([
        { $match: { orderId: 'order-123' } },
        {
          $lookup: {
            from: 'customers',
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
    });

    it('should throw NotFoundException when order is not found', async () => {
      mockOrderModel.aggregate.mockResolvedValue([]);

      await expect(
        service.getOrderDetailsWithCustomer('non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTopOrdersWithMargin', () => {
    it('should execute aggregation pipeline and return top margin orders', async () => {
      const mockTopOrders = [
        {
          orderId: 'order-1',
          totalPrice: 1500,
          totalCost: 500,
          margin: 1000,
          marginPercentage: 66.67,
        },
      ];

      mockOrderModel.aggregate.mockResolvedValue(mockTopOrders);

      const result = await service.getTopOrdersWithMargin(5);

      expect(result).toEqual(mockTopOrders);
      expect(mockOrderModel.aggregate).toHaveBeenCalledTimes(1);

      const pipeline = mockOrderModel.aggregate.mock.calls[0][0];
      expect(pipeline[0]).toEqual({
        $match: { status: OrderStatus.COMPLETED },
      });
      expect(pipeline[pipeline.length - 1]).toEqual({ $limit: 5 });
    });

    it('should use default limit of 10 if invalid limit is passed', async () => {
      mockOrderModel.aggregate.mockResolvedValue([]);

      await service.getTopOrdersWithMargin(0);

      const pipeline = mockOrderModel.aggregate.mock.calls[0][0];
      expect(pipeline[pipeline.length - 1]).toEqual({ $limit: 10 });
    });
  });

  describe('getCategoryRevenueReport', () => {
    it('should execute category aggregation with date range', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-02-01');
      const mockReport = [
        {
          category: 'Tech',
          totalRevenue: 50000,
          totalOrders: 100,
          totalItems: 300,
          averageOrderValue: 500,
        },
      ];

      mockOrderModel.aggregate.mockResolvedValue(mockReport);

      const result = await service.getCategoryRevenueReport(startDate, endDate);

      expect(result).toEqual(mockReport);
      expect(mockOrderModel.aggregate).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteOrders', () => {
    it('should delete from orders, customers, and products collections', async () => {
      mockOrderModel.deleteMany.mockResolvedValue({ deletedCount: 15 });
      mockCustomerModel.deleteMany.mockResolvedValue({ deletedCount: 5 });
      mockProductModel.deleteMany.mockResolvedValue({ deletedCount: 8 });

      const result = await service.deleteOrders();

      expect(result).toEqual({
        deletedOrders: 15,
        deletedCustomers: 5,
        deletedProducts: 8,
      });
      expect(mockOrderModel.deleteMany).toHaveBeenCalledWith({});
      expect(mockCustomerModel.deleteMany).toHaveBeenCalledWith({});
      expect(mockProductModel.deleteMany).toHaveBeenCalledWith({});
    });
  });

  describe('seedOrders', () => {
    it('should seed customers, products, and orders', async () => {
      mockOrderModel.deleteMany.mockResolvedValue({ deletedCount: 0 });
      mockCustomerModel.deleteMany.mockResolvedValue({ deletedCount: 0 });
      mockProductModel.deleteMany.mockResolvedValue({ deletedCount: 0 });

      mockCustomerModel.insertMany.mockImplementation((docs) =>
        Promise.resolve(docs),
      );
      mockProductModel.insertMany.mockImplementation((docs) =>
        Promise.resolve(docs),
      );
      mockOrderModel.insertMany.mockImplementation((docs) =>
        Promise.resolve(docs),
      );

      const result = await service.seedOrders(10);

      expect(result).toEqual({
        customers: 100,
        products: 50,
        orders: 10,
      });
      expect(mockCustomerModel.insertMany).toHaveBeenCalledTimes(1);
      expect(mockProductModel.insertMany).toHaveBeenCalledTimes(1);
      expect(mockOrderModel.insertMany).toHaveBeenCalledTimes(1);
    });
  });
});
