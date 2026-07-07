import {
  Args,
  Query,
  ResolveReference,
  Resolver,
  Context,
} from '@nestjs/graphql';
import { User } from '../graphql/types/user.type';
import {
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DataloaderFactory } from '@app/common/dataloader/dataloader.factory';
import { UserEntity } from '../domain/entities/user.entity';
import { UsersRepository } from '../domain/repositories/users.repository';

@Resolver(() => User)
export class UsersResolver {
  private readonly logger = new Logger(UsersResolver.name);
  constructor(private readonly usersRepository: UsersRepository) {}

  @Query(() => User, { nullable: true })
  user(@Args('id') id: string) {
    return this.usersRepository.findById(id);
  }

  @Query(() => User, { nullable: true })
  async me(@Context() context: { auth: { userId?: string } }) {
    if (!context.auth?.userId) {
      throw new UnauthorizedException();
    }
    return this.usersRepository.findById(context.auth.userId);
  }

  @ResolveReference()
  async resolveReference(
    reference: { __typename: string; id: string },
    @Context() context: { dataloaderFactory: DataloaderFactory },
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
          throw new NotFoundException('User not found');
        }
        return user /* ?? null*/;
      });
    });
    return loader.load(reference.id);
  }
}
