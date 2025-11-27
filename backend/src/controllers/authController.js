import { db } from "../database/db.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/auth.js";

export const login = (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  const token = generateToken({ id: user.id, username: user.username, role: user.role });
  res.json({ token });
};

