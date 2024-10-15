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

async function sendRewards() {
  log("Sending rewards...");
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
          getEthBalance(poolData.pool),
        ]);

        if (poolBalance > 0) {
          log(
            `Pool ${poolId} has pending ${poolBalance} ${poolData.tokenSymbol}`
          );

          const rewardRefundTxn = await transferTokens(
            poolData.mnemonicPhrase,
            poolData.creator,
            poolData.token,
            poolBalance
          );

          if (rewardRefundTxn) {
            log(`Pool ${poolId} reward refunded ${rewardRefundTxn}`);

            updateDocumentById<StoredPool>({
              collectionName: "pools",
              id: poolId,
              updates: { rewardRefundTxn, status: "CLOSED" },
            });

            log(`Pool ${poolId} was closed`);
          }
        }

        // if (remainingEthBalance > 0) {
        //   log(`Pool ${poolId} has pending ${remainingEthBalance} ETH`);

        //   const gasRefundTxn = await transferEth(
        //     poolData.mnemonicPhrase,
        //     remainingEthBalance,
        //     poolData.creator
        //   );

        //   if (gasRefundTxn) {
        //     log(`Pool ${poolId} gas refunded ${gasRefundTxn}`);

        //     updateDocumentById<StoredPool>({
        //       collectionName: "pools",
        //       id: poolId,
        //       updates: { gasRefundTxn },
        //     });
        //   }
        // }
      } else {
        // Reward the stake if it hasn't been rewarded yet
        for (const stake of stakes) {
          const reward = parseFloat((stake.amount * (poolData.reward / 100)).toFixed(4)) // prettier-ignore
          const totalAmount = stake.amount + reward;

          log(`${stake.user} staked ${stake.amount} for ${stake.pool}, they'd receive ${totalAmount}`); // prettier-ignore

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
  }

  log("✅ Sent rewards");
}

(async function () {
  await sendRewards();
  setInterval(async () => await sendRewards(), 10 * 60 * 1e3);
})();
