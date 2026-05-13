import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import type { FileUploadCompletedEvent } from '@app/contracts/file.events';

@Controller()
export class PostsEventsController {
  private readonly logger = new Logger(PostsEventsController.name);

  @EventPattern('file.upload.completed')
  handleFileUploaded(@Payload() event: FileUploadCompletedEvent) {
    this.logger.log(`File upload completed: ${JSON.stringify(event)}`);
  }
}
