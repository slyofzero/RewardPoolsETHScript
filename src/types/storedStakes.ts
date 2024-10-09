import { Timestamp } from "firebase-admin/firestore";

export interface StoredStakes {
  user: string;
  amount: number;
  pool: string;
  stakedOn: Timestamp;
  status: "PENDING" | "REWARDED";
  rewardTxn?: string;
  id?: string;
}
