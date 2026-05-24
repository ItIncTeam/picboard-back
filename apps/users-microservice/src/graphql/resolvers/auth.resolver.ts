import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { SignUpInput } from '../inputs/sign-up.input';
import { SignUpUserCommand } from '../../application/use-cases/sign-up-user/sign-up-user.use.case';
import { CommandBus } from '@nestjs/cqrs';
import { SignUpPayload } from '../types/sign-up.payload';

@Resolver()
export class AuthResolver {
  constructor(private readonly commandBus: CommandBus) {}

  @Mutation(() => SignUpPayload)
  async signUp(@Args('input') input: SignUpInput): Promise<SignUpPayload> {
    const user = await this.commandBus.execute(new SignUpUserCommand(input));
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        isConfirmed: user.isConfirmed,
      },
      message: 'Confirmation email sent',
    };
  }
}
