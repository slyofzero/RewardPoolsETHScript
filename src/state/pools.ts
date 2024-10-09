import { getDocument } from "@/firebase";
import { StoredPool } from "@/types";
import { log } from "@/utils/handlers";

export let pools: StoredPool[] = [];

export async function syncPools() {
  pools = await getDocument<StoredPool>({
    collectionName: "pools",
    queries: [["status", "==", "ACTIVE"]],
  });

  log("Synced pools with database");
}
