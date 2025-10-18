const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Ensure database is always in backend/.sql/ folder
const dbFolder = path.join(__dirname, '..', '.sql');
const filePath = path.join(dbFolder, 'verifier_queue.db');

// Create the database folder if it doesn't exist
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
}

// Create the database file if it doesn't exist
if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '');
}

// Connect to the database
const sqldb = new sqlite3.Database(filePath, sqlite3.OPEN_READWRITE, err => {
    if (err) return console.error(err.message);
})

// export the db
module.exports = sqldb;