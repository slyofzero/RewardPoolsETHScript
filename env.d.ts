declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production";
      FIREBASE_KEY: string | undefined;
      RPC_URL: string | undefined;
      ENCRYPTION_KEY: string | undefined;
    }
  }
}

export {};
