import {
  Resolver,
  Query,
  Args,
  ResolveField,
  Parent,
  Context,
} from '@nestjs/graphql';
import { CategoryReport } from './models/category-report.model.js';
import { AnalyticsService } from './analytics.service.js';
import { DateRangeInput } from './dto/date-range.input.js';
import { CustomerModel } from './models/customer.model.js';
import type { CustomerDataLoader } from './loaders/customer.loader.js';

// Temporarily add these imports
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from './schemas/customer.schema.js';

@Resolver(() => CategoryReport)
export class AnalyticsResolver {
  constructor(
    private readonly analyticsService: AnalyticsService,
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
  ) {}

  @Query(() => [CategoryReport], { name: 'categoryReports' })
  async getCategoryReports(
    @Args('filter', { type: () => DateRangeInput, nullable: true })
    filter?: DateRangeInput,
  ): Promise<CategoryReport[]> {
    const rawReports = await this.analyticsService.getCategoryRevenueReport(
      filter?.startDate ?? new Date(0),
      filter?.endDate ?? new Date(),
    );

    return rawReports.map((report: any) => ({
      id: report.category,
      category: report.category,
      topCustomerId: report.topCustomerId,
      metrics: {
        totalRevenue: report.totalRevenue,
        totalOrders: report.totalOrders,
        averageOrderValue: report.averageOrderValue,
      },
    }));
  }

  @ResolveField(() => String)
  formattedSummary(@Parent() report: CategoryReport): string {
    return `Category ${report.category}: $${report.metrics?.totalRevenue ?? 0}`;
  }

  @ResolveField(() => CustomerModel, { nullable: true })
  async topPerformerCustomer(
    @Parent() report: CategoryReport,
    @Context('customerLoader') customerLoader: CustomerDataLoader,
  ) {
    if (!report.topCustomerId) {
      return null;
    }

    // --- Variant Without DATALOADER (Classic N+1) ---
    // const customer = await this.customerModel.findOne({
    //   _id: report.topCustomerId,
    // });

    // --- Variant With DATALOADER (Batching) ---
    const customer = await customerLoader.load(report.topCustomerId);

    if (!customer) {
      return null;
    }

    return {
      id: customer._id,
      name: customer.name,
      email: customer.email,
      tier: customer.tier,
    };
  }
}
