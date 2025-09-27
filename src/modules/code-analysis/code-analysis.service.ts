import { Injectable, Logger } from '@nestjs/common';
import { OpenAIService } from './openai.service';

export interface CodeIssue {
  type: 'bug' | 'security' | 'performance' | 'style' | 'best-practice';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  line?: string;
  suggestion: string;
}

export interface CodeAnalysisResult {
  summary: string;
  issues: CodeIssue[];
  positives: string[];
}

@Injectable()
export class CodeAnalysisService {
  private readonly logger = new Logger(CodeAnalysisService.name);

  constructor(private readonly openaiService: OpenAIService) {}

  async analyzeCode(diff: string): Promise<CodeAnalysisResult> {
    this.logger.log('Starting code analysis');

    try {
      // Basic validation
      if (!diff || diff.trim().length === 0) {
        return {
          summary: 'No code changes detected',
          issues: [],
          positives: [],
        };
      }

      // Use OpenAI to analyze the code
      const analysis = await this.openaiService.analyzeCodeDiff(diff);

      // Apply additional heuristic checks
      const heuristicIssues = this.performHeuristicAnalysis(diff);

      // Combine results
      const combinedIssues = [...(analysis.issues || []), ...heuristicIssues];

      return {
        summary: analysis.summary || 'Code analysis completed',
        issues: combinedIssues,
        positives: analysis.positives || [],
      };
    } catch (error) {
      this.logger.error(`Code analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Fallback to heuristic analysis only
      const heuristicIssues = this.performHeuristicAnalysis(diff);

      return {
        summary: 'Analysis completed with basic checks only (AI analysis unavailable)',
        issues: heuristicIssues,
        positives: [],
      };
    }
  }

  private performHeuristicAnalysis(diff: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = diff.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip non-addition lines
      if (!line.startsWith('+')) continue;

      const content = line.substring(1).trim();

      // Check for potential security issues
      if (this.containsSecurityRisk(content)) {
        issues.push({
          type: 'security',
          severity: 'high',
          message: 'Potential security risk detected',
          line: (i + 1).toString(),
          suggestion: 'Review for security implications and add proper validation',
        });
      }

      // Check for TODO/FIXME comments
      if (content.includes('TODO') || content.includes('FIXME')) {
        issues.push({
          type: 'best-practice',
          severity: 'low',
          message: 'TODO/FIXME comment found',
          line: (i + 1).toString(),
          suggestion: 'Consider creating a proper issue tracker item',
        });
      }

      // Check for console.log statements
      if (content.includes('console.log')) {
        issues.push({
          type: 'best-practice',
          severity: 'low',
          message: 'Console.log statement found',
          line: (i + 1).toString(),
          suggestion: 'Use proper logging framework instead of console.log',
        });
      }

      // Check for missing error handling
      if (content.includes('await ') && !this.hasErrorHandling(lines, i)) {
        issues.push({
          type: 'bug',
          severity: 'medium',
          message: 'Async operation without error handling',
          line: (i + 1).toString(),
          suggestion: 'Add try-catch block or proper error handling',
        });
      }
    }

    return issues;
  }

  private containsSecurityRisk(content: string): boolean {
    const securityPatterns = [
      /eval\s*\(/,
      /innerHTML\s*=/,
      /document\.write\s*\(/,
      /\.exec\s*\(/,
      /process\.env\./,
      /localStorage\./,
      /sessionStorage\./,
    ];

    return securityPatterns.some(pattern => pattern.test(content));
  }

  private hasErrorHandling(lines: string[], currentIndex: number): boolean {
    // Look for try-catch blocks around the current line
    const searchRange = 10; // Look 10 lines before and after
    const start = Math.max(0, currentIndex - searchRange);
    const end = Math.min(lines.length, currentIndex + searchRange);

    for (let i = start; i < end; i++) {
      const line = lines[i].trim();
      if (line.includes('try {') || line.includes('catch')) {
        return true;
      }
    }

    return false;
  }
}