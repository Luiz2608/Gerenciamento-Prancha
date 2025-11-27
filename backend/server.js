import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import router from "./src/routes/index.js";
import "./src/database/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", router);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {});

