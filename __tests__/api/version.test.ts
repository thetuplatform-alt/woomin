import { readFileSync } from "node:fs";

jest.mock("node:fs", () => ({
  readFileSync: jest.fn(),
}));

const mockedReadFileSync = readFileSync as jest.Mock;

describe("GET /api/version", () => {
  afterEach(() => {
    mockedReadFileSync.mockReset();
  });

  it("讀得到 GIT_COMMIT_SHA 檔案時,回應包含正確的 commit 值", async () => {
    mockedReadFileSync.mockReturnValue("f04bdb8abc123\n");
    const { GET } = await import("@/app/api/version/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.commit).toBe("f04bdb8abc123");
  });

  it("讀不到 GIT_COMMIT_SHA 檔案時(如本機 pnpm dev),回應包含預設值且狀態仍是 200", async () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });
    const { GET } = await import("@/app/api/version/route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.commit).toBe("unknown");
  });
});
