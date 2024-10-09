import { Timestamp } from "firebase-admin/firestore";
import { pools, syncPools } from "./state";
import { getDocument, updateDocumentById } from "./firebase";
import { StoredPool, StoredStakes } from "./types";
import {
  getEthBalance,
  getTokenBalance,
  transferEth,
  transferTokens,
} from "./utils/web3";
import { log } from "./utils/handlers";

(async function () {
  await Promise.all([syncPools()]);

  for (const poolData of pools) {
    const { closesAt } = poolData;
    const currentTimestamp = Timestamp.now();

    if (currentTimestamp > closesAt) {
      const poolId = poolData.id || "";

      const stakes = await getDocument<StoredStakes>({
        collectionName: "stakes",
        queries: [
          ["pool", "==", poolId],
          ["status", "==", "PENDING"],
        ],
      });

      // Close the pool if all stakes have been rewarded
      if (stakes.length === 0) {
        const [poolBalance, remainingEthBalance] = await Promise.all([
          getTokenBalance(poolData.pool, poolData.token),
          getEthBalance(poolData.creator),
        ]);

        const rewardRefundTxn = await Promise.all([
          transferTokens(
            poolData.mnemonicPhrase,
            poolData.creator,
            poolData.token,
            poolBalance
          ),
        ]);

        log(`Pool ${poolId} reward refunded ${rewardRefundTxn}`);

        const gasRefundTxn = await transferEth(
          poolData.mnemonicPhrase,
          remainingEthBalance,
          poolData.creator
        );

        log(`Pool ${poolId} gas refunded ${gasRefundTxn}`);

        if (rewardRefundTxn && gasRefundTxn) {
          updateDocumentById<StoredPool>({
            collectionName: "pools",
            id: poolId,
            updates: { status: "CLOSED" },
          });

          log(`Pool ${poolId} was closed`);
          break;
        }
      }

      // Reward the stake if it hasn't been rewarded yet
      for (const stake of stakes) {
        const reward = parseFloat((stake.amount * (poolData.reward / 100)).toFixed(4)) // prettier-ignore
        const totalAmount = stake.amount + reward;

        const txn = await transferTokens(
          poolData.mnemonicPhrase,
          stake.user,
          poolData.token,
          totalAmount
        );

        if (txn) {
          updateDocumentById<StoredStakes>({
            collectionName: "stakes",
            id: stake.id || "",
            updates: {
              status: "REWARDED",
              rewardTxn: txn,
            },
          });

          log(
            `Stake ${stake.id} for pool ${poolId} was rewarded ${totalAmount}`
          );
        }
      }
    }
  }
})();
