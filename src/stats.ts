import { Request, Response } from "express";
import { provider, web3 } from "./sell";
import { mortages, undueMortages } from "./vars/pendingMortages";
import { ETHERSCAN_API_KEY, VAULT_ADDRESS } from "./utils/env";
import { PairsData, StoredLoan } from "./types";
import { apiFetcher } from "./utils/api";
import { ethers } from "ethers";
import { roundToSixDecimals } from "./utils/general";

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

async function getTokensHeldCapital() {
  const tokenTxs =
    await apiFetcher(`https://api.etherscan.io/api?module=account&action=tokentx&address=${VAULT_ADDRESS}&startblock=0&endblock=999999999&sort=asc&apikey=${ETHERSCAN_API_KEY}
`);
  const balances: { [key: string]: number } = {};
  // @ts-expect-error weee
  const txns = tokenTxs?.data.result as any[];

  txns?.forEach((tx) => {
    const tokenAddress = tx.contractAddress;
    const tokenDecimals = parseInt(tx.tokenDecimal);

    const value = roundToSixDecimals(
      ethers.formatUnits(tx.value, tokenDecimals)
    );

    const isSent = tx.from.toLowerCase() === VAULT_ADDRESS?.toLowerCase();

    if (!balances[tokenAddress]) {
      balances[tokenAddress] = 0;
    }

    if (isSent) {
      balances[tokenAddress] -= value;
    } else {
      balances[tokenAddress] += value;
    }
  });

  let tokensEthCapital = 0;

  const pairs = await Promise.all(
    Object.keys(balances).map((token) =>
      apiFetcher<PairsData>(
        `https://api.dexscreener.com/latest/dex/tokens/${token}`
      )
    )
  );

  for (const pair of pairs) {
    const WETH_pair = pair?.data?.pairs?.find(
      ({ quoteToken }) =>
        quoteToken.address === "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    );
    const token = WETH_pair?.baseToken.address.toLowerCase();
    if (!token || !WETH_pair) continue;

    const tokenValue = Number(WETH_pair?.priceNative) * balances[token];
    if (!isNaN(tokenValue)) tokensEthCapital += tokenValue;
  }

  // for (const token in balances) {
  //   try {
  //     if (balances[token] > 0) {
  //       const data = await apiFetcher<PairsData>(
  //         `https://api.dexscreener.com/latest/dex/tokens/${token}`
  //       );

  //       const WETH_pair = data?.data.pairs?.find(
  //         ({ quoteToken }) =>
  //           quoteToken.address === "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
  //       );

  //       const tokenValue = Number(WETH_pair?.priceNative) * balances[token];
  //       if (!isNaN(tokenValue)) tokensEthCapital += tokenValue;
  //     }
  //   } catch (error) {
  //     //
  //   }
  // }

  return tokensEthCapital;
}

// Polling endpoint to check job status
export async function getStats(req: Request, res: Response) {
  const [balance, interestEarned] = await Promise.all([
    provider.getBalance(VAULT_ADDRESS || ""),
    getInterestEarned(),
  ]);

  const vaultEth = Number(web3.utils.fromWei(String(balance)));
  const tokensValue = await getTokensHeldCapital();
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
