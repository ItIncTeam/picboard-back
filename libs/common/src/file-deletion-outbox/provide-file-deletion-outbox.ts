import { Provider, Type } from '@nestjs/common';
import { FileDeletionOutboxRepository } from './file-deletion-outbox.repository';
import { FileDeletionSender } from './file-deletion-sender';
import {
  FILE_DELETION_OUTBOX_PRISMA,
  FileDeletionOutboxPrismaClient,
  PrismaFileDeletionOutboxRepository,
} from './prisma-file-deletion-outbox.repository';
import { FileDeletionOutboxWorker } from './file-deletion-outbox.worker';

// Wires the outbox into a service: spread the result into the host module's
// `providers`. The service's own Prisma client and files client must already
// be available in that module; they are reused, not created again.
// Not a DynamicModule on purpose: a module has its own scope and couldn't see
// a client the host module provides without exporting it.
export function provideFileDeletionOutbox(options: {
  prisma: Type<FileDeletionOutboxPrismaClient>;
  filesClient: Type<FileDeletionSender>;
}): Provider[] {
  return [
    { provide: FILE_DELETION_OUTBOX_PRISMA, useExisting: options.prisma },
    { provide: FileDeletionSender, useExisting: options.filesClient },
    {
      provide: FileDeletionOutboxRepository,
      useClass: PrismaFileDeletionOutboxRepository,
    },
    FileDeletionOutboxWorker,
  ];
}
