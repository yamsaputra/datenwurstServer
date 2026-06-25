declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test';
    readonly NEXT_PUBLIC_API_URL?: string;
  }
}

declare var process: { env: NodeJS.ProcessEnv };
