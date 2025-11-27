import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET || "prancha_secret_key";

export const generateToken = (payload) => jwt.sign(payload, secret, { expiresIn: "24h" });

export const authMiddleware = (req, res, next) => {
  const h = req.headers.authorization || "";
  const parts = h.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    try {
      const decoded = jwt.verify(parts[1], secret);
      req.user = decoded;
      return next();
    } catch (e) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  res.status(401).json({ error: "Unauthorized" });
};

