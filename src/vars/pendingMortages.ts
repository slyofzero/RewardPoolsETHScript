import { getDocument } from "@/firebase";
import { StoredLoan } from "@/types/storedLoan";
import { log } from "@/utils/handlers";

export let dueMortages: StoredLoan[] = [];
export let collateralTokens: string[] = [];

export async function syncPendingMortages() {
  log("Syncing pending or due loans");

  dueMortages = await getDocument<StoredLoan>({
    collectionName: "mortages",
    queries: [["repaymentStatus", "in", ["PENDING", "PASTDUE"]]],
  });

  const newCollateralTokens: string[] = [];

  for (const { collateralToken } of dueMortages) {
    if (!newCollateralTokens.includes(collateralToken))
      newCollateralTokens.push(collateralToken);
  }

  collateralTokens = newCollateralTokens;
}
