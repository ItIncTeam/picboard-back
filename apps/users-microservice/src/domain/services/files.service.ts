export abstract class FilesService {
  // true if the file is the owner's, READY, and uploaded as an AVATAR
  abstract isOwnedReadyAvatar(
    fileId: string,
    ownerId: string,
  ): Promise<boolean>;
}
