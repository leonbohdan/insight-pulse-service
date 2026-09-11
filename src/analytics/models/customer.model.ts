import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Customer')
export class CustomerModel {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  email: string;

  @Field(() => String)
  tier: string;
}
