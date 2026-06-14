import fs from "node:fs";
import path from "node:path";

const lock = path.join(process.cwd(), ".next", "lock");
if (fs.existsSync(lock)) {
  fs.unlinkSync(lock);
}
