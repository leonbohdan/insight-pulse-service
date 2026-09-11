import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('CategoryMetrics')
export class CategoryMetrics {
  @Field(() => Float)
  totalRevenue: number;

  @Field(() => Int)
  totalOrders: number;

  @Field(() => Float)
  averageOrderValue: number;
}

@ObjectType('CategoryReport')
export class CategoryReport {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  category: string;

  @Field(() => String, { nullable: true })
  topCustomerId?: string;

  @Field(() => CategoryMetrics)
  metrics: CategoryMetrics;
}
