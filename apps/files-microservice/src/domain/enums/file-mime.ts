import { registerEnumType } from '@nestjs/graphql';

export enum Mime {
  JPEG = 'JPEG',
  PNG = 'PNG',
}

registerEnumType(Mime, {
  name: 'MimeType',
});
