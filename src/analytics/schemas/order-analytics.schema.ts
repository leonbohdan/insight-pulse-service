import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const OrderStatus = {
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED',
  CANCELLED: 'CANCELLED',
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

@Schema({ timestamps: true })
export class OrderAnalytics {
  @Prop({ required: true, unique: true })
  orderId: string;

  @Prop({ required: true, index: true })
  customerId: string;

  @Prop({ required: true, index: true })
  category: string;

  @Prop({ required: true })
  totalPrice: number;

  @Prop({ required: true })
  itemsCount: number;

  @Prop({ required: true, type: String, enum: Object.values(OrderStatus) })
  status: OrderStatus;

  @Prop({ required: true, index: true })
  orderedAt: Date;

  @Prop({
    type: [
      {
        productId: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    default: [],
  })
  items: {
    productId: string;
    quantity: number;
    price: number;
  }[];
}

export type OrderAnalyticsDocument = HydratedDocument<OrderAnalytics>;
export const OrderAnalyticsSchema =
  SchemaFactory.createForClass(OrderAnalytics);

OrderAnalyticsSchema.index({ status: 1, orderedAt: -1 });
