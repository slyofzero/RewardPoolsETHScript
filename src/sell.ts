import Web3 from "web3";
import { BigNumber } from "bignumber.js";
import { RPC_URL, VAULT_ADDRESS, VAULT_PRIVATE_KEY } from "./utils/env";

// Set up Web3 instance
export const web3 = new Web3(RPC_URL || "");

export async function swapTokensToEth(TOKEN_ADDRESS: string, toSell: number) {
  // Constants
  const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
  const UNISWAP_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
  // const TOKEN_ADDRESS = "0x5b342F03D126314d925Fa57A45654f92905e6451"; // Replace with your token address
  const WALLET_ADDRESS = VAULT_ADDRESS || ""; // Replace with your wallet address
  const PRIVATE_KEY = VAULT_PRIVATE_KEY || ""; // Replace with your private key
  // const SELL_PERCENTAGE = 10; // Percentage of tokens to sell (1-100)
  const SLIPPAGE = 5; // Slippage tolerance in percentage

  // ABIs
  const APPROVE_ABI = [
    {
      constant: false,
      inputs: [
        { name: "_spender", type: "address" },
        { name: "_value", type: "uint256" },
      ],
      name: "approve",
      outputs: [{ name: "", type: "bool" }],
      payable: false,
      stateMutability: "nonpayable",
      type: "function",
    },
  ];
  const DECIMALS_ABI = [
    {
      constant: true,
      inputs: [],
      name: "decimals",
      outputs: [{ name: "", type: "uint8" }],
      payable: false,
      stateMutability: "view",
      type: "function",
    },
  ];
  const BALANCE_OF_ABI = [
    {
      constant: true,
      inputs: [{ name: "_owner", type: "address" }],
      name: "balanceOf",
      outputs: [{ name: "balance", type: "uint256" }],
      type: "function",
    },
  ];
  const ALLOWANCE_ABI = [
    {
      constant: true,
      inputs: [
        { name: "_owner", type: "address" },
        { name: "_spender", type: "address" },
      ],
      name: "allowance",
      outputs: [{ name: "", type: "uint256" }],
      type: "function",
    },
  ];
  const UNISWAP_ROUTER_ABI = [
    {
      inputs: [
        { internalType: "uint256", name: "amountIn", type: "uint256" },
        { internalType: "uint256", name: "amountOutMin", type: "uint256" },
        { internalType: "address[]", name: "path", type: "address[]" },
        { internalType: "address", name: "to", type: "address" },
        { internalType: "uint256", name: "deadline", type: "uint256" },
      ],
      name: "swapExactTokensForETHSupportingFeeOnTransferTokens",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "uint256", name: "amountIn", type: "uint256" },
        { internalType: "address[]", name: "path", type: "address[]" },
      ],
      name: "getAmountsOut",
      outputs: [
        { internalType: "uint256[]", name: "amounts", type: "uint256[]" },
      ],
      stateMutability: "view",
      type: "function",
    },
  ];

  // Contract instances
  const tokenContract = new web3.eth.Contract(
    // @ts-expect-error weird
    APPROVE_ABI.concat(DECIMALS_ABI, BALANCE_OF_ABI, ALLOWANCE_ABI),
    TOKEN_ADDRESS
  );
  const uniswapRouterContract = new web3.eth.Contract(
    // @ts-expect-error weird
    UNISWAP_ROUTER_ABI,
    UNISWAP_ROUTER_ADDRESS
  );

  async function getTokenDecimals() {
    try {
      return await tokenContract.methods.decimals().call();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error getting token decimals:", error);
      throw error;
    }
  }

  async function checkAllowance(ownerAddress: string, spenderAddress: string) {
    try {
      const allowance = await tokenContract.methods
        .allowance(ownerAddress, spenderAddress)
        .call();
      return new BigNumber(allowance);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error checking allowance:", error);
      throw error;
    }
  }

  async function getTokenBalance(address: string) {
    try {
      const balance = await tokenContract.methods.balanceOf(address).call();
      return new BigNumber(balance);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error getting token balance:", error);
      throw error;
    }
  }

  // async function calculateSellAmount(
  //   currentBalance: BigNumber,
  //   percentage: number
  // ) {
  //   const amount = currentBalance.multipliedBy(percentage).dividedBy(100);
  //   return amount.integerValue().toString(10);
  // }

  async function approveToken(spenderAddress: string, amount: string) {
    try {
      const currentAllowance = await checkAllowance(
        WALLET_ADDRESS,
        spenderAddress
      );

      if (currentAllowance.gte(amount)) {
        // eslint-disable-next-line no-console
        console.log("Token already approved");
        return;
      }

      const approveData = tokenContract.methods
        .approve(spenderAddress, amount)
        .encodeABI();
      const gasPrice = await web3.eth.getGasPrice();
      const gasEstimate = await tokenContract.methods
        .approve(spenderAddress, amount)
        .estimateGas({ from: WALLET_ADDRESS });

      const tx = {
        from: WALLET_ADDRESS,
        to: TOKEN_ADDRESS,
        gas: gasEstimate,
        gasPrice: gasPrice,
        data: approveData,
      };

      const signedTx = await web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);
      const receipt = await web3.eth.sendSignedTransaction(
        signedTx.rawTransaction || ""
      );
      // eslint-disable-next-line no-console
      console.log("Approval transaction hash:", receipt.transactionHash);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error approving token:", error);
      throw error;
    }
  }

  async function getMinOutputForSell(amountToSell: string) {
    try {
      const amounts = await uniswapRouterContract.methods
        .getAmountsOut(amountToSell, [TOKEN_ADDRESS, WETH_ADDRESS])
        .call();
      const minOutput = new BigNumber(amounts[1])
        .multipliedBy(1 - SLIPPAGE / 100)
        .integerValue()
        .toString(10);
      return minOutput;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error calculating min output:", error);
      throw error;
    }
  }

  async function executeSell(amountToSell: string, amountOutMin: string) {
    try {
      // eslint-disable-next-line no-console
      console.log("Executing sell...");
      // eslint-disable-next-line no-console
      console.log("Amount to sell:", amountToSell);
      // eslint-disable-next-line no-console
      console.log("Minimum output:", amountOutMin);

      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from now
      // eslint-disable-next-line no-console
      console.log("Deadline:", deadline);

      const gasPrice = web3.utils.toWei(
        (
          parseFloat(
            web3.utils.fromWei(await web3.eth.getGasPrice(), "ether")
          ) * 1.4
        ).toString(),
        "ether"
      );
      // eslint-disable-next-line no-console
      console.log("Gas price:", gasPrice);
      // eslint-disable-next-line no-console
      console.log("Preparing swap data...");
      const swapData = uniswapRouterContract.methods
        .swapExactTokensForETHSupportingFeeOnTransferTokens(
          amountToSell,
          amountOutMin,
          [TOKEN_ADDRESS, WETH_ADDRESS],
          WALLET_ADDRESS,
          deadline
        )
        .encodeABI();

      // eslint-disable-next-line no-console
      console.log("Estimating gas...");
      const gasEstimate = await uniswapRouterContract.methods
        .swapExactTokensForETHSupportingFeeOnTransferTokens(
          amountToSell,
          amountOutMin,
          [TOKEN_ADDRESS, WETH_ADDRESS],
          WALLET_ADDRESS,
          deadline
        )
        .estimateGas({ from: WALLET_ADDRESS });

      // eslint-disable-next-line no-console
      console.log("Gas estimate:", gasEstimate);

      const tx = {
        from: WALLET_ADDRESS,
        to: UNISWAP_ROUTER_ADDRESS,
        gas: gasEstimate,
        gasPrice: gasPrice,
        data: swapData,
      };

      // eslint-disable-next-line no-console
      console.log("Transaction object:", tx);

      // eslint-disable-next-line no-console
      console.log("Signing transaction...");
      const signedTx = await web3.eth.accounts.signTransaction(tx, PRIVATE_KEY);

      // eslint-disable-next-line no-console
      console.log("Transaction signed");

      // eslint-disable-next-line no-console
      console.log("Sending transaction...");
      const receipt = await web3.eth.sendSignedTransaction(
        signedTx.rawTransaction || ""
      );
      // eslint-disable-next-line no-console
      console.log("Sell transaction hash:", receipt.transactionHash);

      return receipt.transactionHash;
    } catch (err) {
      const error = err as Error;
      // eslint-disable-next-line no-console
      console.error("Error executing sell:", error);
      // eslint-disable-next-line no-console
      if (error.message) console.error("Error message:", error.message);
      throw error;
    }
  }

  async function sellToken() {
    try {
      const decimals = await getTokenDecimals();
      // eslint-disable-next-line no-console
      console.log("Token decimals:", decimals);

      const currentBalance = await getTokenBalance(WALLET_ADDRESS);
      // eslint-disable-next-line no-console
      console.log("Current balance:", currentBalance.toString());

      // const amountToSell = await calculateSellAmount(
      //   currentBalance,
      //   SELL_PERCENTAGE
      // );

      const amountToSell = String(toSell * 10 ** decimals);

      // eslint-disable-next-line no-console
      console.log("Amount to sell:", amountToSell);

      if (new BigNumber(amountToSell).isZero()) {
        // eslint-disable-next-line no-console
        console.log("No tokens to sell. Exiting.");
        return;
      }

      await approveToken(UNISWAP_ROUTER_ADDRESS, amountToSell);

      const minOutput = await getMinOutputForSell(amountToSell);
      // eslint-disable-next-line no-console
      console.log("Minimum output:", minOutput);

      // eslint-disable-next-line no-console
      console.log("Executing sell...");
      const txnHash = await executeSell(amountToSell, minOutput);

      // eslint-disable-next-line no-console
      console.log("Token sell completed successfully");
      return txnHash;
    } catch (err) {
      const error = err as Error;
      // eslint-disable-next-line no-console
      console.error("Error in sellToken function:", error);
      // eslint-disable-next-line no-console
      if (error.message) console.error("Error message:", error.message);
    }
  }

  // Execute the script
  const txnHash = await sellToken();
  return txnHash;
}
