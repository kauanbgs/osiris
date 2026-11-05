jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const {
  app,
  auth,
  mockQueries,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");

beforeEach(resetDatabaseMock);

const colors = {
  background: "#141414",
  card: "#211e27",
  input: "#2d2932",
  border: "#413b49",
  foreground: "#e7e0ed",
  mutedForeground: "#cbc3d7",
  primary: "#ef4444",
  secondary: "#10b981",
  destructive: "#ff6b6b",
  accent: "#2a2531",
  accentForeground: "#d0bcff",
};

describe("ThemeController", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/api/osiris/theme");
    expect(response.status).toBe(401);
  });

  it("returns null when the user never saved a theme", async () => {
    mockQueries([[]]);

    const response = await request(app).get("/api/osiris/theme").set(auth());

    expect(response.status).toBe(200);
    expect(response.body.colors).toBeNull();
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("returns the colors saved for the authenticated user", async () => {
    const execute = mockQueries([[{ id_configuration: 3, value: JSON.stringify(colors) }]]);

    const response = await request(app).get("/api/osiris/theme").set(auth(7));

    expect(response.body.colors).toEqual(colors);
    expect(execute.mock.calls[0][1]).toEqual(["7", "desktop_theme_colors"]);
  });

  it("treats corrupted stored data as no theme", async () => {
    mockQueries([[{ id_configuration: 3, value: "{broken" }]]);

    const response = await request(app).get("/api/osiris/theme").set(auth());

    expect(response.status).toBe(200);
    expect(response.body.colors).toBeNull();
  });

  it("creates the theme on the first save", async () => {
    const execute = mockQueries([[]], [{ insertId: 1 }]);

    const response = await request(app)
      .put("/api/osiris/theme")
      .set(auth(7))
      .send({ colors: { ...colors, primary: "#EF4444", ignored: "#000000" } });

    expect(response.status).toBe(200);
    expect(response.body.colors).toEqual(colors);
    expect(execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("INSERT INTO configuration"),
      ["7", "desktop_theme_colors", JSON.stringify(colors)],
    );
  });

  it("updates the existing theme on later saves", async () => {
    const execute = mockQueries([[{ id_configuration: 3, value: "{}" }]], [{ affectedRows: 1 }]);

    const response = await request(app).put("/api/osiris/theme").set(auth(7)).send({ colors });

    expect(response.status).toBe(200);
    expect(execute).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("UPDATE configuration"),
      [JSON.stringify(colors), 3, "7"],
    );
  });

  it.each([
    ["missing colors", {}],
    ["a missing color", { colors: { ...colors, primary: undefined } }],
    ["an invalid color", { colors: { ...colors, primary: "red; drop" } }],
  ])("rejects %s", async (_label, body) => {
    const response = await request(app).put("/api/osiris/theme").set(auth()).send(body);
    expect(response.status).toBe(400);
  });
});
