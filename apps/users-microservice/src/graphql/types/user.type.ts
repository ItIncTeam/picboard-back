import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';
import { Country } from './country.type';
import { City } from './city.type';
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

  @Field(() => ID, { nullable: true })
  countryId?: string;

  @Field(() => ID, { nullable: true })
  cityId?: string;

  @Field(() => FileReference, { nullable: true })
  avatar?: FileReference;

  @Field(() => Country, { nullable: true })
  country?: Country;

  @Field(() => City, { nullable: true })
  city?: City;
}
