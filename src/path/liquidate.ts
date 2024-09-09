import { getDocumentById, updateDocumentById } from "@/firebase";
import { swapTokensToEth } from "@/sell";
import { StoredLoan } from "@/types";
import { log } from "@/utils/handlers";
import { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";

// Job storage for demonstration. In production, use a more reliable system like Redis.
const jobStatus: Record<string, { status: string; txn?: string }> = {};

export async function sellLoanCollateral(req: Request, res: Response) {
  const { loanId } = req.body;

  const loan = await getDocumentById<StoredLoan>({
    collectionName: "mortages",
    id: loanId,
  });

  if (!loan) {
    return res
      .status(404)
      .json({ message: `No loan for loan ID ${loanId} found` });
  }

  const jobId = `${loanId}-${Date.now()}`; // Create a unique job ID

  log(`New job ${jobId} added`);

  // Mark the job as "Pending"
  jobStatus[jobId] = { status: "Pending" };

  // Enqueue the background task (non-blocking)
  processSwapTokensToEthJob(jobId, loan);

  // Return "Pending" response immediately
  return res.status(202).json({
    message: `Job queued for loan ${loanId}.`,
    jobId,
  });
}

// Polling endpoint to check job status
export async function getJobStatus(req: Request, res: Response) {
  const jobId = req.query.jobId as string;
  const job = jobStatus[jobId];

  if (!job) {
    return res.status(404).json({ message: `Job with ID ${jobId} not found` });
  }

  return res.json(job);
}

// Function to process swapTokensToEth in the background
async function processSwapTokensToEthJob(jobId: string, loan: StoredLoan) {
  const { collateralToken, collateralAmount, id: loanId } = loan;

  try {
    const txn = await swapTokensToEth(collateralToken, collateralAmount);

    if (txn) {
      // Update loan with transaction details
      await updateDocumentById<StoredLoan>({
        collectionName: "mortages",
        id: loanId || "",
        updates: {
          liquidateTxn: txn,
          liquidatedAt: Timestamp.now(),
        },
      });

      // Mark job as completed
      jobStatus[jobId] = { status: "Completed", txn };
    } else {
      // Mark job as failed
      jobStatus[jobId] = { status: "Failed" };
    }
  } catch (error) {
    // Mark job as failed on error
    jobStatus[jobId] = { status: "Failed" };
  }
}
