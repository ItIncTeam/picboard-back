export const ConsentAction = {
  ACCEPTED: 'ACCEPTED',
  WITHDRAWN: 'WITHDRAWN',
} as const;

export type ConsentAction = (typeof ConsentAction)[keyof typeof ConsentAction];
