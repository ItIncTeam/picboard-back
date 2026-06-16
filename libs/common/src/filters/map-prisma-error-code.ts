import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

export function mapPrismaErrorCode(code: string) {
  switch (code) {
    case 'P2002':
      return new ConflictException('Resource already exists');

    case 'P2025':
      return new NotFoundException('Resource not found');

    case 'P2003':
      return new BadRequestException('Invalid related resource reference');

    default:
      return null;
  }
}

/*@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements GqlExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, _host: ArgumentsHost) {
    switch (exception.code) {
      case 'P2002':
        throw new ConflictException('Resource already exists');

      case 'P2025':
        throw new NotFoundException('Resource not found');

      case 'P2003':
        throw new BadRequestException('Invalid related resource reference');

      default:
        throw exception;
    }
  }
}*/
