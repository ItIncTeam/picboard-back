export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly username: string,
    public readonly passwordHash: string | null,
    public readonly createdAt: Date,
    public readonly confirmationCode: string | null,
    public readonly confirmationCodeExpDate: Date | null,
    public readonly isConfirmed: boolean,
  ) {}
}
