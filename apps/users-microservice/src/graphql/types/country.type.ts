import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Country {
  @Field(() => ID) id: string;
  @Field() code: string;
  @Field() name: string;
  @Field(() => String, { nullable: true }) nameRu?: string | null;
}
