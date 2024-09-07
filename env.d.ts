declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production";
      FIREBASE_KEY: string | undefined;
      VAULT_ADDRESS: string;
      VAULT_PRIVATE_KEY: string;
    }
  }
}

export {};
