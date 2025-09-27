export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface GithubConfig {
  webhookSecret: string;
  token: string;
  appId?: string;
  privateKey?: string;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic';
  openaiApiKey?: string;
  openaiModel?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
  maxTokens: number;
  temperature: number;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  github: GithubConfig;
  ai: AIConfig;
}