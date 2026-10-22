import {
  Context,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { UnauthorizedException } from '@nestjs/common';
import { Me } from '../types/me.type';
import { Country } from '../types/country.type';
import { City } from '../types/city.type';
import { FileReference } from '../types/file-reference.type';
import { CountryRepository } from '../../domain/repositories/country.repository';
import { CityRepository } from '../../domain/repositories/city.repository';
import { UsersRepository } from '../../domain/repositories/users.repository';
import { CountryEntity } from '../../domain/entities/country.entity';
import { CityEntity } from '../../domain/entities/city.entity';
import { resolveCityField, resolveCountryField } from './user-location.fields';
import type { DataloaderContext } from './user-location.fields';

@Resolver(() => Me)
export class MeResolver {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly countryRepository: CountryRepository,
    private readonly cityRepository: CityRepository,
  ) {}

  @Query(() => Me, { nullable: true })
  me(@Context() context: { auth: { userId?: string } }) {
    if (!context.auth?.userId) {
      throw new UnauthorizedException();
    }
    return this.usersRepository.findById(context.auth.userId);
  }

  @ResolveField(() => FileReference, { nullable: true })
  avatar(@Parent() me: Me): FileReference | null {
    if (!me.profilePictureFileId) return null;
    return { __typename: 'File', id: me.profilePictureFileId } as FileReference;
  }

  @ResolveField(() => Country, { nullable: true })
  country(
    @Parent() me: Me,
    @Context() context: DataloaderContext,
  ): Promise<CountryEntity | Error | null> {
    return resolveCountryField(me, context, this.countryRepository);
  }

  @ResolveField(() => City, { nullable: true })
  city(
    @Parent() me: Me,
    @Context() context: DataloaderContext,
  ): Promise<CityEntity | Error | null> {
    return resolveCityField(me, context, this.cityRepository);
  }
}
