export interface DashboardSummary {
  totalRevenue: number;
  avgOrderValue: number;
  totalOrders: number;
}

export interface TopProductItem {
  productId: string;
  totalSold: number;
  totalRevenue: number;
  title?: string;
}

export interface CategoryBreakdownItem {
  category: string;
  totalRevenue: number;
  orderCount: number;
}

export interface PriceTierItem {
  _id: string | number;
  count: number;
  totalRevenue: number;
}

export interface ExecutiveDashboardResponseDto {
  summary: DashboardSummary;
  topProducts: TopProductItem[];
  categoryBreakdown: CategoryBreakdownItem[];
  priceTiers: PriceTierItem[];
}
