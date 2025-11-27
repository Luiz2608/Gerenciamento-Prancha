import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultPath = path.join(__dirname, "..", "..", "database.sqlite");
const dbPath = process.env.DATABASE_PATH || defaultPath;

export const db = new Database(dbPath);

db.exec(
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL
  );`
);

db.exec(
  `CREATE TABLE IF NOT EXISTS drivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cpf TEXT,
    cnh_category TEXT,
    status TEXT NOT NULL
  );`
);

db.exec(
  `CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    driver_id INTEGER NOT NULL,
    destination TEXT,
    service_type TEXT,
    description TEXT,
    start_time TEXT,
    end_time TEXT,
    km_start INTEGER,
    km_end INTEGER,
    status TEXT NOT NULL,
    FOREIGN KEY(driver_id) REFERENCES drivers(id)
  );`
);

db.exec(
  `CREATE TABLE IF NOT EXISTS destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );`
);

db.exec(
  `CREATE TABLE IF NOT EXISTS service_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );`
);

db.exec(
  `CREATE TABLE IF NOT EXISTS truck (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    plate TEXT,
    model TEXT,
    year INTEGER
  );`
);

const adminExists = db.prepare("SELECT id FROM users WHERE username = ?").get("admin");
if (!adminExists) {
  const hash = bcrypt.hashSync("admin123", 10);
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run("admin", hash, "admin");
}

const truckExists = db.prepare("SELECT id FROM truck WHERE id = 1").get();
if (!truckExists) {
  db.prepare("INSERT INTO truck (id, plate, model, year) VALUES (1, ?, ?, ?)").run(null, null, null);
}
