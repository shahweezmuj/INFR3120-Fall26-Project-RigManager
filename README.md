# RigManager – PC Inventory & Build Management

RigManager is a first-release web application for tracking PC components, assembling builds from inventory, calculating estimated costs/profit, and generating a draft marketplace listing.

## First-release features
- Add and remove inventory records.
- Track component category, condition, purchase cost, and quantity.
- View total stock units and inventory purchase value.
- Select parts from inventory to create a PC build.
- Calculate build cost, estimated selling price, estimated profit, and margin.
- Generate and copy a marketplace listing draft.

## Technologies
Node.js, Express.js, EJS, Bootstrap 5, HTML, CSS, and JSON file storage.

## Run locally
1. Install Node.js.
2. Open a terminal in this project folder.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000`.

## Render deployment
Use `npm install` as the build command and `npm start` as the start command. The app reads Render's `PORT` environment variable automatically.

**Storage limitation:** This release stores data in `data/inventory.json`. A standard Render web service has an ephemeral filesystem unless persistent storage is configured. For ongoing production use, connect a database or persistent disk.

## Demo data
The initial inventory records are sample data to demonstrate the application. Replace them with the group's actual inventory before presenting the application as real stock.

## Project structure
```text
RigManager/
├── app.js
├── controllers/index.js
├── data/inventory.json
├── public/css/style.css
├── public/images/rigmanager-logo.svg
├── views/
│   ├── partials/nav.ejs
│   ├── partials/footer.ejs
│   ├── index.ejs
│   ├── build.ejs
│   ├── build-detail.ejs
│   └── error.ejs
├── package.json
└── README.md
```

## External libraries and attribution
The application logic, page templates, styles, and RigManager logo in this repository were written for this project. Third-party libraries are dependencies/framework resources:
- Express.js: https://expressjs.com/
- EJS: https://ejs.co/
- Bootstrap: https://getbootstrap.com/

If any additional code is copied from outside course materials, record the exact source and author here, keep external code within the assignment's 10% limit, and comment on how it works.
