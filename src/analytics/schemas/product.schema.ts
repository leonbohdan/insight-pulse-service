import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, unique: true })
  _id: string;

  @Prop({ required: true, unique: true })
  sku: string;

  @Prop({ required: true, index: true })
  title: string;

  @Prop({ required: true })
  costPrice: number;
}

export type ProductDocument = HydratedDocument<Product>;
export const ProductSchema = SchemaFactory.createForClass(Product);
