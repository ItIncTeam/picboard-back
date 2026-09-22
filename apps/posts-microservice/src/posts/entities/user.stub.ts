import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';
import { PostEntity } from './post.entity';

@ObjectType()
@Directive('@key(fields: "id")')
export class User {
  @Field(() => ID)
  id: string;

  @Field(() => [PostEntity], { nullable: 'itemsAndList' })
  posts?: PostEntity[];
}
