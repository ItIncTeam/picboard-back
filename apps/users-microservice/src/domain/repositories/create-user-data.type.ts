export type CreateUserData = {
  email: string;
  username: string;
  passwordHash: string | null;
  confirmationCode: string | null;
  confirmationCodeExpDate: Date | null;
  isConfirmed: boolean;
};
