import { exec } from "child_process";
import fs from "fs";
import path from "path";

const BACKUP_DIR = path.join(process.cwd(), "backups");
const RETENTION_DAYS = 30;

function libpqConnectionString(databaseUrl: string): string {
  // Prisma appends query params (e.g. ?schema=public) that pg_dump/libpq don't understand.
  const url = new URL(databaseUrl);
  url.search = "";
  return url.toString();
}

export function runDatabaseBackup(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.env.DATABASE_URL) {
      return reject(new Error("DATABASE_URL is not set"));
    }
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outFile = path.join(BACKUP_DIR, `mrgrain-${timestamp}.sql.gz`);
    const connectionString = libpqConnectionString(process.env.DATABASE_URL);

    exec(`pg_dump "${connectionString}" | gzip > "${outFile}"`, (error) => {
      if (error) return reject(error);
      pruneOldBackups();
      resolve(outFile);
    });
  });
}

function pruneOldBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(BACKUP_DIR)) {
    const fullPath = path.join(BACKUP_DIR, file);
    if (fs.statSync(fullPath).mtimeMs < cutoff) {
      fs.unlinkSync(fullPath);
    }
  }
}
