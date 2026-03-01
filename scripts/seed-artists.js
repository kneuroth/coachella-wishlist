"use strict";

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} = require("@aws-sdk/lib-dynamodb");

const WISHLIST_TABLE = process.env.WISHLIST_TABLE || "wishlist-table-dev";
const SEED_USER_ID = "coachella-2026-seed";
const RANKING = "would_skip";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
});
const docClient = DynamoDBDocumentClient.from(client);

// Manual slug overrides for names that can't be auto-generated correctly
const SLUG_OVERRIDES = {
  "¥ØU$UK€ ¥UK1MAT$U": "yousuke-yukimatsu-2026", // special chars
  "&friends": "friends-2026", // & adjacent, no space
  RØZ: "roz-2026", // Ø doesn't NFD-decompose
};

function slugify(name) {
  if (SLUG_OVERRIDES[name]) return SLUG_OVERRIDES[name];
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
      .replace(/&/g, "and")
      .replace(/'/g, "")
      .replace(/[/]/g, "-") // / → separator
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") // strip remaining non-alphanumeric
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") + "-2026"
  );
}

// All unique artists from Spreadsheetchella 2026.xlsx
// - Boys Noize deduplicated (appears on both Friday and Saturday)
// - Sub Focus, Dimension, Culture Shock, and 1991 combined into "Worship"
//   (spreadsheet note: "These 4 make up Worship")
const ARTISTS = [
  // ── Friday ────────────────────────────────────────────────────────────────
  "Sabrina Carpenter",
  "the XX",
  "Nine Inch Nails",
  "Boys Noize",
  "Disclosure",
  "Turnstile",
  "Ethel Cain",
  "Dijon",
  "Teddy Swims",
  "KATSEYE",
  "Devo",
  "Sexyy Red",
  "Central Cee",
  "Foster the People",
  "Levity",
  "Blood Orange",
  "Moby",
  "Marlon Hoffstadt",
  "Lykke Li",
  "fakemink",
  "Gordo",
  "Creepy Nuts",
  "Joyce Manor",
  "BINI",
  "Kettama",
  "Groove Armada",
  "Joost",
  "HUGEL",
  "CMAT",
  "Slayyyter",
  "Prospa",
  "Hot Mulligan",
  "Hamdi",
  "Fleshwater",
  "Max Styler",
  "Wednesday",
  "Dabeull",
  "The Two Lips",
  "Ninajirachi",
  "Max Dean",
  "Luke Dean",
  "Cachirula",
  "Loojan",
  "Jessica Brankka",
  "Chloé Caillet",
  "Rossi.",
  "Arodes",
  "NewDad",
  "Carolina Durante",
  "flowerovlove",
  "Febuary",
  "Bob Baker Marionettes",
  "Youna",
  "Sahar Z",

  // ── Saturday ──────────────────────────────────────────────────────────────
  "Justin Bieber",
  "The Strokes",
  "GIVĒON",
  "Addison Rae",
  "Labrinth",
  "SOMBR",
  "David Byrne",
  "Interpol",
  "Alex G",
  "Swae Lee",
  "Solomun",
  "Taemin",
  "PinkPantheress",
  "Royel Otis",
  "REZZ",
  "Fujii Kaze",
  "Adriatique",
  "Davido",
  // Boys Noize appears here too — deduped above
  "Geese",
  "rusowsky",
  "¥ØU$UK€ ¥UK1MAT$U",
  "Green Velvet",
  "AYYBO",
  "Luísa Sonza",
  "ZULAN",
  "Los Hermanos Flores",
  "Bedouin",
  "Ceremony",
  "54 Ultra",
  "Noga Erez",
  "Ben Sterling",
  "Blondshell",
  "Lambrini Girls",
  "Ecca Vandal",
  "Mind Enterprises",
  "Freak Slug",
  "SOSA",
  "Mahmut Orhan",
  "Riordan",
  "Die Spitz",
  "WHATMORE",
  "GENESI",
  "Yamagucci",

  // ── Sunday ────────────────────────────────────────────────────────────────
  "Karol G",
  "Young Thug",
  "Kaskade",
  "BIGBANG",
  "Laufey",
  "Major Lazer",
  "Iggy Pop",
  "FKA twigs",
  "Wet Leg",
  "Clipse",
  "Subtronics",
  "Little Simz",
  "Mochakk",
  "Duke Dumont",
  "Worship", // Sub Focus, Dimension, Culture Shock, 1991
  "Armin van Buuren",
  "Adam Beyer",
  "Holly Humberstone",
  "Gigi Perez",
  "The Rapture",
  "Suicidal Tendencies",
  "BUNT.",
  "French Police",
  "Black Flag",
  "Oklou",
  "Röyksopp",
  "The Chats",
  "DRAIN",
  "Model/Actriz",
  "COBRAH",
  "Los Retros",
  "WhoMadeWho",
  "Jane Remover",
  "RØZ",
  "Glitterer",
  "Carlita",
  "Josh Baker",
  "MËSTIZA",
  "&friends",
  "AZZECCA",
  "LE YORA",
  "Samia",
  "Tomora",

  // ── Special / All-Weekend ─────────────────────────────────────────────────
  "Anyma",
  "Radiohead",
];

async function seed() {
  const now = new Date().toISOString();
  const items = ARTISTS.map((name) => ({
    userId: SEED_USER_ID,
    artistId: slugify(name),
    ranking: RANKING,
    updatedAt: now,
  }));

  console.log(`Table:  ${WISHLIST_TABLE}`);
  console.log(`UserId: ${SEED_USER_ID}`);
  console.log(`Artists: ${items.length}\n`);
  items.forEach((item) => console.log(`  ${item.artistId}`));
  console.log();

  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [WISHLIST_TABLE]: chunk.map((item) => ({
            PutRequest: { Item: item },
          })),
        },
      }),
    );
    console.log(
      `Batch ${Math.ceil((i + 25) / 25)} written (${Math.min(i + 25, items.length)}/${items.length})`,
    );
  }

  console.log(`\nDone. ${items.length} artists seeded.`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
