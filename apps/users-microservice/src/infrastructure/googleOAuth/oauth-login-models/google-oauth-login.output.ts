/*export type GoogleOAuthLoginOutput = {
  userId: string;
  provider: string;
  canSignUpViaOAuth: boolean;
}*/
export type GoogleOAuthLoginOutput =
  | {
      userId: string;
      provider: 'google';
      status: 'signed_in_existing_oauth';
    }
  | {
      userId: string;
      provider: 'google';
      status: 'created_oauth_and_linked_to_existing_user';
    }
  | {
      userId: string;
      provider: 'google';
      status: 'created_and_linked_user_and_oauth';
    };
