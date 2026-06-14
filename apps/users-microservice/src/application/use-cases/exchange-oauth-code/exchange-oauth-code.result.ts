import { UserEntity } from '../../../domain/entities/user.entity';

export class ExchangeOAuthCodeResult {
  accessToken: string;
  refreshToken: string;
  user: UserEntity;
}
