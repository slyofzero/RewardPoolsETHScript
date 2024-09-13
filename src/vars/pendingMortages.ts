import { getDocument } from "@/firebase";
import { StoredLoan } from "@/types/storedLoan";
import { log } from "@/utils/handlers";

export let dueMortages: StoredLoan[] = [];
export let undueMortages: StoredLoan[] = [];
export let mortages: StoredLoan[] = [];
export let collateralTokens: string[] = [];

export async function syncPendingMortages() {
  log("Syncing pending or due loans");

  mortages = await getDocument<StoredLoan>({
    collectionName: "mortages",
    queries: [["status", "==", "PAID"]],
  });

  const newDueMortages: StoredLoan[] = [];
  const newUnDueMortages: StoredLoan[] = [];

  for (const mortage of mortages) {
    const { repaymentStatus } = mortage;

    if (repaymentStatus === "PENDING" || repaymentStatus === "PASTDUE") {
      newDueMortages.push(mortage);
    } else if (repaymentStatus) {
      newUnDueMortages.push(mortage);
    }
  }

  dueMortages = newDueMortages;
  undueMortages = newUnDueMortages;

  const newCollateralTokens: string[] = [];

  for (const { collateralToken } of dueMortages) {
    if (!newCollateralTokens.includes(collateralToken))
      newCollateralTokens.push(collateralToken);
  }

  collateralTokens = newCollateralTokens;
}
