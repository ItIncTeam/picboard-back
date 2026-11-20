import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('File')
@Directive('@extends')
@Directive('@key(fields: "id")')
export class FileReference {
  @Field(() => ID)
  @Directive('@external')
  id: string;
}
