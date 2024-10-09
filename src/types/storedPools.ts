import { Timestamp } from "firebase-admin/firestore";

export interface StoredPool {
  name: string;
  token: string;
  size: number;
  reward: number;
  duration: number;
  pool: string;
  tokenSymbol: string;
  tokenName: string;
  mnemonicPhrase: string;
  staked: number;
  createdOn: Timestamp;
  closesAt: Timestamp;
  status: "PENDING" | "ACTIVE" | "CLOSED";
  creator: string;
  rewardsDepositTxn?: string;
  gasDepositTxn?: string;
  id?: string;
  rewardRefundTxn?: string;
  gasRefundTxn?: string;
}
