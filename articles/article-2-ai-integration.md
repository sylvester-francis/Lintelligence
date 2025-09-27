# AI-Powered Code Review: Integrating LLMs with GitHub Webhooks

## Introduction

In our previous article, we built the event-driven foundation for an intelligent code review agent using NestJS and TypeScript. Now we'll add the "intelligence" by integrating OpenAI's GPT-4 to perform sophisticated code analysis and generate actionable feedback.

This article demonstrates:
- Effective prompt engineering for code review tasks
- Handling AI service failures gracefully
- Combining AI analysis with heuristic checks
- Posting structured feedback to GitHub pull requests

## The AI Analysis Pipeline

Our AI-powered analysis follows this flow:

```
Code Diff → Prompt Engineering → OpenAI API → Response Parsing → GitHub Feedback
```

Each step is designed for reliability, with fallbacks and error handling to ensure the system remains functional even when AI services are unavailable.

## OpenAI Service Implementation

### Core Service Structure

Let's build a robust OpenAI integration that handles errors gracefully:

```typescript
// src/modules/code-analysis/openai.service.ts
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
}
```

### Prompt Engineering for Code Review

The quality of AI analysis depends heavily on well-crafted prompts. Here's our structured approach:

```typescript
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
```

### Response Parsing and Validation

AI responses need careful parsing and validation:

```typescript
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
```

## Code Analysis Service

### Combining AI with Heuristic Analysis

We combine AI analysis with traditional heuristic checks for comprehensive coverage:

```typescript
// src/modules/code-analysis/code-analysis.service.ts
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
}
```

### Heuristic Analysis Implementation

Implement pattern-based analysis for common issues:

```typescript
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
```

## GitHub Integration

### GitHub Service for API Interaction

Create a service to handle GitHub API operations:

```typescript
// src/modules/github/github.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { CodeIssue } from '../code-analysis/code-analysis.service';

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);
  private readonly octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  async getPullRequestDiff(owner: string, repo: string, pullNumber: number): Promise<string> {
    try {
      const response = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
        mediaType: {
          format: 'diff',
        },
      });

      return response.data as unknown as string;
    } catch (error) {
      this.logger.error(`Failed to get PR diff: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error('Failed to fetch pull request diff');
    }
  }
}
```

### Posting Review Comments

Implement intelligent comment posting that respects GitHub's API structure:

```typescript
async postReviewComments(
  owner: string,
  repo: string,
  pullNumber: number,
  commitSha: string,
  issues: CodeIssue[],
): Promise<void> {
  try {
    // Get the files changed in the PR
    const files = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
    });

    // Create review comments for each issue
    const comments = [];

    for (const issue of issues) {
      if (issue.line && issue.type !== 'style') {
        // Find the appropriate file for this line
        const file = files.data.find(f =>
          f.patch && this.isLineInFile(f.patch, parseInt(issue.line || '0'))
        );

        if (file) {
          comments.push({
            path: file.filename,
            line: parseInt(issue.line),
            body: this.formatReviewComment(issue),
          });
        }
      }
    }

    if (comments.length > 0) {
      await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitSha,
        event: 'REQUEST_CHANGES',
        comments,
      });

      this.logger.log(`Posted ${comments.length} review comments`);
    }
  } catch (error) {
    this.logger.error(`Failed to post review comments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw new Error('Failed to post review comments');
  }
}

async postReviewSummary(
  owner: string,
  repo: string,
  pullNumber: number,
  commitSha: string,
  summary: string,
): Promise<void> {
  try {
    const body = `## AI Code Review Summary

${summary}

---
*This review was generated automatically by the AI Code Review Agent*`;

    await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      commit_id: commitSha,
      event: 'COMMENT',
      body,
    });

    this.logger.log('Posted review summary');
  } catch (error) {
    this.logger.error(`Failed to post review summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw new Error('Failed to post review summary');
  }
}

private formatReviewComment(issue: CodeIssue): string {
  return `**${issue.type.toUpperCase()}** (${issue.severity})

${issue.message}

**Suggestion:** ${issue.suggestion}`;
}
```

## Database Integration

### Storing Review History

Track reviews for analytics and improvement:

```typescript
// src/entities/review.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ReviewComment } from './review-comment.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  owner!: string;

  @Column()
  repo!: string;

  @Column()
  pullNumber!: number;

  @Column()
  commitSha!: string;

  @Column('text')
  summary!: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'in_progress', 'completed', 'failed'],
    default: 'pending',
  })
  status!: string;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @OneToMany(() => ReviewComment, (comment) => comment.review)
  comments!: ReviewComment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

