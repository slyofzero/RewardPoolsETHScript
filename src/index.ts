import { Timestamp } from "firebase-admin/firestore";
import { updateDocumentById } from "./firebase";
import { swapTokensToEth } from "./sell";
import { PairsData, StoredLoan } from "./types";
import { apiFetcher } from "./utils/api";
import { sellThreshold } from "./utils/constants";
import {
  collateralTokens,
  dueMortages,
  syncPendingMortages,
} from "./vars/pendingMortages";
import { log } from "./utils/handlers";
import moment from "moment";

const tokenPrices: { [key: string]: number } = {};

async function getTokenPrices() {
  for (const token of collateralTokens) {
    const data = await apiFetcher<PairsData>(
      `https://api.dexscreener.com/latest/dex/tokens/${token}`
    );

    const firstPair = data?.data.pairs.at(0);
    if (!firstPair) continue;

    const price = firstPair.priceUsd;
    tokenPrices[token] = Number(price);
  }
}

async function executeLoanCollateralSell(mortage: StoredLoan) {
  const { id, collateralUsdPriceAtLoan, collateralToken, collateralAmount } =
    mortage;
  const currentPrice = tokenPrices[collateralToken];

  const priceRatio = currentPrice / collateralUsdPriceAtLoan;
  const executeSell = priceRatio <= sellThreshold;

  if (!executeSell) return;

  const txnHash = await swapTokensToEth(collateralToken, collateralAmount);

  updateDocumentById<StoredLoan>({
    collectionName: "mortages",
    id: id || "",
    updates: {
      autoSoldTxn: txnHash,
      autoSoldAt: Timestamp.now(),
      repaymentStatus: "AUTOSOLD",
    },
  }).then(syncPendingMortages);

  log(`Loan ID ${id} was autosold`);
}

async function checkIfPastDue(mortage: StoredLoan) {
  const { id, loanDueAt } = mortage;
  const dueDatePassed =
    moment.now() / 1e3 > (loanDueAt?.seconds || 99999999999);

  if (!dueDatePassed) return;

  updateDocumentById<StoredLoan>({
    collectionName: "mortages",
    id: id || "",
    updates: { repaymentStatus: "PASTDUE" },
  }).then(syncPendingMortages);
}

(async function () {
  await Promise.all([syncPendingMortages()]);

  const autoSellLoanCollateral = async () => {
    log("Checking for autosell conditions");

    await getTokenPrices();

    for (const mortage of dueMortages) {
      await checkIfPastDue(mortage);
      executeLoanCollateralSell(mortage);
    }
  };

  setInterval(autoSellLoanCollateral, 60 * 1e3);
  setInterval(syncPendingMortages, 60 * 60 * 1e3);

  autoSellLoanCollateral();
})();
