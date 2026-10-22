import {
  Args,
  Query,
  ResolveReference,
  Resolver,
  Context,
  Int,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { Country } from '../types/country.type';
import { City } from '../types/city.type';
import { User } from '../types/user.type';
import { FileReference } from '../types/file-reference.type';
import { Logger, NotFoundException } from '@nestjs/common';
import { DataloaderFactory } from '@app/common/dataloader/dataloader.factory';
import { CountryRepository } from '../../domain/repositories/country.repository';
import { CityRepository } from '../../domain/repositories/city.repository';
import { CountryEntity } from '../../domain/entities/country.entity';
import { CityEntity } from '../../domain/entities/city.entity';
import { UserEntity } from '../../domain/entities/user.entity';
import { UsersRepository } from '../../domain/repositories/users.repository';
import { resolveCityField, resolveCountryField } from './user-location.fields';

@Resolver(() => User)
export class UsersResolver {
  private readonly logger = new Logger(UsersResolver.name);
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly countryRepository: CountryRepository,
    private readonly cityRepository: CityRepository,
  ) {}

  @Query(() => User, { nullable: true })
  user(@Args('id') id: string) {
    return this.usersRepository.findById(id);
  }

  @Query(() => Int)
  usersCount(): Promise<number> {
    return this.usersRepository.count();
  }

  @ResolveField(() => FileReference, { nullable: true })
  avatar(@Parent() user: User): FileReference | null {
    if (!user.profilePictureFileId) return null;
    return {
      __typename: 'File',
      id: user.profilePictureFileId,
    } as FileReference;
  }

  @ResolveField(() => Country, { nullable: true })
  country(
    @Parent() user: User,
    @Context() context: { dataloaderFactory: DataloaderFactory },
  ): Promise<CountryEntity | Error | null> {
    return resolveCountryField(user, context, this.countryRepository);
  }

  @ResolveField(() => City, { nullable: true })
  city(
    @Parent() user: User,
    @Context() context: { dataloaderFactory: DataloaderFactory },
  ): Promise<CityEntity | Error | null> {
    return resolveCityField(user, context, this.cityRepository);
  }

  @ResolveReference()
  resolveReference(
    reference: { __typename: string; id: string },
    context: { dataloaderFactory: DataloaderFactory },
  ): Promise<UserEntity /* | null*/> {
    if (!reference?.id) {
      throw new NotFoundException('User ID was not provided');
    }

    const loader = context.dataloaderFactory.create<
      string,
      UserEntity /* | null*/
    >('users', async (ids: string[]) => {
      const users = await this.usersRepository.findByIds(ids);
      const userMap = new Map(users.map((u) => [u.id, u]));
      return ids.map((id) => {
        const user = userMap.get(id);
        if (!user) {
          this.logger.warn(`Referenced user not found. userId=${id}`);
          // returned, not thrown: rejects this key only, leaving the rest of
          // the batch resolvable
          return new NotFoundException('User not found');
        }
        return user /* ?? null*/;
      });
    });
    return loader.load(reference.id);
  }
}
