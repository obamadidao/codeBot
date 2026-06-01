const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./database.db");

// 1. CREATE TABLE
db.run(`
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT,
    rank TEXT,
    isBorrowed INTEGER DEFAULT 0,
    borrowedBy TEXT DEFAULT NULL,
    createdBy TEXT DEFAULT NULL,
    ingameName TEXT DEFAULT NULL
)
`);

// 2. AUTO MIGRATION SAFE (KHÔNG LỖI)
db.serialize(() => {

    db.run(`ALTER TABLE accounts ADD COLUMN createdBy TEXT`, () => { });
    db.run(`ALTER TABLE accounts ADD COLUMN ingameName TEXT`, () => { });
});

console.log("🚀 Database ready");