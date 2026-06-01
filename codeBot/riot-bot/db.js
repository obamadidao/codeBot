const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const db = new sqlite3.Database("/data/database.db");

db.run("PRAGMA journal_mode = WAL;");

// thêm cột thời gian mượn
db.run(
  "ALTER TABLE accounts ADD COLUMN borrowTime INTEGER",
  () => {}
);

// tạo bảng
db.run(`
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT,
  username TEXT,
  password TEXT,
  rank TEXT
)
`, (err) => {
  if (err) {
    console.log("❌ DB ERROR:", err);
  } else {
    console.log("✅ Database ready");
  }
});

module.exports = db;
