const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// make sure the database file for sqlite exists
const dbFolder = ".sql";
const filePath = path.join(process.cwd(), `./${dbFolder}/db.db`);
if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true }); // create the db folder if it doesn't exist
if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, ''); // create the file if it doesn't exist


// connect to the database
const sqldb = new sqlite3.Database(filePath, sqlite3.OPEN_READWRITE, err => {
    if (err) return console.error(err.message);
})

// export the db
module.exports = sqldb;