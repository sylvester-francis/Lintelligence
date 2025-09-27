# Lintelligence - Intelligent Code Review Agent

An AI-powered code review agent built with NestJS that automatically reviews GitHub pull requests using OpenAI's GPT-4. The agent analyzes code changes, detects potential issues, and posts constructive feedback directly on GitHub.

## Features

- **Automated Code Analysis**: Uses OpenAI GPT-4 to analyze code diffs for bugs, security issues, performance problems, and best practices
- **GitHub Integration**: Automatically processes GitHub webhook events for pull requests
- **Queue-Based Processing**: Uses Redis and Bull queues for reliable background processing
- **Database Persistence**: Stores review history and comments in PostgreSQL
- **Webhook Security**: Verifies GitHub webhook signatures for security
- **Comprehensive Analysis**: Combines AI analysis with heuristic checks for thorough code review
- **RESTful API**: Provides endpoints for stats and health monitoring

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub        │    │   Code Review   │    │   OpenAI        │
│   Webhooks      │───▶│   Agent         │───▶│   GPT-4         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Redis Queue   │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   PostgreSQL    │
                       └─────────────────┘
```

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- OpenAI API Key
- GitHub Personal Access Token
- Docker (optional)

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd Lintelligence
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=code_review_agent

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# GitHub Configuration
GITHUB_TOKEN=ghp_your_github_token_here
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# OpenAI Configuration
OPENAI_API_KEY=sk-your_openai_api_key_here
```

### 3. Start Infrastructure with Docker

```bash
docker-compose up -d
```

This starts PostgreSQL and Redis services.

### 4. Run the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## Configuration

### GitHub Setup

1. **Create a Personal Access Token**:
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate a token with `repo` and `pull_requests` permissions

2. **Configure Webhook**:
   - In your repository, go to Settings → Webhooks
   - Add webhook URL: `https://your-domain.com/webhook/github`
   - Content type: `application/json`
   - Events: `Pull requests`
   - Add your webhook secret

### OpenAI Setup

1. Get an API key from [OpenAI Platform](https://platform.openai.com/)
2. Add it to your `.env` file as `OPENAI_API_KEY`

## API Endpoints

### Webhook
- `POST /webhook/github` - GitHub webhook endpoint

### Monitoring
- `GET /stats` - Application statistics
- `GET /stats/health` - Health check

### Example Stats Response
```json
{
  "reviews": {
    "total": 42,
    "completed": 38,
    "failed": 4,
    "successRate": 90.48
  },
  "queue": {
    "waiting": 2,
    "active": 1,
    "completed": 38,
    "failed": 4
  },
  "timestamp": "2025-01-20T10:30:00.000Z"
}
```

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:cov

# E2E tests
npm run test:e2e
```

## Docker Deployment

### Build and Run
```bash
# Build the image
docker build -t code-review-agent .

# Run with docker-compose
docker-compose up
```

### Environment Variables for Docker
All environment variables from `.env` can be passed to the Docker container.

## How It Works

1. **Webhook Reception**: GitHub sends a webhook when a PR is opened or updated
2. **Signature Verification**: The agent verifies the webhook signature for security
3. **Queue Processing**: The review job is added to a Redis queue for background processing
4. **Code Analysis**:
   - Fetches the PR diff from GitHub
   - Sends the diff to OpenAI GPT-4 for analysis
   - Runs additional heuristic checks
5. **Review Posting**: Posts the analysis results as comments on the GitHub PR
6. **Database Storage**: Stores review history and comments for tracking

## Review Types

The agent checks for:

- **Bugs**: Logic errors, null pointer exceptions, infinite loops
- **Security**: SQL injection, XSS vulnerabilities, credential exposure
- **Performance**: Inefficient algorithms, memory leaks, blocking operations
- **Style**: Code formatting, naming conventions, documentation
- **Best Practices**: Design patterns, error handling, type safety

## Development

### Project Structure
```
src/
├── entities/           # TypeORM database entities
├── modules/
│   ├── webhook/       # Webhook handling
│   ├── code-analysis/ # AI-powered code analysis
│   ├── github/        # GitHub API integration
│   ├── queue/         # Background job processing
│   └── database/      # Database services
├── app.module.ts      # Main application module
└── main.ts           # Application entry point
```

### Adding New Features

1. Create a new module in `src/modules/`
2. Implement your service logic
3. Add the module to `app.module.ts`
4. Write tests for your functionality

## Security Considerations

- Always verify GitHub webhook signatures
- Use environment variables for secrets
- Regularly rotate API keys
- Monitor API usage and costs
- Implement rate limiting for production use

## Monitoring and Observability

- Application logs are structured and include correlation IDs
- Queue metrics are available via `/stats` endpoint
- Database performance can be monitored through TypeORM logging
- Consider adding APM tools like New Relic or DataDog for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Troubleshooting

### Common Issues

**Application won't start**
- Check that all environment variables are set
- Ensure PostgreSQL and Redis are running
- Verify your OpenAI API key is valid

**Webhooks not working**
- Confirm webhook URL is accessible from GitHub
- Check webhook secret matches your configuration
- Verify GitHub token has correct permissions

**Reviews not posting**
- Check GitHub token permissions
- Verify repository access
- Monitor application logs for errors

### Support

For issues and questions:
- Check the application logs
- Review the `/stats` endpoint for system health
- Create an issue in the repository

---

Built with NestJS, TypeScript, and OpenAI GPT-4