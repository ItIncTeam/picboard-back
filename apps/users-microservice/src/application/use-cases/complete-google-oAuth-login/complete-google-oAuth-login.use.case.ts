import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { GoogleOAuthLoginOutput } from '../../../infrastructure/googleOAuth/oauth-login-models/google-oauth-login.output';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { UserEntity } from '../../../domain/entities/user.entity';
import { OAuthAccountsRepository } from '../../../domain/repositories/oauth-account/oauth-accounts.repository';
import { UsernameGeneratorService } from '../../../infrastructure/googleOAuth/username-generator.service';
import { OAuthAccountEntity } from '../../../domain/entities/oauth-account.entity';
import { GoogleOAuthLoginInput } from '../../../infrastructure/googleOAuth/oauth-login-models/google-oauth-login.input';

export class CompleteGoogleOAuthLoginCommand {
  constructor(public readonly input: GoogleOAuthLoginInput) {}
}

@CommandHandler(CompleteGoogleOAuthLoginCommand)
@Injectable()
export class CompleteGoogleOAuthLoginUseCase implements ICommandHandler<CompleteGoogleOAuthLoginCommand> {
  constructor(
    public readonly oAuthAccountsRepository: OAuthAccountsRepository,
    public readonly usersRepository: UsersRepository,
    public readonly usernameGeneratorService: UsernameGeneratorService,
  ) {}

  async execute(
    command: CompleteGoogleOAuthLoginCommand,
  ): Promise<GoogleOAuthLoginOutput> {
    const { provider, providerId, email, name /*, givenName, familyName*/ } =
      command.input;

    const existingOAuthAccount: OAuthAccountEntity | null =
      await this.oAuthAccountsRepository.findByProviderAndProviderId(
        provider,
        providerId,
      );

    if (existingOAuthAccount) {
      return {
        userId: existingOAuthAccount.userId,
        provider,
        status: 'signed_in_existing_oauth',
      };
    } //todo redirect to sign in

    const existingUser: UserEntity | null =
      await this.usersRepository.findByEmail(email);

    if (existingUser) {
      await this.oAuthAccountsRepository.create({
        userId: existingUser.id,
        provider: provider,
        providerId: providerId,
        email: email,
        ...(existingUser.username ? { username: existingUser.username } : {}),
      });
      //todo: ADD AVATAR OR SMTH ELSE TO USER SCHEMA IF WE HAVE THEM IN SCOPE (LINK SCHEMAS)

      return {
        userId: existingUser.id,
        provider: provider,
        status: 'created_oauth_and_linked_to_existing_user',
      };
    }

    //todo: check the service: should we incorporate given name and family name?
    const username: string = await this.usernameGeneratorService.generate({
      email: email,
      ...(name ? { name: name } : {}),
    });

    const user: UserEntity = await this.usersRepository.create({
      email: email,
      username: username,
      isConfirmed: true,
      confirmationCode: null,
      confirmationCodeExpDate: null,
      passwordHash: null,
    });

    await this.oAuthAccountsRepository.create({
      userId: user.id,
      provider: provider,
      providerId: providerId,
      email: email,
      username: name ? name : user.username,
    });

    return {
      userId: user.id,
      provider: 'google',
      status: 'created_and_linked_user_and_oauth',
    };
  }
}
