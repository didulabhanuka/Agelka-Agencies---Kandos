require("dotenv").config();
const mongoose = require("mongoose");

// Model
const Item = require("../models/inventory/item.model");

// -------------------------------
// IDs
// -------------------------------
const groupIDs = {
  CHOCOLATES: "696f98795a445f9969e9b4dd",
  BISCUITS: "696f98795a445f9969e9b4e1",
  SOFT_DRINKS: "696f98795a445f9969e9b4e5",
  SNACKS: "696f98795a445f9969e9b4e3",
};

const brandIDs = {
  KANDOS: "696f96fa105b0396fcfe4f92",
  MUNCHEE: "696f96fb105b0396fcfe4f94",
  ELEPHANT_HOUSE: "696f96fb105b0396fcfe4f96",
  COCA_COLA: "696f96fb105b0396fcfe4f9a",
};

const supplierIDs = {
  KANDOS_MANUFACTURING: "693669118e955afa4d0124a4",
  MUNCHEE_CBL_FOODS: "693669118e955afa4d0124a5",
  HIGHLAND_DAIRY: "693669118e955afa4d0124a6",
  LANKA_WHOLESALE: "693669118e955afa4d0124a8",
};

// -------------------------------
// ITEM SEEDS
// -------------------------------
const itemSeeds = [
  // ============================================================
  // MODE A — ONLY PRIMARY UOM
  // ============================================================

  {
    itemCode: "KND-CHOC-001",
    name: "Kandos Milk Chocolate 100g",
    description: "Premium milk chocolate bar by Kandos.",
    brand: brandIDs.KANDOS,
    productGroup: groupIDs.CHOCOLATES,
    supplier: supplierIDs.KANDOS_MANUFACTURING,

    primaryUom: "PACK",

    avgCostPrimary: 180,
    sellingPricePrimary: 220,

    reorderLevel: 20,
    status: "active",
  },

  {
    itemCode: "MNC-SNACK-CRACKER",
    name: "Munchee Snack Crackers 200g",
    description: "Crispy baked snack crackers.",
    brand: brandIDs.MUNCHEE,
    productGroup: groupIDs.SNACKS,
    supplier: supplierIDs.MUNCHEE_CBL_FOODS,

    primaryUom: "PACK",

    avgCostPrimary: 150,
    sellingPricePrimary: 200,

    reorderLevel: 40,
    status: "active",
  },

  {
    itemCode: "COC-CAN-330",
    name: "Coca-Cola Can 330ml",
    description: "Chilled Coca-Cola 330ml can.",
    brand: brandIDs.COCA_COLA,
    productGroup: groupIDs.SOFT_DRINKS,
    supplier: supplierIDs.LANKA_WHOLESALE,

    primaryUom: "CAN",

    avgCostPrimary: 90,
    sellingPricePrimary: 130,

    reorderLevel: 60,
    status: "active",
  },

  // ============================================================
  // MODE B — PRIMARY + BASE UOM
  // ============================================================

  {
    itemCode: "MNC-BISC-LEM-PK",
    name: "Munchee Lemon Cream Biscuit Pack",
    description: "Sweet biscuit with lemon cream filling.",
    brand: brandIDs.MUNCHEE,
    productGroup: groupIDs.BISCUITS,
    supplier: supplierIDs.MUNCHEE_CBL_FOODS,

    primaryUom: "PACK",
    baseUom: "Piece",
    uoms: [
      { uomCode: "PACK", parentCode: null, factorToParent: 1 },
      { uomCode: "Piece", parentCode: "PACK", factorToParent: 10 },
    ],

    avgCostPrimary: 70,
    sellingPricePrimary: 100,

    reorderLevel: 50,
    status: "active",
  },

  {
    itemCode: "EH-CRUSH-1L",
    name: "Elephant House Orange Crush 1L",
    description: "Popular orange-flavored soft drink.",
    brand: brandIDs.ELEPHANT_HOUSE,
    productGroup: groupIDs.SOFT_DRINKS,
    supplier: supplierIDs.HIGHLAND_DAIRY,

    primaryUom: "BOTTLE",
    baseUom: "ML",
    uoms: [
      { uomCode: "BOTTLE", parentCode: null, factorToParent: 1 },
      { uomCode: "ML", parentCode: "BOTTLE", factorToParent: 1000 },
    ],

    avgCostPrimary: 160,
    sellingPricePrimary: 200,

    reorderLevel: 30,
    status: "active",
  },

  {
    itemCode: "COC-BTL-1500",
    name: "Coca-Cola 1.5L Bottle",
    description: "Coca-Cola PET bottle 1.5L",
    brand: brandIDs.COCA_COLA,
    productGroup: groupIDs.SOFT_DRINKS,
    supplier: supplierIDs.LANKA_WHOLESALE,

    primaryUom: "BOTTLE",
    baseUom: "ML",
    uoms: [
      { uomCode: "BOTTLE", parentCode: null, factorToParent: 1 },
      { uomCode: "ML", parentCode: "BOTTLE", factorToParent: 1500 },
    ],

    avgCostPrimary: 180,
    sellingPricePrimary: 240,

    reorderLevel: 35,
    status: "active",
  },
];

// -------------------------------
// CONNECT DB
// -------------------------------
async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✔ MongoDB connected");
}

// -------------------------------
// SEED ITEMS
// -------------------------------
async function seedItems() {
  console.log("\n🚀 Seeding Items...");

  await Item.deleteMany({});
  console.log("🗑  Existing items cleared");

  for (const item of itemSeeds) {
    await Item.create(item); // pre('save') handles MODE A / MODE B
  }

  console.log(`✔ Inserted ${itemSeeds.length} items`);
}

// -------------------------------
// RUN
// -------------------------------
(async function run() {
  try {
    await connectDB();
    await seedItems();
    console.log("\n🎉 Item seeding completed successfully!");
  } catch (err) {
    console.error("❌ Seeder failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
