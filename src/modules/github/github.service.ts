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

  private isLineInFile(patch: string, lineNumber: number): boolean {
    // Simple heuristic to check if a line number is in the file patch
    // This is a simplified implementation
    const lines = patch.split('\n');
    let currentLine = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        const match = line.match(/\+(\d+)/);
        if (match) {
          currentLine = parseInt(match[1]);
        }
      } else if (line.startsWith('+') || line.startsWith(' ')) {
        currentLine++;
        if (currentLine === lineNumber) {
          return true;
        }
      }
    }

    return false;
  }
}