jest.mock("../db/connect", () => ({ promise: jest.fn() }));

const path = require("path");
const fs = require("fs");
const {
  app,
  auth,
  mockQueries,
  request,
  resetDatabaseMock,
} = require("./helpers/apiTest");

beforeEach(resetDatabaseMock);

describe("FileController", () => {
  const sampleFile = {
    id_file: 1,
    name: "test.txt",
    path: path.resolve(__dirname, "../../uploads/test.txt"),
    extension: "txt",
    size: 1024,
    hash: "abc123hash",
    type: "text/plain",
  };

  it("rejects upload when no file is attached", async () => {
    const res = await request(app)
      .post("/api/osiris/file")
      .set(auth());

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe("Nenhum arquivo enviado.");
  });

  it("uploads a file successfully via /file", async () => {
    mockQueries([{ insertId: 1 }]);

    const tempFilePath = path.resolve(__dirname, "temp-test.txt");
    fs.writeFileSync(tempFilePath, "Hello Osiris");

    const res = await request(app)
      .post("/api/osiris/file")
      .set(auth())
      .attach("file", tempFilePath);

    fs.unlinkSync(tempFilePath);

    expect(res.status).toBe(201);
    expect(res.body.file.name).toBe("temp-test.txt");
    expect(res.body.file.id_file).toBe(1);
    expect(res.body.file.hash).toBeDefined();
  });

  it("lists all files", async () => {
    mockQueries([[sampleFile]]);

    const res = await request(app)
      .get("/api/osiris/file")
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].name).toBe("test.txt");
  });

  it("gets a file by id", async () => {
    mockQueries([[sampleFile]]);

    const res = await request(app)
      .get("/api/osiris/file/1")
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.file.id_file).toBe(1);
  });

  it("returns 404 for non-existent file", async () => {
    mockQueries([[]]);

    const res = await request(app)
      .get("/api/osiris/file/999")
      .set(auth());

    expect(res.status).toBe(404);
  });

  it("deletes a file", async () => {
    mockQueries([[sampleFile]], [{ affectedRows: 1 }]);

    const res = await request(app)
      .delete("/api/osiris/file/1")
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Arquivo excluído com sucesso.");
  });
});
