import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { QueryFilesDto } from './dto/query-files.dto';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PERMISSIONS } from '../permissions/permissions.catalog';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { MAX_UPLOAD_SIZE_BYTES } from './files.constants';

/**
 * Files. Upload server-side: FE manda multipart con el binario; el backend
 * proxea al storage activo (MinIO en producción, Vercel Blob en el deploy dev)
 * con credenciales que nunca se exponen al FE. La descarga también la proxea el
 * backend, así MinIO no necesita estar publicado a internet.
 *
 * Atención: Vercel Serverless limita el cuerpo HTTP a ~4.5 MB por request. En
 * el servidor con Docker no aplica: manda `MAX_UPLOAD_SIZE_BYTES` (y el
 * `client_max_body_size` de nginx).
 */
@Controller('files')
export class FilesController {
  constructor(private readonly service: FilesService) {}

  @RequirePermissions(PERMISSIONS.FILES.CREATE)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_SIZE_BYTES, files: 1 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upload(file, dto, user);
  }

  @RequirePermissions(PERMISSIONS.FILES.LIST)
  @Get()
  list(@Query() q: QueryFilesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(q, user);
  }

  @RequirePermissions(PERMISSIONS.FILES.LIST)
  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @RequirePermissions(PERMISSIONS.FILES.LIST)
  @Get(':id/download')
  async download(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { stream, file, contentLength } = await this.service.download(id, user);
    res.setHeader('Content-Type', file.mimeType);
    if (contentLength !== null) {
      res.setHeader('Content-Length', String(contentLength));
    }
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.name)}"`,
    );
    stream.pipe(res);
  }

  @RequirePermissions(PERMISSIONS.FILES.SOFT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(id, user);
  }
}
