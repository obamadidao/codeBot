const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("/data/database.db", (err) => {
  if (err) {
    console.error("❌ Không thể mở database:", err);
  } else {
    console.log("✅ Database connected");
  }
});

db.run("PRAGMA journal_mode = WAL;");

// Tạo bảng nếu chưa có
db.run(`
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT,
  username TEXT,
  password TEXT,
  rank TEXT,
  ingameName TEXT,
  createdBy TEXT,
  borrowTime INTEGER
)
`, (err) => {
  if (err) {
    console.log("❌ DB ERROR:", err);
  } else {
    console.log("✅ Database ready");
  }
});

// Thêm các cột còn thiếu cho database cũ
db.run(
  "ALTER TABLE accounts ADD COLUMN ingameName TEXT",
  (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.log("❌ ingameName:", err.message);
    }
  }
);

db.run(
  "ALTER TABLE accounts ADD COLUMN createdBy TEXT",
  (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.log("❌ createdBy:", err.message);
    }
  }
);

db.run(
  "ALTER TABLE accounts ADD COLUMN borrowTime INTEGER",
  (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.log("❌ borrowTime:", err.message);
    }
  }
);

module.exports = db;
