import { getDocumentById, updateDocumentById } from "@/firebase";
import { swapTokensToEth } from "@/sell";
import { StoredLoan } from "@/types";
import { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";

export async function sellLoanCollateral(req: Request, res: Response) {
  const { loanId } = req.body;

  const loan = await getDocumentById<StoredLoan>({
    collectionName: "mortages",
    id: loanId,
  });

  if (!loan)
    return res
      .status(404)
      .json({ message: `No loan for loan ID ${loanId} found` });

  const { collateralToken, collateralAmount } = loan;
  const txn = await swapTokensToEth(collateralToken, collateralAmount);

  if (txn) {
    await updateDocumentById<StoredLoan>({
      collectionName: "mortages",
      id: loanId,
      updates: {
        liquidateTxn: txn,
        liquidatedAt: Timestamp.now(),
      },
    });

    return res.json({ txn });
  }

  return res.status(400).json({ messaging: "Sell was failed" });
}
