import { Injectable, Logger } from '@nestjs/common';
import { OpenAI } from 'openai';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'test_key') {
      this.logger.warn('No valid OpenAI API key provided. Using mock responses.');
    }

    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy-key',
    });
  }

  async analyzeCodeDiff(diff: string): Promise<any> {
    // Return mock response if using test key
    if (process.env.OPENAI_API_KEY === 'test_key') {
      return this.getMockResponse();
    }

    const prompt = this.buildAnalysisPrompt(diff);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert code reviewer. Analyze the provided code diff and provide constructive feedback focusing on potential bugs, security issues, performance problems, and code quality improvements.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      });

      return this.parseResponse(response.choices[0].message.content || '');
    } catch (error) {
      this.logger.error(`OpenAI API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error('Failed to analyze code with OpenAI');
    }
  }

  private getMockResponse(): any {
    return {
      summary: 'Mock code review analysis - no actual AI analysis performed.',
      issues: [
        {
          type: 'best-practice',
          severity: 'low',
          message: 'This is a mock issue for testing purposes',
          line: '1',
          suggestion: 'This is a mock suggestion for testing',
        },
      ],
      positives: ['Code is properly formatted'],
    };
  }

  private buildAnalysisPrompt(diff: string): string {
    return `
Please analyze this code diff and provide feedback in the following JSON format:

{
  "summary": "Overall assessment of the changes",
  "issues": [
    {
      "type": "bug|security|performance|style|best-practice",
      "severity": "low|medium|high|critical",
      "message": "Description of the issue",
      "line": "line number if applicable",
      "suggestion": "Suggested improvement"
    }
  ],
  "positives": ["Things done well in this change"]
}

Code diff:
\`\`\`
${diff}
\`\`\`

Focus on:
1. Potential bugs or logical errors
2. Security vulnerabilities
3. Performance issues
4. Code style and best practices
5. Missing error handling
6. Type safety issues
`;
  }

  private parseResponse(content: string): any {
    try {
      // Extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback if no JSON found
      return {
        summary: content,
        issues: [],
        positives: [],
      };
    } catch (error) {
      this.logger.warn('Failed to parse OpenAI response as JSON');
      return {
        summary: content,
        issues: [],
        positives: [],
      };
    }
  }
}