### Database Service Implementation

```typescript
// src/modules/database/database.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewComment } from '../../entities';
import { CodeIssue } from '../code-analysis/code-analysis.service';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(ReviewComment)
    private commentRepository: Repository<ReviewComment>,
  ) {}

  async createReview(data: {
    owner: string;
    repo: string;
    pullNumber: number;
    commitSha: string;
    summary: string;
  }): Promise<Review> {
    const review = this.reviewRepository.create(data);
    return await this.reviewRepository.save(review);
  }

  async updateReviewStatus(id: string, status: string): Promise<void> {
    await this.reviewRepository.update(id, { status });
  }

  async addReviewComments(reviewId: string, issues: CodeIssue[]): Promise<void> {
    const comments = issues.map(issue =>
      this.commentRepository.create({
        reviewId,
        filePath: 'unknown', // This would need to be parsed from the diff
        lineNumber: issue.line ? parseInt(issue.line) : undefined,
        issueType: issue.type,
        severity: issue.severity,
        message: issue.message,
        suggestion: issue.suggestion,
      })
    );

    await this.commentRepository.save(comments);
  }
}
```

## Complete Queue Processor Integration

### Updated Processor with AI Analysis

Now let's update our queue processor to use all the services we've built:

```typescript
// src/modules/queue/code-review.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bull';
import { CodeAnalysisService } from '../code-analysis/code-analysis.service';
import { GithubService } from '../github/github.service';
import { DatabaseService } from '../database/database.service';

@Injectable()
@Processor('code-review')
export class CodeReviewProcessor {
  private readonly logger = new Logger(CodeReviewProcessor.name);

  constructor(
    private readonly codeAnalysisService: CodeAnalysisService,
    private readonly githubService: GithubService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Process('analyze-pull-request')
  async handleCodeReview(job: Job) {
    const { owner, repo, pullNumber, headSha, baseSha } = job.data;

    this.logger.log(`Processing code review for ${owner}/${repo}#${pullNumber}`);

    // Create a review record in the database
    const review = await this.databaseService.createReview({
      owner,
      repo,
      pullNumber,
      commitSha: headSha,
      summary: 'Processing...',
    });

    try {
      // Update status to in_progress
      await this.databaseService.updateReviewStatus(review.id, 'in_progress');

      // Get the diff from GitHub
      const diff = await this.githubService.getPullRequestDiff(owner, repo, pullNumber);

      // Analyze the code changes
      const analysis = await this.codeAnalysisService.analyzeCode(diff);

      // Save comments to database
      if (analysis.issues && analysis.issues.length > 0) {
        await this.databaseService.addReviewComments(review.id, analysis.issues);

        // Post review comments to GitHub
        await this.githubService.postReviewComments(
          owner,
          repo,
          pullNumber,
          headSha,
          analysis.issues,
        );
      }

      // Update review with final summary
      await this.databaseService.updateReviewStatus(review.id, 'completed');

      // Post overall review summary to GitHub
      await this.githubService.postReviewSummary(
        owner,
        repo,
        pullNumber,
        headSha,
        analysis.summary,
      );

      this.logger.log(`Completed code review for ${owner}/${repo}#${pullNumber}`);
    } catch (error) {
      // Mark review as failed
      await this.databaseService.updateReviewStatus(review.id, 'failed');

      this.logger.error(`Failed to process code review: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
}
```

## Testing AI Integration

### Unit Testing AI Services

Test AI services with mocked responses:

```typescript
// src/modules/code-analysis/openai.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { OpenAIService } from './openai.service';

describe('OpenAIService', () => {
  let service: OpenAIService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OpenAIService],
    }).compile();

    service = module.get<OpenAIService>(OpenAIService);
  });

  it('should handle mock responses', async () => {
    process.env.OPENAI_API_KEY = 'test_key';

    const result = await service.analyzeCodeDiff('sample diff');

    expect(result).toEqual({
      summary: 'Mock code review analysis - no actual AI analysis performed.',
      issues: expect.arrayContaining([
        expect.objectContaining({
          type: 'best-practice',
          severity: 'low',
        }),
      ]),
      positives: ['Code is properly formatted'],
    });
  });
});
```

### Integration Testing with Real APIs

Test against real APIs in controlled environments:

```typescript
// test/ai-integration.e2e-spec.ts
describe('AI Integration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Set up test environment with real API keys
    process.env.OPENAI_API_KEY = 'real-test-key';
  });

  it('should analyze real code diff', async () => {
    const sampleDiff = `
      +function calculateTotal(items) {
      +  let total = 0;
      +  for (let item of items) {
      +    total += item.price;
      +  }
      +  return total;
      +}
    `;

    const result = await request(app.getHttpServer())
      .post('/webhook/github')
      .send(createMockPullRequestPayload(sampleDiff))
      .expect(200);

    // Verify that the analysis was triggered
    expect(result.body.message).toBe('Webhook processed successfully');
  });
});
```

## Rate Limiting and Cost Management

### Implementing Rate Limiting

Protect against API abuse and manage costs:

```typescript
// src/common/guards/rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Implement rate limiting logic
    // Check against Redis or in-memory store

    return true; // Simplified for example
  }
}
```

### Cost Monitoring

Track API usage and costs:

```typescript
// src/modules/monitoring/cost-tracker.service.ts
@Injectable()
export class CostTrackerService {
  private readonly logger = new Logger(CostTrackerService.name);

  async trackOpenAIUsage(tokens: number, model: string): Promise<void> {
    const cost = this.calculateCost(tokens, model);

    this.logger.log(`OpenAI usage: ${tokens} tokens, cost: $${cost.toFixed(4)}`);

    // Store in database for analytics
    await this.storeCostData(tokens, cost, model);
  }

  private calculateCost(tokens: number, model: string): number {
    // GPT-4 pricing as of 2024
    const rates = {
      'gpt-4': { input: 0.03, output: 0.06 }, // per 1k tokens
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    };

    const rate = rates[model] || rates['gpt-4'];
    return (tokens / 1000) * rate.input; // Simplified calculation
  }
}
```

## Error Handling and Fallbacks

### Graceful Degradation

Implement fallbacks when AI services fail:

```typescript
// src/modules/code-analysis/fallback.service.ts
@Injectable()
export class FallbackAnalysisService {
  async performBasicAnalysis(diff: string): Promise<CodeAnalysisResult> {
    return {
      summary: 'Basic analysis completed (AI service unavailable)',
      issues: this.getStaticChecks(diff),
      positives: ['Code changes detected and processed'],
    };
  }

  private getStaticChecks(diff: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // Implement basic static analysis
    if (diff.includes('console.log')) {
      issues.push({
        type: 'best-practice',
        severity: 'low',
        message: 'Console.log detected',
        suggestion: 'Use proper logging framework',
      });
    }

    return issues;
  }
}
```

## Best Practices for AI Integration

### 1. Prompt Engineering
- Use structured prompts with clear examples
- Include context about the codebase
- Specify output format explicitly
- Test prompts with various code types

### 2. Error Handling
- Always have fallback mechanisms
- Log AI service failures for analysis
- Implement circuit breakers for repeated failures
- Cache successful responses when appropriate

### 3. Cost Management
- Monitor token usage continuously
- Implement rate limiting per user/repository
- Use cheaper models for simple tasks
- Cache analysis results for similar code

### 4. Quality Assurance
- Validate AI responses before posting
- Combine AI with static analysis
- Allow users to provide feedback
- Continuously improve prompts based on results

## Conclusion

We've successfully integrated AI-powered code analysis into our event-driven architecture, creating an intelligent system that:

- **Analyzes code changes** using state-of-the-art language models
- **Provides structured feedback** with actionable suggestions
- **Handles failures gracefully** with fallback mechanisms
- **Manages costs effectively** through monitoring and rate limiting
- **Posts intelligent comments** directly to GitHub pull requests

Key achievements:
- Robust OpenAI integration with error handling
- Effective prompt engineering for code review tasks
- Combination of AI analysis with heuristic checks
- Complete GitHub API integration for feedback delivery
- Database tracking for analytics and improvement

In our final article, we'll focus on production-ready queue processing, monitoring, and scaling strategies to handle high-volume code review workloads.

## What's Next

The next article will cover:
- Advanced queue processing patterns and optimization
- Comprehensive monitoring and alerting
- Scaling strategies for high-volume repositories
- Production deployment and DevOps considerations

Stay tuned for "Production-Ready Queue Processing for Code Analysis Services"!

---

**Resources:**
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [GitHub API Reference](https://docs.github.com/en/rest)
- [Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering)
- [TypeScript Best Practices](https://typescript-eslint.io/rules/)