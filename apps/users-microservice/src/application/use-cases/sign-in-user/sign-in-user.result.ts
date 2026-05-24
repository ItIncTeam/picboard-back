import { UserEntity } from '../../../domain/entities/user.entity';

export class SignInUserResult {
  user: UserEntity;
  accessToken: string;
}
