// import { Timestamp } from "firebase-admin/firestore";
// import { pools, syncPools } from "./state";
// import { getDocument, updateDocumentById } from "./firebase";
// import { StoredPool, StoredStakes } from "./types";
// import { getEthBalance, getTokenBalance, transferTokens } from "./utils/web3";
import { log } from "./utils/handlers";
import express, { Request, Response } from "express";
import { getJobStatus, sendReward } from "./path/sendReward";
import { PORT } from "./utils/env";

const app = express();

// async function sendRewards() {
//   log("Sending rewards...");
//   await Promise.all([syncPools()]);

//   for (const poolData of pools) {
//     const { closesAt } = poolData;
//     const currentTimestamp = Timestamp.now();

//     if (currentTimestamp > closesAt) {
//       const poolId = poolData.id || "";

//       const stakes = await getDocument<StoredStakes>({
//         collectionName: "stakes",
//         queries: [
//           ["pool", "==", poolId],
//           ["status", "==", "PENDING"],
//         ],
//       });

//       // Close the pool if all stakes have been rewarded
//       if (stakes.length === 0) {
//         const [poolBalance] = await Promise.all([
//           getTokenBalance(poolData.pool, poolData.token),
//           getEthBalance(poolData.pool),
//         ]);

//         if (poolBalance > 0) {
//           log(
//             `Pool ${poolId} has pending ${poolBalance} ${poolData.tokenSymbol}`
//           );

//           const rewardRefundTxn = await transferTokens(
//             poolData.mnemonicPhrase,
//             poolData.creator,
//             poolData.token,
//             poolBalance
//           );

//           if (rewardRefundTxn) {
//             log(`Pool ${poolId} reward refunded ${rewardRefundTxn}`);

//             updateDocumentById<StoredPool>({
//               collectionName: "pools",
//               id: poolId,
//               updates: { rewardRefundTxn, status: "CLOSED" },
//             });

//             log(`Pool ${poolId} was closed`);
//           }
//         }

//         // if (remainingEthBalance > 0) {
//         //   log(`Pool ${poolId} has pending ${remainingEthBalance} ETH`);

//         //   const gasRefundTxn = await transferEth(
//         //     poolData.mnemonicPhrase,
//         //     remainingEthBalance,
//         //     poolData.creator
//         //   );

//         //   if (gasRefundTxn) {
//         //     log(`Pool ${poolId} gas refunded ${gasRefundTxn}`);

//         //     updateDocumentById<StoredPool>({
//         //       collectionName: "pools",
//         //       id: poolId,
//         //       updates: { gasRefundTxn },
//         //     });
//         //   }
//         // }
//       }
//     }
//   }

//   log("✅ Sent rewards");
// }

(async function () {
  app.use(express.json());

  app.get("/ping", (req: Request, res: Response) => {
    return res.json({ message: "Server is up" });
  });

  app.get("/jobStatus", getJobStatus);
  app.post("/sendReward", sendReward);

  app.listen(PORT, () => {
    log(`Server is running on port ${PORT}`);
  });

  // await sendRewards();
  // setInterval(async () => await sendRewards(), 10 * 60 * 1e3);
})();
