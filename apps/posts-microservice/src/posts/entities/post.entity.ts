import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';
import { PostAttachmentEntity } from './post-attachment.entity';
import { User } from './user.stub';

@ObjectType()
@Directive('@key(fields: "id")')
export class PostEntity {
  @Field(() => ID)
  id: string;

  @Field()
  ownerId: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => [PostAttachmentEntity])
  attachments: PostAttachmentEntity[];

  @Field(() => User)
  author?: User;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
