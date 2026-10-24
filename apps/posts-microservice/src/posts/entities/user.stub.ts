import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';
import { PostEntity } from './post.entity';

@ObjectType('User')
@Directive('@extends')
@Directive('@key(fields: "id")')
export class User {
  @Field(() => ID)
  @Directive('@external')
  id: string;

  @Field(() => [PostEntity], { nullable: 'itemsAndList' })
  posts?: PostEntity[];
}
