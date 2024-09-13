import { Request, Response } from "express";
import { provider, web3 } from "./sell";
import { mortages, undueMortages } from "./vars/pendingMortages";
import { VAULT_ADDRESS } from "./utils/env";
import { StoredLoan } from "./types";

const swapEvent =
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";

function decodeHexToDecimal(hex: string) {
  return BigInt(`0x${hex}`).toString();
}

async function getInterestEarned() {
  let totalInterestEarned = 0;

  for (const mortage of undueMortages) {
    const { autoSoldTxn, liquidateTxn, repayEthTxn, ethLent } = mortage;
    const txnToCheck = autoSoldTxn || liquidateTxn || repayEthTxn;
    const tokenSellTxns = liquidateTxn || autoSoldTxn;

    if (!txnToCheck) continue;
    let ethReceived = 0;

    if (repayEthTxn) {
      const txn = await provider.getTransaction(txnToCheck);
      const eth = Number(web3.utils.fromWei(String(txn?.value)));
      ethReceived += eth;
    }

    if (tokenSellTxns) {
      const txn = await web3.eth.getTransactionReceipt(tokenSellTxns);
      const swapEventLog = txn.logs.find(({ topics }) =>
        topics?.includes(swapEvent)
      );

      const segmentLength = 64; // Each segment is 32 bytes or 64 hex characters
      const swapLogData = swapEventLog?.data.replace("0x", "");
      const numberOfSegments = (swapLogData?.length || 0) / segmentLength; // Calculate how many segments there are
      const decodedValues = [];

      for (let i = 0; i < numberOfSegments; i++) {
        const start = i * segmentLength;
        const end = start + segmentLength;
        const segment = swapLogData?.slice(start, end);
        if (segment) decodedValues.push(decodeHexToDecimal(segment));
      }

      const [amount0In, , amount0Out, amount1Out] = decodedValues;
      const otherWay = !Number(amount0In) && !Number(amount1Out);
      const amountOut = otherWay ? amount0Out : amount1Out;

      const eth = Number(web3.utils.fromWei(amountOut));
      ethReceived += eth;
    }

    const interestEarned = ethReceived - ethLent;
    totalInterestEarned += interestEarned;
  }

  return totalInterestEarned;
}

// Polling endpoint to check job status
export async function getStats(req: Request, res: Response) {
  const [balance, interestEarned] = await Promise.all([
    provider.getBalance(VAULT_ADDRESS || ""),
    getInterestEarned(),
  ]);

  const vaultEth = Number(web3.utils.fromWei(String(balance)));
  const tokensValue = 0;
  const loanCount = mortages.length;
  const loanValue = mortages.reduce(
    (prev, curr) =>
      ({
        ethLent: prev.ethLent + curr.ethLent,
      } as StoredLoan)
  ).ethLent;

  const stats = {
    interestEarned,
    vaultEth,
    loanCount,
    loanValue,
    tokensValue,
  };

  return res.json(stats);
}
