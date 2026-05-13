import { Field, ID, ObjectType, Directive } from '@nestjs/graphql';

@ObjectType()
@Directive('@key(fields: "id")')
export class Post {
  @Field(() => ID)
  id: string;

  @Field()
  authorId: string;

  @Field()
  text: string;

  @Field({ nullable: true })
  coverImageFileId?: string;
}
