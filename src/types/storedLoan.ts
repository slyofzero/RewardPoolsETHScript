import { Timestamp } from "firebase-admin/firestore";

export interface StoredLoan {
  id?: string;
  collateralToken: string;
  collateralAmount: number;
  collateralUsdValueAtLoan: number;
  collateralUsdPriceAtLoan: number;
  ethLent: number;
  ethLentUsd: number;
  duration: number;
  status: "PENDING" | "EXPIRED" | "PAID";
  user: string;
  collateralDepositTxn?: string;
  ethLentTxn?: string;
  loanActiveAt?: Timestamp;
  loanDueAt?: Timestamp;
  repaymentStatus?: "PENDING" | "PASTDUE" | "PAID" | "AUTOSOLD" | "LIQUIDATED";
  repayEthTxn?: string;
  collateralReleaseTxn?: string;
  loanRepaidAt?: Timestamp;
  autoSoldAt?: Timestamp;
  autoSoldTxn?: string;
  liquidateTxn?: string;
  refundTxn?: string;
  liquidatedAt?: Timestamp;
}
