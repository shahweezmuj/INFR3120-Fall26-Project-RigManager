
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();
const dataFile = path.join(__dirname, "..", "data", "inventory.json");

// Read inventory and build data
function readData() {
  try {
    const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));

    if (!Array.isArray(data.items)) data.items = [];
    if (!Array.isArray(data.builds)) data.builds = [];

    return data;
  } catch (error) {
    return { items: [], builds: [] };
  }
}

// Save data
function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// Find an inventory item belonging to a saved build part
function findInventoryPart(data, part) {
  if (part.inventoryItemId) {
    const exactMatch = data.items.find(
      item => item.id === part.inventoryItemId
    );

    if (exactMatch) return exactMatch;
  }

  // Fallback for builds created before inventory IDs were saved
  return data.items.find(
    item =>
      item.name === part.name &&
      item.category === part.category
  );
}

// Restore components to inventory
function restoreBuildParts(data, build) {
  build.parts.forEach((part, index) => {
    let inventoryItem = findInventoryPart(data, part);

    if (inventoryItem) {
      inventoryItem.quantity = Number(inventoryItem.quantity) + 1;
    } else {
      data.items.push({
        id: part.inventoryItemId ||
          `returned-${build.id}-${index}`,
        name: part.name,
        category: part.category,
        cost: Number(part.cost),
        quantity: 1,
        condition: "Used"
      });
    }
  });
}

// Dashboard
router.get("/", (req, res) => {
  const data = readData();

  const totalUnits = data.items.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  );

  const inventoryValue = data.items.reduce(
    (sum, item) =>
      sum + Number(item.cost) * Number(item.quantity),
    0
  );

  // Sold builds use actual profit.
  // In-stock builds use estimated profit.
  // Returned builds are excluded.
  const estimatedProfit = data.builds.reduce((sum, build) => {
    const status = build.status || "In Stock";

    if (status === "Returned") {
      return sum;
    }

    if (status === "Sold") {
      return sum + Number(build.actualProfit || 0);
    }

    return sum + Number(build.profit || 0);
  }, 0);

  res.render("index", {
    title: "Dashboard",
    items: data.items,
    builds: data.builds,
    totalUnits,
    inventoryValue: inventoryValue.toFixed(2),
    estimatedProfit: estimatedProfit.toFixed(2),
    message: req.query.message || ""
  });
});

// Add inventory item
router.post("/inventory/add", (req, res) => {
  const { name, category, cost, quantity, condition } = req.body;

  const price = Number(cost);
  const qty = Number(quantity);

  if (
    !name ||
    !category ||
    !Number.isFinite(price) ||
    price < 0 ||
    !Number.isInteger(qty) ||
    qty < 1
  ) {
    return res.redirect(
      "/?message=" +
      encodeURIComponent("Enter valid component details.")
    );
  }

  const data = readData();

  data.items.push({
    id: Date.now().toString(),
    name: name.trim(),
    category,
    cost: price,
    quantity: qty,
    condition: condition || "Used"
  });

  saveData(data);

  res.redirect(
    "/?message=" +
    encodeURIComponent("Inventory item added.")
  );
});

// Delete inventory item
router.post("/inventory/:id/delete", (req, res) => {
  const data = readData();

  data.items = data.items.filter(
    item => item.id !== req.params.id
  );

  saveData(data);

  res.redirect(
    "/?message=" +
    encodeURIComponent("Inventory item removed.")
  );
});

// Available component categories
const categories = [
  "CPU",
  "GPU",
  "Motherboard",
  "RAM",
  "Storage",
  "PSU",
  "Case",
  "Cooler"
];

// Open build planner
router.get("/builds/new", (req, res) => {
  res.render("build", {
    title: "Build Planner",
    items: readData().items,
    categories,
    error: ""
  });
});

