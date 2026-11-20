// What the outbox worker needs from a files-service client. Reject with the
// error as received (raw RPC payload or HttpException) so the worker can tell
// a permanent 4xx from a failure worth retrying.
export abstract class FileDeletionSender {
  abstract markFilesDeleted(input: {
    ownerId: string;
    fileIds: string[];
  }): Promise<void>;
}
