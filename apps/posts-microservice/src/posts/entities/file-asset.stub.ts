import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
@Directive('@key(fields: "id", resolvable: false)')
export class FileAsset {
  @Field(() => ID)
  id: string;
}
