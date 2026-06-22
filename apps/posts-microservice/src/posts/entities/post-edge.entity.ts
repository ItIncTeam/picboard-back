import { Field, ObjectType } from '@nestjs/graphql';
import { PostEntity } from './post.entity';

@ObjectType()
export class PostEdge {
  @Field()
  cursor: string;

  @Field(() => PostEntity)
  node: PostEntity;
}
