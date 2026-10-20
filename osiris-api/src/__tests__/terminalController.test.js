jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");
const TerminalService = require("../services/terminalService");

beforeEach(() => {
  resetDatabaseMock();
  TerminalService.clearAllHistory();
});

describe("TerminalController & Routes", () => {
  describe("Authentication & Authorization", () => {
    it("rejects unauthenticated requests with 401 Unauthorized", async () => {
      const endpoints = [
        { method: "post", url: "/api/osiris/terminal/exec", body: { command: "echo test" } },
        { method: "post", url: "/api/exec", body: { command: "echo test" } },
        { method: "get", url: "/api/osiris/terminal/history" },
        { method: "delete", url: "/api/osiris/terminal/history" },
      ];

      for (const endpoint of endpoints) {
        const res = await request(app)[endpoint.method](endpoint.url).send(endpoint.body || {});
        expect(res.status).toBe(401);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.message).toMatch(/token/i);
      }
    });

    it("rejects requests with an invalid Bearer token with 401", async () => {
      const res = await request(app)
        .post("/api/osiris/terminal/exec")
        .set({ Authorization: "Bearer invalid-token-string" })
        .send({ command: "node -v" });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("Input Validation (400 BadRequestError)", () => {
    it("rejects missing command with 400", async () => {
      const res = await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/required/i);
    });

    it("rejects non-string command with 400", async () => {
      const res = await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/string/i);
    });

    it("rejects empty or whitespace-only command with 400", async () => {
      const emptyRes = await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: "" });

      expect(emptyRes.status).toBe(400);
      expect(emptyRes.body.error.message).toMatch(/empty/i);

      const whitespaceRes = await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: "   \t\n " });

      expect(whitespaceRes.status).toBe(400);
      expect(whitespaceRes.body.error.message).toMatch(/empty/i);
    });

    it("rejects commands exceeding 4096 characters with 400", async () => {
      const longCommand = "a".repeat(4097);
      const res = await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: longCommand });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/4096/);
    });

    it("rejects invalid timeout_ms values with 400", async () => {
      const invalidTimeouts = [500, 150000, "not-a-number", 12.34];

      for (const timeout of invalidTimeouts) {
        const res = await request(app)
          .post("/api/osiris/terminal/exec")
          .set(auth(1))
          .send({ command: "echo valid", timeout_ms: timeout });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toMatch(/timeout/i);
      }
    });
  });

  describe("Security: Blocked Destructive Commands (403 ForbiddenError)", () => {
    const dangerousCommands = [
      "rm -rf /",
      "rm -r -f /var/log",
      "rm -fr /home/user",
      "rm --recursive --force /tmp",
      "del /f /s /q C:\\*",
      "del /s /q C:\\Users\\Default",
      "rmdir /s /q C:\\Windows\\System32",
      "rd /s /q C:\\Data",
      "format C:",
      "format /fs:ntfs D:",
      "shutdown /s /t 0",
      "shutdown -h now",
      "reboot",
      "poweroff",
      "init 0",
      "init 6",
      ":(){ :|:& };:",
      "%0|%0",
      "dd if=/dev/zero of=/dev/sda",
      "shred -u important.db",
      "mkfs.ext4 /dev/sdb1",
    ];

    dangerousCommands.forEach((cmd) => {
      it(`blocks dangerous command: "${cmd}" with 403 Forbidden`, async () => {
        const res = await request(app)
          .post("/api/osiris/terminal/exec")
          .set(auth(1))
          .send({ command: cmd });

        expect(res.status).toBe(403);
        expect(res.body.error).toBeDefined();
        expect(res.body.error.message).toMatch(/blocked/i);
      });
    });
  });

  describe("Command Execution", () => {
    it("executes simple commands successfully with stdout and exit_code 0", async () => {
      const res = await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: "node -e \"console.log('osiris-terminal-success')\"" });

      expect(res.status).toBe(200);
      expect(res.body.stdout).toContain("osiris-terminal-success");
      expect(res.body.exit_code).toBe(0);
      expect(typeof res.body.execution_time_ms).toBe("number");
      expect(res.body.execution_time_ms).toBeGreaterThanOrEqual(0);
      expect(res.body.stderr).toBe("");
    });

    it("executes commands returning stderr and exit_code != 0", async () => {
      const res = await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: "node -e \"console.error('custom-error-output'); process.exit(7)\"" });

      expect(res.status).toBe(200);
      expect(res.body.stderr).toContain("custom-error-output");
      expect(res.body.exit_code).toBe(7);
      expect(typeof res.body.execution_time_ms).toBe("number");
      expect(res.body.execution_time_ms).toBeGreaterThanOrEqual(0);
    });

    it("terminates command on timeout with exit_code 124", async () => {
      const res = await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({
          command: "node -e \"setTimeout(() => {}, 5000)\"",
          timeout_ms: 1000,
        });

      expect(res.status).toBe(200);
      expect(res.body.exit_code).toBe(124);
      expect(res.body.execution_time_ms).toBeGreaterThanOrEqual(950);
      expect(res.body.stderr).toContain("timed out");
    }, 15000);
  });

  describe("Routing Aliases", () => {
    it("executes command via canonical /api/osiris/terminal/exec route", async () => {
      const res = await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: "node -e \"console.log('via-canonical-exec')\"" });

      expect(res.status).toBe(200);
      expect(res.body.stdout).toContain("via-canonical-exec");
      expect(res.body.exit_code).toBe(0);
    });

    it("executes command via direct mobile alias /api/exec", async () => {
      const res = await request(app)
        .post("/api/exec")
        .set(auth(1))
        .send({ command: "node -e \"console.log('via-mobile-direct-exec')\"" });

      expect(res.status).toBe(200);
      expect(res.body.stdout).toContain("via-mobile-direct-exec");
      expect(res.body.exit_code).toBe(0);
    });
  });

  describe("Terminal History Management", () => {
    it("records command execution in history and retrieves it", async () => {
      await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: "node -e \"console.log('entry-1')\"" });

      const historyRes = await request(app)
        .get("/api/osiris/terminal/history")
        .set(auth(1));

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.total).toBe(1);
      expect(historyRes.body.limit).toBe(50);
      expect(historyRes.body.offset).toBe(0);
      expect(historyRes.body.history).toHaveLength(1);

      const entry = historyRes.body.history[0];
      expect(entry.id).toBeDefined();
      expect(entry.command).toBe("node -e \"console.log('entry-1')\"");
      expect(entry.stdout).toContain("entry-1");
      expect(entry.exit_code).toBe(0);
      expect(entry.created_at).toBeDefined();
    });

    it("supports pagination with limit and offset query parameters", async () => {
      // Execute 3 distinct commands
      await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: "node -e \"console.log('cmd-1')\"" });

      await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: "node -e \"console.log('cmd-2')\"" });

      await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: "node -e \"console.log('cmd-3')\"" });

      // Page 1: limit 2, offset 0
      const page1Res = await request(app)
        .get("/api/osiris/terminal/history?limit=2&offset=0")
        .set(auth(1));

      expect(page1Res.status).toBe(200);
      expect(page1Res.body.total).toBe(3);
      expect(page1Res.body.limit).toBe(2);
      expect(page1Res.body.offset).toBe(0);
      expect(page1Res.body.history).toHaveLength(2);
      // Newest command first
      expect(page1Res.body.history[0].command).toContain("cmd-3");
      expect(page1Res.body.history[1].command).toContain("cmd-2");

      // Page 2: limit 2, offset 2
      const page2Res = await request(app)
        .get("/api/osiris/terminal/history?limit=2&offset=2")
        .set(auth(1));

      expect(page2Res.status).toBe(200);
      expect(page2Res.body.total).toBe(3);
      expect(page2Res.body.limit).toBe(2);
      expect(page2Res.body.offset).toBe(2);
      expect(page2Res.body.history).toHaveLength(1);
      expect(page2Res.body.history[0].command).toContain("cmd-1");
    });

    it("isolates history between different authenticated users", async () => {
      // User 1 executes a command
      await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: "node -e \"console.log('user-1-data')\"" });

      // User 2 queries history -> empty
      const user2HistoryBefore = await request(app)
        .get("/api/osiris/terminal/history")
        .set(auth(2));

      expect(user2HistoryBefore.status).toBe(200);
      expect(user2HistoryBefore.body.total).toBe(0);
      expect(user2HistoryBefore.body.history).toHaveLength(0);

      // User 2 executes a command
      await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(2))
        .send({ command: "node -e \"console.log('user-2-data')\"" });

      // User 1 still has only user 1's command
      const user1History = await request(app)
        .get("/api/osiris/terminal/history")
        .set(auth(1));

      expect(user1History.body.total).toBe(1);
      expect(user1History.body.history[0].command).toContain("user-1-data");

      // User 2 has only user 2's command
      const user2HistoryAfter = await request(app)
        .get("/api/osiris/terminal/history")
        .set(auth(2));

      expect(user2HistoryAfter.body.total).toBe(1);
      expect(user2HistoryAfter.body.history[0].command).toContain("user-2-data");
    });

    it("clears user history without affecting other users", async () => {
      // Both users execute a command
      await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(1))
        .send({ command: "node -e \"console.log('user-1')\"" });

      await request(app)
        .post("/api/osiris/terminal/exec")
        .set(auth(2))
        .send({ command: "node -e \"console.log('user-2')\"" });

      // User 1 clears history
      const clearRes = await request(app)
        .delete("/api/osiris/terminal/history")
        .set(auth(1));

      expect(clearRes.status).toBe(200);
      expect(clearRes.body.message).toMatch(/cleared/i);
      expect(clearRes.body.cleared_count).toBe(1);

      // User 1 has 0 entries now
      const user1History = await request(app)
        .get("/api/osiris/terminal/history")
        .set(auth(1));
      expect(user1History.body.total).toBe(0);
      expect(user1History.body.history).toHaveLength(0);

      // User 2's history is unaffected
      const user2History = await request(app)
        .get("/api/osiris/terminal/history")
        .set(auth(2));
      expect(user2History.body.total).toBe(1);
      expect(user2History.body.history).toHaveLength(1);
    });

    it("enforces memory leak protection: max 50 entries per user and Map user limits", () => {
      // Direct unit check on TerminalService capacity
      const userId = 99;

      // Add 60 entries
      for (let i = 1; i <= 60; i++) {
        TerminalService.recordHistory(userId, `cmd-${i}`, {
          stdout: `out-${i}`,
          stderr: "",
          exit_code: 0,
          execution_time_ms: 10,
        });
      }

      const history = TerminalService.getHistory(userId, { limit: 100 });
      expect(history.total).toBe(50);
      expect(history.history).toHaveLength(50);
      // Newest entry is cmd-60
      expect(history.history[0].command).toBe("cmd-60");
      // Oldest kept entry is cmd-11
      expect(history.history[49].command).toBe("cmd-11");
    });
  });
});
