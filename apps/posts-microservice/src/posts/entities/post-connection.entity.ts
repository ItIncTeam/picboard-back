import { Field, ObjectType } from '@nestjs/graphql';
import { PostEdge } from './post-edge.entity';
import { PageInfo } from './page-info.entity';

@ObjectType()
export class PostConnection {
  @Field(() => [PostEdge])
  edges: PostEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;
}
