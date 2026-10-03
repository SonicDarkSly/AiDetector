import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { Request } from 'express';
import { deviceTagOf } from '../../shared/http/client-info.js';
import { AnalyzeFileCommand } from '../application/commands/analyze-file.command.js';
import { AnalyzeTextCommand } from '../application/commands/analyze-text.command.js';
import { ClearHistoryCommand } from '../application/commands/clear-history.command.js';
import { DeleteAnalysisCommand } from '../application/commands/delete-analysis.command.js';
import { GetAnalysisQuery } from '../application/queries/get-analysis.query.js';
import { GetHistoryQuery } from '../application/queries/get-history.query.js';
import {
  GetLanguageModelQuery,
  GetModelActivityQuery,
} from '../application/queries/get-language-model.query.js';
import type { LanguageModelInfo, ModelActivity } from '../domain/likelihood/likelihood-scorer.js';
import type { AnalysisSnapshot, AnalysisSummary } from '../domain/analysis.js';
import { UnreadableDocumentError } from '../domain/document/document-reader.js';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_CHARS = 400_000;

@Controller('api')
export class AnalysisController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get('model')
  model(): Promise<LanguageModelInfo> {
    return this.queries.execute(new GetLanguageModelQuery());
  }

  @Get('model/activity')
  async modelActivity(): Promise<{ activity: ModelActivity | null }> {
    return { activity: await this.queries.execute(new GetModelActivityQuery()) };
  }

  @Post('analyze/text')
  analyzeText(@Req() req: Request, @Body() body: { text?: unknown }): Promise<AnalysisSnapshot> {
    const text = typeof body?.text === 'string' ? body.text : '';
    if (!text.trim()) throw new BadRequestException({ error: 'texte vide' });
    if (text.length > MAX_TEXT_CHARS) {
      throw new BadRequestException({ error: `texte trop long (max ${MAX_TEXT_CHARS} caractères)` });
    }
    return this.commands.execute(new AnalyzeTextCommand(text, deviceTagOf(req)));
  }

  @Post('analyze/file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  async analyzeFile(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<AnalysisSnapshot> {
    if (!file) throw new BadRequestException({ error: 'aucun fichier reçu (champ « file »)' });
    // multer décode le nom de fichier en latin1
    const filename = Buffer.from(file.originalname, 'latin1').toString('utf8');
    try {
      return await this.commands.execute(
        new AnalyzeFileCommand({ buffer: file.buffer, filename, mimetype: file.mimetype }, deviceTagOf(req)),
      );
    } catch (err) {
      if (err instanceof UnreadableDocumentError) throw new BadRequestException({ error: err.message });
      throw err;
    }
  }

  @Get('reports')
  history(): Promise<AnalysisSummary[]> {
    return this.queries.execute(new GetHistoryQuery());
  }

  @Get('reports/:id')
  async analysis(@Param('id') id: string): Promise<AnalysisSnapshot> {
    const snapshot = await this.queries.execute<GetAnalysisQuery, AnalysisSnapshot | null>(
      new GetAnalysisQuery(id),
    );
    if (!snapshot) throw new NotFoundException({ error: 'analyse introuvable' });
    return snapshot;
  }

  @Delete('reports/:id')
  async remove(@Param('id') id: string) {
    await this.commands.execute(new DeleteAnalysisCommand(id));
    return { ok: true };
  }

  @Delete('reports')
  async clear() {
    await this.commands.execute(new ClearHistoryCommand());
    return { ok: true };
  }
}
