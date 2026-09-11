import DataLoader from 'dataloader';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer, CustomerDocument } from '../schemas/customer.schema.js';

export type CustomerDataLoader = DataLoader<string, CustomerDocument | null>;

@Injectable()
export class CustomerLoaderFactory {
  constructor(
    @InjectModel(Customer.name)
    private readonly customerModel: Model<CustomerDocument>,
  ) {}

  createLoader(): CustomerDataLoader {
    return new DataLoader<string, CustomerDocument | null>(
      async (customerIds: readonly string[]) => {
        // 1. Get all customers in one batch
        const customers = await this.customerModel
          .find({
            _id: { $in: customerIds },
          })
          .exec();

        // 2. Index the result through a Map for O(1) access
        const customerMap = new Map<string, CustomerDocument>(
          customers.map((c) => [c._id.toString(), c]),
        );

        // 3. Return the result STRICTLY IN THE ORDER OF customerIds!
        // If the customer is not found, return null
        return customerIds.map((id) => customerMap.get(id) ?? null);
      },
    );
  }
}
