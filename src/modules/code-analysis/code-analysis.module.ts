import { Module } from '@nestjs/common';
import { CodeAnalysisService } from './code-analysis.service';
import { OpenAIService } from './openai.service';

@Module({
  providers: [CodeAnalysisService, OpenAIService],
  exports: [CodeAnalysisService],
})
export class CodeAnalysisModule {}