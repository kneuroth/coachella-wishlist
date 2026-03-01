const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");

const cors = require("cors");
const express = require("express");
const serverless = require("serverless-http");

const app = express();

const USERS_TABLE = process.env.USERS_TABLE;
const WISHLIST_TABLE = process.env.WISHLIST_TABLE;
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

app.use(cors());
app.use(express.json());

app.get("/users/:userId", async (req, res) => {
  const params = {
    TableName: USERS_TABLE,
    Key: {
      userId: req.params.userId,
    },
  };

  try {
    const command = new GetCommand(params);
    const { Item } = await docClient.send(command);
    if (Item) {
      const { userId, name } = Item;
      res.json({ userId, name });
    } else {
      res
        .status(404)
        .json({ error: 'Could not find user with provided "userId"' });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Could not retrieve user" });
  }
});

app.post("/users", async (req, res) => {
  const { name } = req.body;
  if (typeof name !== "string") {
    return res.status(400).json({ error: '"name" must be a string' });
  }
  const userId = crypto.randomUUID();

  const params = {
    TableName: USERS_TABLE,
    Item: { userId, name },
  };

  try {
    const command = new PutCommand(params);
    await docClient.send(command);
    res.json({ userId, name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create user" });
  }
});

const VALID_RANKINGS = ["must_see", "would_like_to_see", "would_skip"];

// DELETE /wishlists — clear all wishlist data (preserves coachella-2026-seed)
app.delete("/wishlists", async (req, res) => {
  try {
    const { Items } = await docClient.send(new ScanCommand({
      TableName: WISHLIST_TABLE,
      ProjectionExpression: "userId, artistId",
      FilterExpression: "#uid <> :seed",
      ExpressionAttributeNames: { "#uid": "userId" },
      ExpressionAttributeValues: { ":seed": "coachella-2026-seed" },
    }));
    if (!Items || Items.length === 0) return res.status(204).send();

    for (let i = 0; i < Items.length; i += 25) {
      const chunk = Items.slice(i, i + 25);
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [WISHLIST_TABLE]: chunk.map(({ userId, artistId }) => ({
            DeleteRequest: { Key: { userId, artistId } },
          })),
        },
      }));
    }
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not clear wishlists" });
  }
});

// GET /wishlists — all rankings for all users, grouped by userId
app.get("/wishlists", async (req, res) => {
  try {
    const { Items } = await docClient.send(new ScanCommand({ TableName: WISHLIST_TABLE }));
    const grouped = {};
    for (const item of Items) {
      if (!grouped[item.userId]) grouped[item.userId] = [];
      grouped[item.userId].push(item);
    }
    res.json(grouped);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not retrieve wishlists" });
  }
});

// GET /wishlists/artist/:artistId — must be before /wishlists/:userId
app.get("/wishlists/artist/:artistId", async (req, res) => {
  const params = {
    TableName: WISHLIST_TABLE,
    IndexName: "ArtistIndex",
    KeyConditionExpression: "artistId = :aid",
    ExpressionAttributeValues: { ":aid": req.params.artistId },
  };

  try {
    const { Items } = await docClient.send(new QueryCommand(params));
    res.json(Items.map(({ userId, ranking, updatedAt }) => ({ userId, ranking, updatedAt })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not retrieve artist ratings" });
  }
});

// GET /wishlists/:userId
app.get("/wishlists/:userId", async (req, res) => {
  const params = {
    TableName: WISHLIST_TABLE,
    KeyConditionExpression: "userId = :uid",
    ExpressionAttributeValues: { ":uid": req.params.userId },
  };

  try {
    const { Items } = await docClient.send(new QueryCommand(params));
    res.json(Items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not retrieve wishlist" });
  }
});

// PUT /wishlists/:userId/:artistId
app.put("/wishlists/:userId/:artistId", async (req, res) => {
  const { ranking } = req.body;
  if (!VALID_RANKINGS.includes(ranking)) {
    return res.status(400).json({ error: `"ranking" must be one of: ${VALID_RANKINGS.join(", ")}` });
  }

  const entry = {
    userId: req.params.userId,
    artistId: req.params.artistId,
    ranking,
    updatedAt: new Date().toISOString(),
  };

  try {
    await docClient.send(new PutCommand({ TableName: WISHLIST_TABLE, Item: entry }));
    res.json(entry);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save ranking" });
  }
});

// DELETE /wishlists/:userId/:artistId
app.delete("/wishlists/:userId/:artistId", async (req, res) => {
  const params = {
    TableName: WISHLIST_TABLE,
    Key: { userId: req.params.userId, artistId: req.params.artistId },
  };

  try {
    await docClient.send(new DeleteCommand(params));
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not delete ranking" });
  }
});

app.use((req, res, next) => {
  return res.status(404).json({
    error: "Not Found",
  });
});

exports.app = app;
exports.handler = serverless(app);
