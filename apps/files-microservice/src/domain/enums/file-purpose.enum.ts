import { registerEnumType } from '@nestjs/graphql';

export enum Purpose {
  POST_IMAGE = 'POST_IMAGE',
  BILL = 'BILL',
}

registerEnumType(Purpose, {
  name: 'Purpose',
});
