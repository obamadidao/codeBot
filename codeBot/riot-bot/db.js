const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("/data/database.db", (err) => {
  if (err) {
    console.error("❌ Không thể mở database:", err);
  } else {
    console.log("✅ Database connected");
  }
});

db.run("PRAGMA journal_mode = WAL;");

// Tạo bảng đầy đủ
db.run(`
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT,
  username TEXT,
  password TEXT,
  rank TEXT,
  ingameName TEXT,
  createdBy TEXT,
  borrowTime INTEGER,
  borrowedBy TEXT,
  isBorrowed INTEGER DEFAULT 0
)
`, (err) => {
  if (err) {
    console.log("❌ DB ERROR:", err);
  } else {
    console.log("✅ Database ready");
  }
});

// Bổ sung cột cho database cũ nếu thiếu
const alterStatements = [
  "ALTER TABLE accounts ADD COLUMN ingameName TEXT",
  "ALTER TABLE accounts ADD COLUMN createdBy TEXT",
  "ALTER TABLE accounts ADD COLUMN borrowTime INTEGER",
  "ALTER TABLE accounts ADD COLUMN borrowedBy TEXT",
  "ALTER TABLE accounts ADD COLUMN isBorrowed INTEGER DEFAULT 0"
];

alterStatements.forEach(sql => {
  db.run(sql, (err) => {
    if (
      err &&
      !err.message.includes("duplicate column name")
    ) {
      console.log("ALTER ERROR:", err.message);
    }
  });
});

module.exports = db;
