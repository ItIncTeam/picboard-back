import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
@Directive('@key(fields: "id")')
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field()
  username: string;

  @Field({ nullable: true })
  confirmationCode: string;

  @Field({ nullable: true })
  confirmationCodeExpDate: Date;

  @Field()
  isConfirmed: boolean;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field(() => ID, { nullable: true })
  profilePictureFileId?: string;
}
