import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';
import { FileReference } from './file-reference.type';

@ObjectType()
@Directive('@key(fields: "id")')
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  username: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field(() => ID, { nullable: true })
  profilePictureFileId?: string;

  @Field(() => FileReference, { nullable: true })
  avatar?: FileReference;
}
