declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: "development" | "production";
      FIREBASE_KEY: string | undefined;
      VAULT_ADDRESS: string | undefined;
      VAULT_PRIVATE_KEY: string | undefined;
      ETHERSCAN_API_KEY: string | undefined;
      PORT: number | undefined;
      RPC_URL: string | undefined;
    }
  }
}

export {};
