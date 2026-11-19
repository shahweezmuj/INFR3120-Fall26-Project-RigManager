const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const dataFile = path.join(__dirname, "..", "data", "inventory.json");

// Read the saved inventory and build data from the JSON file.
function readData() {
  try { return JSON.parse(fs.readFileSync(dataFile, "utf8")); }
  catch (error) { return { items: [], builds: [] }; }
}

// Save updated records so they remain available after a local restart.
function saveData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

router.get("/", (req, res) => {
  const data = readData();
  const totalUnits = data.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  const inventoryValue = data.items.reduce((sum, item) => sum + Number(item.cost) * Number(item.quantity), 0);
  const estimatedProfit = data.builds.reduce((sum, build) => sum + Number(build.profit), 0);
  res.render("index", {
    title: "Dashboard", items: data.items, builds: data.builds,
    totalUnits, inventoryValue: inventoryValue.toFixed(2),
    estimatedProfit: estimatedProfit.toFixed(2),
    message: req.query.message || ""
  });
});

router.post("/inventory/add", (req, res) => {
  const { name, category, cost, quantity, condition } = req.body;
  const price = Number(cost), qty = Number(quantity);
  if (!name || !category || !Number.isFinite(price) || price < 0 ||
      !Number.isInteger(qty) || qty < 1) {
    return res.redirect("/?message=" + encodeURIComponent("Enter valid component details."));
  }
  const data = readData();
  data.items.push({
    id: Date.now().toString(), name: name.trim(), category,
    cost: price, quantity: qty, condition: condition || "Used"
  });
  saveData(data);
  res.redirect("/?message=" + encodeURIComponent("Inventory item added."));
});

router.post("/inventory/:id/delete", (req, res) => {
  const data = readData();
  data.items = data.items.filter(item => item.id !== req.params.id);
  saveData(data);
  res.redirect("/?message=" + encodeURIComponent("Inventory item removed."));
});

const categories = ["CPU", "GPU", "Motherboard", "RAM", "Storage", "PSU", "Case", "Cooler"];

router.get("/builds/new", (req, res) => {
  res.render("build", { title: "Build Planner", items: readData().items, categories, error: "" });
});

router.post("/builds", (req, res) => {
  const data = readData();
  const selected = [];
  for (const category of categories) {
    const id = req.body[category];
    if (!id) continue;
    const part = data.items.find(item => item.id === id && item.category === category && item.quantity > 0);
    if (part) selected.push(part);
  }
  if (selected.length < 2) {
    return res.render("build", { title: "Build Planner", items: data.items, categories,
      error: "Select at least two available components." });
  }
  const cost = selected.reduce((sum, part) => sum + Number(part.cost), 0);
  const askingPrice = Number(req.body.askingPrice);
  if (!Number.isFinite(askingPrice) || askingPrice < 0) {
    return res.render("build", { title: "Build Planner", items: data.items, categories,
      error: "Enter a valid estimated selling price." });
  }
  const build = {
    id: Date.now().toString(), name: (req.body.buildName || "Custom PC").trim(),
    parts: selected.map(part => ({ name: part.name, category: part.category, cost: Number(part.cost) })),
    cost: Number(cost.toFixed(2)), askingPrice: Number(askingPrice.toFixed(2)),
    profit: Number((askingPrice - cost).toFixed(2)),
    margin: askingPrice > 0 ? Number(((askingPrice - cost) / askingPrice * 100).toFixed(1)) : 0
  };
  // A saved build uses one unit of each selected inventory component.
  selected.forEach(part => {
    const stockPart = data.items.find(item => item.id === part.id);
    if (stockPart) stockPart.quantity -= 1;
  });
  data.items = data.items.filter(item => item.quantity > 0);
  data.builds.unshift(build);
  saveData(data);
  res.redirect("/builds/" + build.id);
});

router.get("/builds/:id", (req, res) => {
  const build = readData().builds.find(item => item.id === req.params.id);
  if (!build) return res.redirect("/");
  const specs = build.parts.map(part => `${part.category}: ${part.name}`).join("\\n");
  const listing = `${build.name} - Gaming PC\\n\\nSpecifications:\\n${specs}\\n\\nEstimated selling price: $${build.askingPrice.toFixed(2)} CAD\\n\\nComplete PC build. Message for more information or to arrange a viewing.`;
  res.render("build-detail", { title: build.name, build, listing });
});

module.exports = router;
