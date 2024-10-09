import { ethers } from "ethers";
import { RPC_URL } from "./utils/env";

export const provider = new ethers.JsonRpcProvider(RPC_URL);
