import { Field, ID, ObjectType, Directive } from '@nestjs/graphql';

@ObjectType()
@Directive('@key(fields: "id")')
export class FileAsset {
  @Field(() => ID)
  id: string;

  @Field()
  ownerId: string;

  @Field({ nullable: true })
  url?: string;

  @Field()
  mimeType: string;

  @Field()
  purpose: string;
}
