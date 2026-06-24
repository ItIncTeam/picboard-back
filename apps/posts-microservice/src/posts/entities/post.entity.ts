import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';
import { PostAttachmentEntity } from './post-attachment.entity';

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

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
