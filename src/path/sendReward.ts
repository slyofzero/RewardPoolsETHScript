import { addDocument, getDocument, updateDocumentById } from "@/firebase";
import { StoredPool, StoredRewards } from "@/types";
import { log } from "@/utils/handlers";
import { getTokenBalance, getTokenDetails, transferTokens } from "@/utils/web3";
import { Request, Response } from "express";
import { Timestamp } from "firebase-admin/firestore";

interface JobData {
  address: string;
  reward: number;
  poolData: StoredPool;
}

// Job storage for demonstration. In production, use a more reliable system like Redis.
const jobStatus: Record<string, { status: string; txn?: string }> = {};

export async function sendReward(req: Request, res: Response) {
  const { pool, address } = req.body;

  const [poolData] = await getDocument<StoredPool>({
    collectionName: "pools",
    queries: [["pool", "==", pool]],
  });

  if (!poolData) {
    return res.status(404).json({ message: `No pool for ${pool} found` });
  }

  const [tokenData, addressBalance] = await Promise.all([
    getTokenDetails(poolData.token),
    getTokenBalance(address, poolData.token),
  ]);
  const holding = (addressBalance / (tokenData?.totalSupply || 0)) * 100;

  let rewardPercentage = holding / (pool.maxClaim / 100);
  rewardPercentage = rewardPercentage > 100 ? 100 : rewardPercentage;

  let reward = (rewardPercentage / 100) * pool.size;
  reward =
    reward > pool.size - pool.claimed ? pool.size - pool.claimed : reward;

  const jobData: JobData = {
    address,
    reward,
    poolData,
  };

  const jobId = `${poolData.id}-${Date.now()}`; // Create a unique job ID

  log(`New job ${jobId} added`);

  // Mark the job as "Pending"
  jobStatus[jobId] = { status: "Pending" };

  // Enqueue the background task (non-blocking)
  processTokenTransferJob(jobId, jobData);

  // Return "Pending" response immediately
  return res.status(202).json({
    message: `Job queued for sending rewards from ${pool} to ${address}.`,
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
async function processTokenTransferJob(jobId: string, jobData: JobData) {
  const { address, reward, poolData } = jobData;
  const { token, mnemonicPhrase } = poolData;

  try {
    const txn = await transferTokens(mnemonicPhrase, address, token, reward);
    if (txn) {
      addDocument<StoredRewards>({
        collectionName: "rewards",
        data: {
          amount: reward,
          pool: poolData.id || "",
          stakedOn: Timestamp.now(),
          user: address,
          rewardTxn: txn,
        },
      });

      const newClaimed = poolData.claimed + reward;
      const newBalance = poolData.size - newClaimed;
      const updates: Partial<StoredPool> = { claimed: newClaimed };

      if (newBalance < 0.01 * poolData.size) {
        updates.status = "CLOSED";
      }

      updateDocumentById<StoredPool>({
        collectionName: "pools",
        id: poolData.id || "",
        updates,
      });

      // Mark job as completed
      jobStatus[jobId] = { status: "Completed", txn };
      log(`${address} rewarded ${reward} ${token}`);
    } else {
      // Mark job as failed
      jobStatus[jobId] = { status: "Failed" };
    }
  } catch (error) {
    // Mark job as failed on error
    jobStatus[jobId] = { status: "Failed" };
  }
}
