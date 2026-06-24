import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SignInUserCommand, SignInUserUseCase } from './sign-in-user.use.case';
import { IssueSessionCommand } from '../issue-session/issue-session.use.case';
import { UsersRepository } from '../../../domain/repositories/users.repository';
import { PasswordHasher } from '../../../domain/services/password-hasher';
import { TokenService } from '../../../domain/services/token.service';
import { UserEntity } from '../../../domain/entities/user.entity';

function createUser(
  overrides: Partial<UserEntity> & { _explicitPasswordHash?: true } = {},
): UserEntity {
  const hasPasswordHash = '_explicitPasswordHash' in overrides;
  return new UserEntity(
    overrides.id ?? 'user-1',
    overrides.email ?? 'test@example.com',
    overrides.username ?? 'testuser',
    hasPasswordHash ? overrides.passwordHash! : '$2b$10$hashedpassword',
    overrides.createdAt ?? new Date('2026-01-01'),
    overrides.confirmationCode ?? 'conf-code-123',
    overrides.confirmationCodeExpDate ?? new Date('2026-06-01'),
    overrides.isConfirmed ?? true,
  );
}

describe('SignInUserUseCase', () => {
  let useCase: SignInUserUseCase;
  let usersRepository: jest.Mocked<UsersRepository>;
  let passwordHasher: jest.Mocked<PasswordHasher>;
  let tokenService: jest.Mocked<TokenService>;
  let commandBus: jest.Mocked<CommandBus>;

  beforeEach(async () => {
    usersRepository = {
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    passwordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    } as jest.Mocked<PasswordHasher>;

    tokenService = {
      signAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    } as jest.Mocked<TokenService>;

    commandBus = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CommandBus>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignInUserUseCase,
        { provide: UsersRepository, useValue: usersRepository },
        { provide: PasswordHasher, useValue: passwordHasher },
        { provide: TokenService, useValue: tokenService },
        { provide: CommandBus, useValue: commandBus },
      ],
    }).compile();

    useCase = module.get(SignInUserUseCase);
  });

  describe('successful sign-in', () => {
    it('should return user, accessToken and refreshToken', async () => {
      const user = createUser();
      usersRepository.findByEmail.mockResolvedValue(user);
      passwordHasher.compare.mockResolvedValue(true);
      tokenService.signAccessToken.mockResolvedValue('access-token-abc');
      commandBus.execute.mockResolvedValue({
        accessToken: 'access-token-abc',
        refreshToken: 'refresh-token-xyz',
      });

      const command = new SignInUserCommand({
        email: 'test@example.com',
        password: 'correct-password',
      });

      const result = await useCase.execute(command);

      expect(result.user).toEqual(user);
      expect(result.accessToken).toBe('access-token-abc');
      expect(result.refreshToken).toBe('refresh-token-xyz');

      expect(usersRepository.findByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(passwordHasher.compare).toHaveBeenCalledWith(
        'correct-password',
        user.passwordHash,
      );
      expect(commandBus.execute).toHaveBeenCalledWith(
        new IssueSessionCommand(user.id, user.email),
      );
    });
  });

  describe('user not found', () => {
    it('should throw UnauthorizedException', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);

      const command = new SignInUserCommand({
        email: 'nobody@example.com',
        password: 'whatever',
      });

      await expect(useCase.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(useCase.execute(command)).rejects.toThrow(
        'Invalid credentials',
      );

      expect(passwordHasher.compare).not.toHaveBeenCalled();
      expect(tokenService.signAccessToken).not.toHaveBeenCalled();
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('wrong password', () => {
    it('should throw UnauthorizedException', async () => {
      const user = createUser();
      usersRepository.findByEmail.mockResolvedValue(user);
      passwordHasher.compare.mockResolvedValue(false);

      const command = new SignInUserCommand({
        email: 'test@example.com',
        password: 'wrong-password',
      });

      await expect(useCase.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(useCase.execute(command)).rejects.toThrow(
        'Invalid credentials',
      );

      expect(passwordHasher.compare).toHaveBeenCalledWith(
        'wrong-password',
        user.passwordHash,
      );
      expect(tokenService.signAccessToken).not.toHaveBeenCalled();
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('email not confirmed', () => {
    it('should throw UnauthorizedException when isConfirmed is false', async () => {
      const user = createUser({ isConfirmed: false });
      usersRepository.findByEmail.mockResolvedValue(user);

      const command = new SignInUserCommand({
        email: 'test@example.com',
        password: 'correct-password',
      });

      await expect(useCase.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(useCase.execute(command)).rejects.toThrow(
        'Email is not confirmed',
      );

      expect(passwordHasher.compare).not.toHaveBeenCalled();
      expect(tokenService.signAccessToken).not.toHaveBeenCalled();
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('OAuth account (no passwordHash)', () => {
    it('should throw UnauthorizedException when passwordHash is null', async () => {
      const user = createUser({
        passwordHash: null,
        _explicitPasswordHash: true,
      });
      usersRepository.findByEmail.mockResolvedValue(user);

      const command = new SignInUserCommand({
        email: 'test@example.com',
        password: 'correct-password',
      });

      await expect(useCase.execute(command)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(useCase.execute(command)).rejects.toThrow(
        'Account uses OAuth. Please sign in with a provider.',
      );

      expect(passwordHasher.compare).not.toHaveBeenCalled();
      expect(tokenService.signAccessToken).not.toHaveBeenCalled();
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });
});
