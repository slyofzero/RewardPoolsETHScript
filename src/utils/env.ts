import dotenv from "dotenv";

export const { NODE_ENV } = process.env;
dotenv.config({
  path: NODE_ENV === "development" ? ".env" : ".env.production",
});

export const { FIREBASE_KEY, RPC_URL, ENCRYPTION_KEY, PORT } = process.env;
