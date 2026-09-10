import { Resolver, Query, Args, ResolveField, Parent } from '@nestjs/graphql';
import { CategoryReport } from './models/category-report.model.js';
import { AnalyticsService } from './analytics.service.js';
import { DateRangeInput } from './dto/date-range.input.js';

@Resolver(() => CategoryReport)
export class AnalyticsResolver {
  constructor(private readonly analyticsService: AnalyticsService) {}

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
}
