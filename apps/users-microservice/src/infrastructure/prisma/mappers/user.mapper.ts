import { UserEntity } from '../../../domain/entities/user.entity';
import { User } from '../../../../../../prisma/apps/users/src/generated/prisma/users-client';

export function mapToUserEntity(user: User): UserEntity {
  return new UserEntity(
    user.id,
    user.email,
    user.username,
    user.passwordHash,
    user.createdAt,
    user.confirmationCode,
    user.confirmationCodeExpDate,
    user.isConfirmed,
    user.displayName,
    user.bio,
    user.profilePictureFileId,
    user.firstName,
    user.lastName,
    user.dateOfBirth,
    user.countryId,
    user.cityId,
  );
}

export function mapToUserEntityOrNull(user: User | null): UserEntity | null {
  return user ? mapToUserEntity(user) : null;
}

export function mapToUserEntities(users: User[]): UserEntity[] {
  return users.map(mapToUserEntity);
}