// Create and save a PC build
router.post("/builds", (req, res) => {
  const data = readData();
  const selected = [];

  for (const category of categories) {
    const id = req.body[category];

    if (!id) continue;

    const part = data.items.find(
      item =>
        item.id === id &&
        item.category === category &&
        Number(item.quantity) > 0
    );

    if (part) {
      selected.push(part);
    }
  }

  if (selected.length < 2) {
    return res.render("build", {
      title: "Build Planner",
      items: data.items,
      categories,
      error: "Select at least two available components."
    });
  }

  const cost = selected.reduce(
    (sum, part) => sum + Number(part.cost),
    0
  );

  const askingPrice = Number(req.body.askingPrice);

  if (
    !Number.isFinite(askingPrice) ||
    askingPrice < 0
  ) {
    return res.render("build", {
      title: "Build Planner",
      items: data.items,
      categories,
      error: "Enter a valid estimated selling price."
    });
  }

  // Save the selected components and their original inventory IDs
  const build = {
    id: Date.now().toString(),
    name: (req.body.buildName || "Custom PC").trim(),

    parts: selected.map(part => ({
      inventoryItemId: part.id,
      name: part.name,
      category: part.category,
      cost: Number(part.cost)
    })),

    cost: Number(cost.toFixed(2)),
    askingPrice: Number(askingPrice.toFixed(2)),

    profit: Number((askingPrice - cost).toFixed(2)),

    margin: askingPrice > 0
      ? Number(
          (((askingPrice - cost) / askingPrice) * 100).toFixed(1)
        )
      : 0,

    status: "In Stock",
    actualSalePrice: null,
    actualProfit: null,
    componentsReturned: false
  };

  // Deduct one unit of each selected component
  selected.forEach(part => {
    const stockPart = data.items.find(
      item => item.id === part.id
    );

    if (stockPart) {
      stockPart.quantity = Number(stockPart.quantity) - 1;
    }
  });

  // Remove components that are now out of stock
  data.items = data.items.filter(
    item => Number(item.quantity) > 0
  );

  data.builds.unshift(build);

  saveData(data);

  res.redirect("/builds/" + build.id);
});

// Update build status and actual sale price
router.post("/builds/:id/update", (req, res) => {
  const data = readData();

  const build = data.builds.find(
    item => item.id === req.params.id
  );

  if (!build) {
    return res.redirect("/");
  }

  const status = req.body.status;

  const allowedStatuses = [
    "In Stock",
    "Sold",
    "Returned"
  ];

  if (!allowedStatuses.includes(status)) {
    return res.redirect("/");
  }

  let actualSalePrice = null;

  if (status === "Sold") {
    actualSalePrice = Number(req.body.actualSalePrice);

    if (
      req.body.actualSalePrice === "" ||
      !Number.isFinite(actualSalePrice) ||
      actualSalePrice < 0
    ) {
      return res.redirect(
        "/?message=" +
        encodeURIComponent("Enter a valid actual sale price.")
      );
    }
  }

  const wasReturned = build.componentsReturned === true;
  const willBeReturned = status === "Returned";

  // Restore components when a build is marked Returned
  if (!wasReturned && willBeReturned) {
    restoreBuildParts(data, build);
  }

  // If a returned PC goes back into stock or is sold again,
  // deduct its components from inventory again.
  if (wasReturned && !willBeReturned) {
    const matchingParts = [];

    for (const part of build.parts) {
      const inventoryItem = findInventoryPart(data, part);

      if (
        !inventoryItem ||
        Number(inventoryItem.quantity) < 1
      ) {
        return res.redirect(
          "/?message=" +
          encodeURIComponent(
            "Not enough inventory to reactivate this build."
          )
        );
      }

      matchingParts.push(inventoryItem);
    }

    matchingParts.forEach(item => {
      item.quantity = Number(item.quantity) - 1;
    });

    data.items = data.items.filter(
      item => Number(item.quantity) > 0
    );
  }

  build.status = status;
  build.actualSalePrice = actualSalePrice;
  build.componentsReturned = willBeReturned;

  if (status === "Sold") {
    build.actualProfit = Number(
      (actualSalePrice - Number(build.cost)).toFixed(2)
    );
  } else {
    build.actualProfit = null;
  }

  saveData(data);

  res.redirect(
    "/?message=" +
    encodeURIComponent("Build updated successfully.")
  );
});

// Delete a saved build
router.post("/builds/:id/delete", (req, res) => {
  const data = readData();

  const build = data.builds.find(
    item => item.id === req.params.id
  );

  if (!build) {
    return res.redirect("/");
  }

  // If an unsold build is deleted, return its parts to inventory.
  // Sold builds are not returned to stock.
  if (
    (build.status || "In Stock") === "In Stock" &&
    !build.componentsReturned
  ) {
    restoreBuildParts(data, build);
  }

  data.builds = data.builds.filter(
    item => item.id !== req.params.id
  );

  saveData(data);

  res.redirect(
    "/?message=" +
    encodeURIComponent("Build deleted successfully.")
  );
});

// View saved build and generate marketplace listing
router.get("/builds/:id", (req, res) => {
  const build = readData().builds.find(
    item => item.id === req.params.id
  );

  if (!build) {
    return res.redirect("/");
  }

  // Use actual newline characters, not literal backslash-n text.
  const specs = build.parts
    .map(part => `${part.category}: ${part.name}`)
    .join("\n");

  const listing = `${build.name} - Gaming PC

Specifications:
${specs}

Estimated selling price: $${Number(build.askingPrice).toFixed(2)} CAD

Complete PC build. Message for more information or to arrange a viewing.`;

  res.render("build-detail", {
    title: build.name,
    build,
    listing
  });
});

module.exports = router;
