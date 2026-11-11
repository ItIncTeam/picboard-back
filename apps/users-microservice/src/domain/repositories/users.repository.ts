import { UserEntity } from '../entities/user.entity';
import { CreateUserData } from './create-user-data.type';
import { UpdateConfirmationData } from './update-confirmation-data.type';
import { UpdateProfileData } from './update-profile-data.type';

export abstract class UsersRepository {
  abstract findById(id: string): Promise<UserEntity | null>;

  abstract findByIds(ids: string[]): Promise<UserEntity[]>;

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

  // Sets the new avatar and, in the same transaction, queues the previous one
  // for deletion (skipped when there is none or it's the same file)
  abstract setProfilePictureAndEnqueueOldFileDeletion(
    userId: string,
    fileId: string,
  ): Promise<UserEntity>;

  abstract count(): Promise<number>;

  abstract updateProfile(
    userId: string,
    data: UpdateProfileData,
  ): Promise<UserEntity>;
}
