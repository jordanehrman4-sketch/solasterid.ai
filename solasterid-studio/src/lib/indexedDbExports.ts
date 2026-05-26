import { openDB } from "idb";
import type { SolasteridState } from "./solasteridState";

export type SavedSolasteridExport = {
  id: string;
  createdAt: string;
  name: string;
  round: number;
  version: number;
  armCount: number;
  committeeCount: number;
  seedPreview: string;
  stateJson: SolasteridState;
  zipBlob: Blob;
};

const DB_NAME = "solasterid-studio";
const STORE_NAME = "exports";

async function getExportsDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  });
}

export async function saveExportRecord(record: SavedSolasteridExport) {
  const db = await getExportsDb();
  await db.put(STORE_NAME, record);
}

export async function listExportRecords(): Promise<SavedSolasteridExport[]> {
  const db = await getExportsDb();
  const records = await db.getAll(STORE_NAME);
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteExportRecord(id: string) {
  const db = await getExportsDb();
  await db.delete(STORE_NAME, id);
}
