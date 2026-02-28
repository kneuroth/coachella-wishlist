const request = require("supertest");

const mockSend = jest.fn();

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn(),
}));

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockSend })) },
  GetCommand: jest.fn((p) => p),
  PutCommand: jest.fn((p) => p),
  DeleteCommand: jest.fn((p) => p),
  QueryCommand: jest.fn((p) => p),
  ScanCommand: jest.fn((p) => p),
  BatchWriteCommand: jest.fn((p) => p),
}));

const { app } = require("./handler");

beforeEach(() => {
  mockSend.mockReset();
});

describe("POST /users", () => {
  it("auto-generates a UUID and returns the new user", async () => {
    mockSend.mockResolvedValue({});

    const res = await request(app).post("/users").send({ name: "Alice" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Alice");
    expect(res.body.userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("returns 400 if name is missing", async () => {
    const res = await request(app).post("/users").send({});
    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("PUT /wishlists/:userId/:artistId", () => {
  it("returns 400 for an invalid ranking without hitting DynamoDB", async () => {
    const res = await request(app)
      .put("/wishlists/user-1/beyonce-2025")
      .send({ ranking: "obsessed" });

    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe("GET /wishlists", () => {
  it("returns all entries grouped by userId", async () => {
    mockSend.mockResolvedValue({
      Items: [
        { userId: "user-1", artistId: "beyonce-2025", ranking: "must_see", updatedAt: "2025-01-01T00:00:00.000Z" },
        { userId: "user-2", artistId: "beyonce-2025", ranking: "would_skip", updatedAt: "2025-01-01T00:00:00.000Z" },
        { userId: "user-1", artistId: "tyler-2025", ranking: "would_like_to_see", updatedAt: "2025-01-01T00:00:00.000Z" },
      ],
    });

    const res = await request(app).get("/wishlists");

    expect(res.status).toBe(200);
    expect(res.body["user-1"]).toHaveLength(2);
    expect(res.body["user-2"]).toHaveLength(1);
  });
});
