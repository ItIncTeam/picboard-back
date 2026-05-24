import { UserEntity } from '../entities/user.entity';
import { CreateUserData } from './create-user-data.type';

export abstract class UsersRepository {
  abstract findByUsername(username: string): Promise<UserEntity | null>;

  abstract findByEmail(email: string): Promise<UserEntity | null>;

  abstract create(data: CreateUserData): Promise<UserEntity>;
}
