const {
  validateAgent,
  validateExecutionInput,
  validateRegistration,
  validateLogin,
  EMAIL_PATTERN,
} = require("../validators");

describe("Validators Suite", () => {
  describe("validateAgent", () => {
    it("validates valid creation payload", () => {
      const error = validateAgent({
        name: "Research Agent",
        objective: "Analyze financial papers",
        system_prompt: "You are an expert financial analyst.",
      });
      expect(error).toBeNull();
    });

    it("rejects missing required fields on creation", () => {
      expect(validateAgent({})).toContain("Agent name is required.");
      expect(validateAgent({ name: "Valid Name" })).toContain("Agent objective is required.");
      expect(validateAgent({ name: "Valid Name", objective: "Valid Objective" })).toContain("Agent system prompt is required.");
    });

    it("rejects names that are too short or too long", () => {
      expect(validateAgent({ name: "A", objective: "Valid", system_prompt: "Valid" })).toContain("at least 2 characters");
      expect(validateAgent({ name: "A".repeat(256), objective: "Valid", system_prompt: "Valid" })).toContain("exceed 255 characters");
    });

    it("validates update payload allowing partial fields", () => {
      expect(validateAgent({ name: "Updated Name" }, true)).toBeNull();
      expect(validateAgent({ objective: "New objective description" }, true)).toBeNull();
      expect(validateAgent({}, true)).toBeNull();
    });

    it("rejects invalid partial field on update", () => {
      expect(validateAgent({ name: " " }, true)).toContain("valid non-empty string");
      expect(validateAgent({ objective: "ab" }, true)).toContain("at least 3 characters");
    });
  });

  describe("validateExecutionInput", () => {
    it("accepts valid input", () => {
      expect(validateExecutionInput("Calculate metrics")).toBeNull();
    });

    it("rejects empty or whitespace input", () => {
      expect(validateExecutionInput("")).toContain("Input is required to execute agent.");
      expect(validateExecutionInput("   ")).toContain("Input is required to execute agent.");
      expect(validateExecutionInput(null)).toContain("Input is required to execute agent.");
    });

    it("rejects input exceeding 10000 characters", () => {
      expect(validateExecutionInput("a".repeat(10001))).toContain("must not exceed 10000 characters");
    });
  });

  describe("validateRegistration & validateLogin", () => {
    it("validates correct registration", () => {
      expect(
        validateRegistration({
          name: "Gabriel",
          email: "gabriel@example.com",
          password: "password123",
        }),
      ).toBeNull();
    });

    it("rejects short password or invalid email", () => {
      expect(
        validateRegistration({
          name: "Gabriel",
          email: "invalid-email",
          password: "password123",
        }),
      ).toContain("Informe um e-mail válido");

      expect(
        validateRegistration({
          name: "Gabriel",
          email: "gabriel@example.com",
          password: "123",
        }),
      ).toContain("pelo menos 8 caracteres");
    });

    it("validates correct login", () => {
      expect(validateLogin({ email: "gabriel@example.com", password: "password123" })).toBeNull();
      expect(validateLogin({ email: "bad-email", password: "password123" })).toContain("Informe um e-mail válido");
    });

    it("checks email regex pattern", () => {
      expect(EMAIL_PATTERN.test("user@domain.com")).toBe(true);
      expect(EMAIL_PATTERN.test("user@domain")).toBe(false);
      expect(EMAIL_PATTERN.test("plainaddress")).toBe(false);
    });
  });
});
