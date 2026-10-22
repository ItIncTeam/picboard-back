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
    public readonly displayName?: string | null,
    public readonly bio?: string | null,
    public readonly profilePictureFileId?: string | null,
    public readonly firstName?: string | null,
    public readonly lastName?: string | null,
    public readonly dateOfBirth?: Date | null,
    public readonly countryId?: string | null,
    public readonly cityId?: string | null,
  ) {}
}
