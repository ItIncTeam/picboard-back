import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { CommandBus } from '@nestjs/cqrs';
import { UpdateProfileCommand } from '../../application/use-cases/update-profile/update-profile.use.case';
import { Me } from '../types/me.type';
import { CurrentUserId } from '@app/common/decorators/auth/current-userId';
import { UpdateProfileInput } from '../inputs/update-profile.input';

@Resolver(() => Me)
export class ProfileResolver {
  constructor(private readonly commandBus: CommandBus) {}

  @Mutation(() => Me)
  updateProfile(
    @CurrentUserId() ownerId: string,
    @Args('input') input: UpdateProfileInput,
  ) {
    return this.commandBus.execute(new UpdateProfileCommand(ownerId, input));
  }
}
