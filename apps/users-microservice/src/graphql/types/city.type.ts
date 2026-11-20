import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class City {
  @Field(() => ID) id: string;
  @Field() name: string;
  @Field(() => String, { nullable: true }) nameRu?: string | null;
  @Field(() => ID) countryId: string;
  @Field(() => Int, { nullable: true }) population?: number | null;
}
