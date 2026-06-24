import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
@Directive('@key(fields: "id")')
export class FileReference {
  @Field(() => ID)
  id: string;
}
