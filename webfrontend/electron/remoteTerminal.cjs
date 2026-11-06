const { spawn, execSync } = require("child_process");
const { isUtf8 } = require("buffer");
const os = require("os");
const iconv = require("iconv-lite");

const DEFAULT_TIMEOUT_MS = 30000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 120000;
const MAX_COMMAND_LENGTH = 4096;
const MAX_OUTPUT_BYTES = 1024 * 1024;

// Mesma lista do terminalService da API: aqui o comando roda direto no PC.
const BLOCKED_PATTERNS = [
  /\brm\s+.*(-[a-zA-Z0-9]*r[a-zA-Z0-9]*f|-[a-zA-Z0-9]*f[a-zA-Z0-9]*r|-r\b.*-f\b|-f\b.*-r\b|--recursive|--force)/i,
  /\b(del|erase)\s+.*(\/f|\/s|\/q)/i,
  /\b(rmdir|rd)\s+.*(\/s|\/q)/i,
  /(?:^|[;&|]\s*)format(\.exe|\.com)?(\s+|$)/i,
  /(?:^|[;&|]\s*)mkfs(\.[a-z0-9]+)?(\s+|$)/i,
  /(?:^|[;&|]\s*)(shutdown|reboot|poweroff|halt)(\.exe)?(\s+|$)/i,
  /(?:^|[;&|]\s*)init\s+[06](\s+|$)/i,
  /:[(][)]\s*\{[^}]*:[|]:[^}]*\};?\s*:/,
  /:[(][)]\s*\{/,
  /%0\s*\|\s*%0/,
  /\b(\w+)\s*\(\)\s*\{\s*\1\s*\|\s*\1/i,
  /\bfork\s*bomb\b/i,
  /(?:^|[;&|]\s*)dd\s+.*(if=|of=)/i,
  /(?:^|[;&|]\s*)shred(\s+|$)/i,
  /(?:^|[;&|]\s*)wipefs(\s+|$)/i,
  /\bchmod\s+(-R\s+)?(777|000)\s+\//i,
  /\bchown\s+-R\s+.*\s+\//i,
];

// Devolve a mensagem de erro, ou null se o comando pode rodar.
function validateCommand(command) {
  if (typeof command !== "string" || !command.trim()) return "Comando não informado.";
  if (command.length > MAX_COMMAND_LENGTH) return "Comando longo demais.";
  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(command))) {
    return "Comando bloqueado por segurança: parece destrutivo.";
  }
  return null;
}

function clampTimeout(timeoutMs) {
  const parsed = Number(timeoutMs);
  if (!Number.isInteger(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(parsed, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}

let oemEncoding = null;

function getOemEncoding() {
  if (oemEncoding) return oemEncoding;
  try {
    const output = execSync(
      'reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Nls\\CodePage" /v OEMCP',
      { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
    );
    const page = output.match(/OEMCP\s+REG_SZ\s+(\d+)/)?.[1];
    oemEncoding = page && iconv.encodingExists(`cp${page}`) ? `cp${page}` : "cp850";
  } catch {
    oemEncoding = "cp850";
  }
  return oemEncoding;
}

// Mesmo com o chcp, programas como o ipconfig escrevem na página OEM do Windows
// quando a saída não é um console; o que não for UTF-8 válido vem dessa página.
function decodeOutput(buffer) {
  // A saída cortada no limite pode terminar no meio de um caractere.
  const sample = buffer.length >= MAX_OUTPUT_BYTES ? buffer.subarray(0, -4) : buffer;
  if (process.platform !== "win32" || isUtf8(sample)) return buffer.toString("utf8");
  return iconv.decode(buffer, getOemEncoding());
}

function killTree(child) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    child.kill();
  }
}

function runCommand(command, timeoutMs) {
  const isWindows = process.platform === "win32";
  const timeout = clampTimeout(timeoutMs);
  // Sem o chcp, o cmd devolve os acentos em CP850 e eles chegam quebrados.
  const line = isWindows ? `chcp 65001 >nul & ${command.trim()}` : command.trim();

  return new Promise((resolve) => {
    const startTime = Date.now();
    const chunks = { stdout: [], stderr: [] };
    const received = { stdout: 0, stderr: 0 };
    let timedOut = false;

    const finish = (exitCode, extraError) => {
      clearTimeout(timer);
      const stderr = [decodeOutput(Buffer.concat(chunks.stderr)), extraError].filter(Boolean).join("\n");
      resolve({
        stdout: decodeOutput(Buffer.concat(chunks.stdout)),
        stderr,
        exit_code: exitCode,
        execution_time_ms: Date.now() - startTime,
      });
    };

    const child = spawn(line, {
      shell: isWindows ? process.env.ComSpec || "cmd.exe" : "/bin/sh",
      cwd: os.homedir(),
      windowsHide: true,
      // Sem entrada: um comando que pede resposta termina em vez de travar.
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeout);

    for (const stream of ["stdout", "stderr"]) {
      child[stream].on("data", (chunk) => {
        const remaining = MAX_OUTPUT_BYTES - received[stream];
        if (remaining > 0) chunks[stream].push(chunk.subarray(0, remaining));
        received[stream] += chunk.length;
      });
    }

    child.on("error", (error) => finish(1, error.message));
    child.on("close", (code) => {
      if (timedOut) finish(124, `Comando encerrado após ${timeout}ms.`);
      else finish(code ?? 1);
    });
  });
}

module.exports = { validateCommand, runCommand };
