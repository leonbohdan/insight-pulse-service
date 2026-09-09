import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const TierStatus = {
  BRONZE: 'BRONZE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
} as const;

export type TierStatus = (typeof TierStatus)[keyof typeof TierStatus];

const EmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Schema({ timestamps: true })
export class Customer {
  @Prop({ required: true, unique: true })
  _id: string;

  @Prop({ required: true, index: true })
  name: string;

  @Prop({
    required: true,
    unique: true,
    validate: {
      validator: (v: string) => EmailRegex.test(v),
      message: 'Please enter a valid email',
    },
  })
  email: string;

  @Prop({ required: true, type: String, enum: Object.values(TierStatus) })
  tier: TierStatus;
}

export type CustomerDocument = HydratedDocument<Customer>;
export const CustomerSchema = SchemaFactory.createForClass(Customer);
