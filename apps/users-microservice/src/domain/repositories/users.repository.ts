import { UserEntity } from '../entities/user.entity';
import { CreateUserData } from './create-user-data.type';
import { UpdateConfirmationData } from './update-confirmation-data.type';

export abstract class UsersRepository {
  abstract findById(id: string): Promise<UserEntity | null>;

  abstract findByUsername(username: string): Promise<UserEntity | null>;

  abstract findByEmail(email: string): Promise<UserEntity | null>;

  abstract create(data: CreateUserData): Promise<UserEntity>;

  abstract findByConfirmationCode(code: string): Promise<UserEntity | null>;

  abstract confirmUserEmail(id: string): Promise<UserEntity>;

  abstract updateConfirmationData(
    userId: string,
    data: UpdateConfirmationData,
  ): Promise<UserEntity>;

  abstract updatePasswordHash(
    userId: string,
    passwordHash: string,
  ): Promise<UserEntity>;
}
