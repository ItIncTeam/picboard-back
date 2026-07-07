import {
  ArgumentsHost,
  Catch,
  InternalServerErrorException,
} from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { mapPrismaErrorCode } from '@app/common';
import { Prisma } from '../../../../../../prisma/apps/files/src/generated/prisma/files-client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class FilesPrismaExceptionFilter implements GqlExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, _host: ArgumentsHost) {
    const mapped = mapPrismaErrorCode(exception.code);

    if (mapped) {
      mapped.message = `${mapped.message} (${exception.code})`; //adds context to error
      throw mapped;
    }

    /*return exception;*/ //leaks db details to client
    throw new InternalServerErrorException('Database error occurred');
  }
}
