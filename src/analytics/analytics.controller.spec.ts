import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;

  const mockAnalyticsService = {
    getCategoryRevenueReport: vi.fn(),
    getExecutiveDashboard: vi.fn(),
    seedOrders: vi.fn(),
    getTopOrdersWithMargin: vi.fn(),
    getOrderDetailsWithCustomer: vi.fn(),
    deleteOrders: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getCategoryRevenueReport', async () => {
    const query = { startDate: new Date(), endDate: new Date() };
    await controller.getCategoryRevenueReport(query);
    expect(mockAnalyticsService.getCategoryRevenueReport).toHaveBeenCalledWith(
      query.startDate,
      query.endDate,
    );
  });

  it('should call getExecutiveDashboard', async () => {
    const query = { startDate: new Date('2026-01-01'), endDate: new Date('2026-02-01') };
    await controller.getExecutiveDashboard(query);
    expect(mockAnalyticsService.getExecutiveDashboard).toHaveBeenCalledWith(
      query.startDate,
      query.endDate,
    );
  });

  it('should call getTopOrdersWithMargin', async () => {
    await controller.getTopOrdersWithMargin(5);
    expect(mockAnalyticsService.getTopOrdersWithMargin).toHaveBeenCalledWith(5);
  });

  it('should call getOrderDetailsWithCustomer', async () => {
    await controller.getOrderDetailsWithCustomer('order-1');
    expect(mockAnalyticsService.getOrderDetailsWithCustomer).toHaveBeenCalledWith('order-1');
  });

  it('should call seedOrders', async () => {
    await controller.seedOrders(50);
    expect(mockAnalyticsService.seedOrders).toHaveBeenCalledWith(50);
  });

  it('should call deleteOrders', async () => {
    await controller.deleteOrders();
    expect(mockAnalyticsService.deleteOrders).toHaveBeenCalledTimes(1);
  });
});
