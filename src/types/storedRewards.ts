import { Timestamp } from "firebase-admin/firestore";

export interface StoredRewards {
  user: string;
  amount: number;
  pool: string;
  stakedOn: Timestamp;
  rewardTxn?: string;
}
