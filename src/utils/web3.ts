import { ethers } from "ethers";
import { erc20Abi, gasLimit } from "./constants";
import { provider } from "@/rpc";
import { errorHandler } from "./handlers";
import { decrypt } from "./cryptography";

export async function getTokenBalance(
  address: string,
  token: string
): Promise<number> {
  try {
    const contract = new ethers.Contract(token, erc20Abi, provider);
    const balance = await contract.balanceOf(address);
    const decimals = await contract.decimals();

    const tokenBalance = parseFloat(ethers.formatUnits(balance, decimals));

    return tokenBalance;
  } catch (error) {
    errorHandler(error);
    return 0;
  }
}

export async function getEthBalance(address: string): Promise<number> {
  try {
    const weiBalance = await provider.getBalance(address);
    const ethBalance = parseFloat(ethers.formatEther(weiBalance));
    return Math.round(ethBalance * 1e6) / 1e6; // Round to six decimal places
  } catch (error) {
    errorHandler(error);
    return 0;
  }
}

export async function transferTokens(
  mnemonicPhrase: string,
  recipient: string,
  tokenAddress: string,
  amount: number // amount to transfer, as a string
) {
  try {
    const phrase = decrypt(mnemonicPhrase);
    const wallet = ethers.Wallet.fromPhrase(phrase).connect(provider);

    // Create a contract instance for the ERC20 token
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);

    // Get the decimals of the token to correctly format the transfer amount
    const decimals = await tokenContract.decimals();
    const parsedAmount = ethers.parseUnits(String(amount), decimals); // Convert amount to the correct unit

    // Execute the token transfer
    const tx = await tokenContract.transfer(recipient, parsedAmount);

    // Wait for the transaction to be confirmed
    await tx.wait();
    return tx.hash as string; // Return the transaction hash
  } catch (error) {
    errorHandler(error);
    return null; // Return null in case of error
  }
}

export async function transferEth(
  mnemonicPhrase: string,
  amount: number, // Amount in Ether
  to: string // Recipient address
) {
  try {
    const phrase = decrypt(mnemonicPhrase);
    const wallet = ethers.Wallet.fromPhrase(phrase).connect(provider);
    const gasPrice = (await provider.getFeeData()).gasPrice || 0n;

    const gas = gasPrice * gasLimit;
    // Calculate value to send after gas is deducted
    const valueAfterGas = ethers.parseEther(String(amount)) - gas;

    // Send the transaction
    const tx = await wallet.sendTransaction({
      to,
      value: valueAfterGas, // Value in wei (after gas adjustment)
      gasPrice,
      gasLimit,
    });

    // Wait for the transaction to be confirmed
    await tx.wait();
    return tx;
  } catch (error) {
    errorHandler(error);
    throw error;
  }
}
