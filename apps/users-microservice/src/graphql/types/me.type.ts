import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Country } from './country.type';
import { City } from './city.type';
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

  @Field(() => ID, { nullable: true })
  countryId?: string;

  @Field(() => ID, { nullable: true })
  cityId?: string;

  @Field(() => Country, { nullable: true })
  country?: Country;

  @Field(() => City, { nullable: true })
  city?: City;

  @Field(() => FileReference, { nullable: true })
  avatar?: FileReference;
}
