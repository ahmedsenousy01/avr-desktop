import { ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { app } from "electron";

const getCounterFilePath = (): string => {
  return path.join(app.getAppPath(), "counter.txt");
};

const readCounterFromDisk = async (): Promise<number> => {
  try {
    const filePath = getCounterFilePath();
    const data = await fs.readFile(filePath, "utf-8");
    const value = parseInt(data.trim(), 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const writeCounterToDisk = async (value: number): Promise<void> => {
  const filePath = getCounterFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, String(value), "utf-8");
};

export const registerIpcHandlers = (): void => {
  ipcMain.handle("counter:read", async () => {
    const value = await readCounterFromDisk();
    return value;
  });

  ipcMain.handle("counter:increment", async () => {
    const current = await readCounterFromDisk();
    const next = current + 1;
    await writeCounterToDisk(next);
    return next;
  });
};
