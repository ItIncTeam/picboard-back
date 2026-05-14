import {
  Args,
  Mutation,
  Query,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import { FileAsset } from './entities/file-asset.entity';
import { FilesService } from './files.service';
import { CreateUploadSessionInput } from './dto/create-upload-session.input';

@Resolver(() => FileAsset)
export class FilesResolver {
  constructor(private readonly filesService: FilesService) {}

  @Query(() => FileAsset, { nullable: true })
  file(@Args('id') id: string) {
    return this.filesService.findById(id);
  }

  @Mutation(() => FileAsset)
  createUploadSession(@Args('input') input: CreateUploadSessionInput) {
    return this.filesService.createUploadSession(input);
  }

  @Mutation(() => FileAsset)
  confirmUpload(@Args('id') id: string, @Args('url') url: string) {
    return this.filesService.confirmUpload(id, url);
  }

  @ResolveReference()
  resolveReference(reference: { __typename: string; id: string }) {
    return this.filesService.findById(reference.id);
  }
}
