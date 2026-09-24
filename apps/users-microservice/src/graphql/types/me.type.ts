import { Field, ID, ObjectType } from '@nestjs/graphql';
import { FileReference } from './file-reference.type';

@ObjectType()
export class Me {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field()
  username: string;

  @Field()
  isConfirmed: boolean;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field(() => ID, { nullable: true })
  profilePictureFileId?: string;

  @Field(() => FileReference, { nullable: true })
  avatar?: FileReference;
}
