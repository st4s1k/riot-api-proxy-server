/*eslint no-undef: "error"*/
/*eslint-env node*/

import { spawn } from "child_process";
import { createWriteStream, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const currentDate = new Date();
const timestamp = `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1
).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}_${String(
    currentDate.getHours()
).padStart(2, "0")}-${String(currentDate.getMinutes()).padStart(2,"0")}-${String(
    currentDate.getSeconds()
).padStart(2, "0")}`;
const logDirectory = join(__dirname, "logs");
const logFilename = join(logDirectory, `${timestamp}.log`);

if (!existsSync(logDirectory)) {
    mkdirSync(logDirectory);
}

const outputFile = createWriteStream(logFilename);
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const testProcess = spawn(npmExecutable, ["run", "test"]);

testProcess.stdout.pipe(outputFile);
testProcess.stderr.pipe(outputFile);
