const express = require("express");
const path = require("path");
const router = require("./controllers/index");

const app = express();
const PORT = process.env.PORT || 3000;

// Configure EJS, form handling, static assets, and application routes.
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/", router);

app.use((req, res) => {
  res.status(404).render("error", {
    title: "Page Not Found",
    message: "The page you requested could not be found."
  });
});

app.listen(PORT, () => console.log(`RigManager running on port ${PORT}`));
