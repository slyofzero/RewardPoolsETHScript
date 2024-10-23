import { getDocument } from "@/firebase";
import { StoredPool } from "@/types";
import { log } from "@/utils/handlers";

export let pools: StoredPool[] = [];
export let activePools: StoredPool[] = [];

export async function syncPools() {
  pools = await getDocument<StoredPool>({
    collectionName: "pools",
  });

  activePools = pools.filter(({ status }) => status === "ACTIVE");

  log("Synced pools with database");
}
