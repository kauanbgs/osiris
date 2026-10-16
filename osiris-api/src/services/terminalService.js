const { spawn, execSync } = require("child_process");
const crypto = require("crypto");
const { BadRequestError, ForbiddenError } = require("../errors");

class TerminalService {
  static userHistories = new Map();
  static MAX_USERS = 1000;
  static MAX_HISTORY_PER_USER = 50;
  static DEFAULT_TIMEOUT_MS = 30000;
  static MIN_TIMEOUT_MS = 1000;
  static MAX_TIMEOUT_MS = 120000;
  static MAX_COMMAND_LENGTH = 4096;
  static MAX_OUTPUT_BYTES = 1024 * 1024; // 1 MB

  static BLOCKED_PATTERNS = [
    // Unix recursive / forced removal
    /\brm\s+.*(-[a-zA-Z0-9]*r[a-zA-Z0-9]*f|-[a-zA-Z0-9]*f[a-zA-Z0-9]*r|-r\b.*-f\b|-f\b.*-r\b|--recursive|--force)/i,
    // Windows forced / quiet deletion
    /\b(del|erase)\s+.*(\/f|\/s|\/q)/i,
    // Windows directory removal
    /\b(rmdir|rd)\s+.*(\/s|\/q)/i,
    // Disk formatting & filesystem creation
    /(?:^|[;&|]\s*)format(\.exe|\.com)?(\s+|$)/i,
    /(?:^|[;&|]\s*)mkfs(\.[a-z0-9]+)?(\s+|$)/i,
    // Shutdown / reboot / poweroff
    /(?:^|[;&|]\s*)(shutdown|reboot|poweroff|halt)(\.exe)?(\s+|$)/i,
    /(?:^|[;&|]\s*)init\s+[06](\s+|$)/i,
    // Fork bombs (Bash / Windows batch)
    /:[(][)]\s*\{[^}]*:[|]:[^}]*\};?\s*:/,
    /:[(][)]\s*\{/,
    /%0\s*\|\s*%0/,
    /\b(\w+)\s*\(\)\s*\{\s*\1\s*\|\s*\1/i,
    /\bfork\s*bomb\b/i,
    // Direct device overwrite / disk wiping
    /(?:^|[;&|]\s*)dd\s+.*(if=|of=)/i,
    /(?:^|[;&|]\s*)shred(\s+|$)/i,
    /(?:^|[;&|]\s*)wipefs(\s+|$)/i,
    // Dangerous root-level permissions alterations
    /\bchmod\s+(-R\s+)?(777|000)\s+\//i,
    /\bchown\s+-R\s+.*\s+\//i,
  ];

  static normalizeUserId(userId) {
    if (userId === undefined || userId === null) {
      return "anonymous";
    }
    const num = Number(userId);
    return !isNaN(num) ? num : String(userId);
  }

  static validateCommand(command, timeoutMs) {
    if (command === undefined || command === null || typeof command !== "string") {
      throw new BadRequestError("Command is required and must be a string.");
    }

    const trimmed = command.trim();
    if (!trimmed) {
      throw new BadRequestError("Command cannot be empty.");
    }

    if (trimmed.length > this.MAX_COMMAND_LENGTH) {
      throw new BadRequestError(
        `Command exceeds maximum allowed length of ${this.MAX_COMMAND_LENGTH} characters.`
      );
    }

    let validatedTimeout = this.DEFAULT_TIMEOUT_MS;
    if (timeoutMs !== undefined && timeoutMs !== null) {
      const parsedTimeout = Number(timeoutMs);
      if (
        !Number.isInteger(parsedTimeout) ||
        parsedTimeout < this.MIN_TIMEOUT_MS ||
        parsedTimeout > this.MAX_TIMEOUT_MS
      ) {
        throw new BadRequestError(
          `Timeout must be an integer between ${this.MIN_TIMEOUT_MS} and ${this.MAX_TIMEOUT_MS} milliseconds.`
        );
      }
      validatedTimeout = parsedTimeout;
    }

    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(trimmed)) {
        throw new ForbiddenError(
          "Command execution blocked for security reasons: destructive command detected."
        );
      }
    }

    return {
      command: trimmed,
      timeoutMs: validatedTimeout,
    };
  }

  static recordHistory(userId, command, result) {
    const normalizedUserId = this.normalizeUserId(userId);

    if (!this.userHistories.has(normalizedUserId)) {
      if (this.userHistories.size >= this.MAX_USERS) {
        const oldestUser = this.userHistories.keys().next().value;
        if (oldestUser !== undefined) {
          this.userHistories.delete(oldestUser);
        }
      }
      this.userHistories.set(normalizedUserId, []);
    }

    const history = this.userHistories.get(normalizedUserId);
    const entry = {
      id: crypto.randomUUID(),
      command,
      stdout: result.stdout,
      stderr: result.stderr,
      exit_code: result.exit_code,
      execution_time_ms: result.execution_time_ms,
      created_at: new Date().toISOString(),
    };

    history.unshift(entry);
    if (history.length > this.MAX_HISTORY_PER_USER) {
      history.pop();
    }

    return entry;
  }

  static async executeCommand(command, { userId, timeoutMs, cwd } = {}) {
    const { command: validCmd, timeoutMs: validTimeout } = this.validateCommand(
      command,
      timeoutMs
    );
    const normalizedUserId = this.normalizeUserId(userId);
    const startTime = Date.now();

    return new Promise((resolve) => {
      const isWindows = process.platform === "win32";
      const shell = isWindows ? process.env.ComSpec || "cmd.exe" : "/bin/sh";

      let stdout = "";
      let stderr = "";
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let timedOut = false;
      let finished = false;
      let timer = null;

      let child;
      try {
        child = spawn(validCmd, {
          shell,
          cwd: cwd || process.cwd(),
          windowsHide: true,
          env: process.env,
        });
      } catch (spawnError) {
        const executionTimeMs = Date.now() - startTime;
        const result = {
          stdout: "",
          stderr: spawnError.message || "Failed to spawn process.",
          exit_code: 1,
          execution_time_ms: executionTimeMs,
        };
        this.recordHistory(normalizedUserId, validCmd, result);
        return resolve(result);
      }

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };

      timer = setTimeout(() => {
        if (finished) return;
        timedOut = true;
        try {
          if (isWindows && child.pid) {
            try {
              execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
            } catch {
              child.kill();
            }
          } else if (child.pid) {
            child.kill("SIGTERM");
            setTimeout(() => {
              if (!finished && child.pid) {
                try {
                  child.kill("SIGKILL");
                } catch {}
              }
            }, 200);
          }
        } catch {}
      }, validTimeout);

      if (child.stdout) {
        child.stdout.on("data", (chunk) => {
          if (stdoutBytes < this.MAX_OUTPUT_BYTES) {
            const remaining = this.MAX_OUTPUT_BYTES - stdoutBytes;
            const slice = chunk.slice(0, remaining);
            stdout += slice.toString("utf8");
            stdoutBytes += chunk.length;
          }
        });
      }

      if (child.stderr) {
        child.stderr.on("data", (chunk) => {
          if (stderrBytes < this.MAX_OUTPUT_BYTES) {
            const remaining = this.MAX_OUTPUT_BYTES - stderrBytes;
            const slice = chunk.slice(0, remaining);
            stderr += slice.toString("utf8");
            stderrBytes += chunk.length;
          }
        });
      }

      child.on("error", (err) => {
        if (finished) return;
        finished = true;
        cleanup();
        const executionTimeMs = Date.now() - startTime;
        const result = {
          stdout,
          stderr: stderr ? `${stderr}\n${err.message}` : err.message,
          exit_code: timedOut ? 124 : 1,
          execution_time_ms: executionTimeMs,
        };
        this.recordHistory(normalizedUserId, validCmd, result);
        resolve(result);
      });

      child.on("close", (code, signal) => {
        if (finished) return;
        finished = true;
        cleanup();
        const executionTimeMs = Date.now() - startTime;
        const exitCode = timedOut ? 124 : code !== null ? code : signal ? 1 : 0;
        if (timedOut && !stderr.includes("timed out")) {
          stderr = stderr
            ? `${stderr}\nCommand timed out after ${validTimeout}ms.`
            : `Command timed out after ${validTimeout}ms.`;
        }
        const result = {
          stdout,
          stderr,
          exit_code: exitCode,
          execution_time_ms: executionTimeMs,
        };
        this.recordHistory(normalizedUserId, validCmd, result);
        resolve(result);
      });
    });
  }

  static getHistory(userId, { limit = 50, offset = 0 } = {}) {
    const normalizedUserId = this.normalizeUserId(userId);
    const history = this.userHistories.get(normalizedUserId) || [];
    const total = history.length;

    const parsedLimit = Math.max(1, parseInt(limit, 10) || 50);
    const parsedOffset = Math.max(0, parseInt(offset, 10) || 0);

    const paginated = history.slice(parsedOffset, parsedOffset + parsedLimit);

    return {
      total,
      limit: parsedLimit,
      offset: parsedOffset,
      history: paginated,
    };
  }

  static clearHistory(userId) {
    const normalizedUserId = this.normalizeUserId(userId);
    const history = this.userHistories.get(normalizedUserId) || [];
    const clearedCount = history.length;
    this.userHistories.delete(normalizedUserId);

    return {
      cleared_count: clearedCount,
    };
  }

  static clearAllHistory() {
    this.userHistories.clear();
  }
}

module.exports = TerminalService;
