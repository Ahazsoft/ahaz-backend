// auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../db"); // adjust path to your db.js

const router = express.Router();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || "change_this_in_production";
const TOKEN_EXPIRY = "8h"; 

// ------------------- SIGNUP -------------------
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user already exists (by email or username)
    const existing = await prisma.accounts.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });
    if (existing) {
      return res.status(409).json({ error: "Email or username already in use" });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const createdUser = await prisma.accounts.create({
      data: {
        username,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        email: true,
        // password excluded
      },
    });

    return res.status(201).json({ user: createdUser });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ------------------- SIGNIN -------------------
router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    // Find user by email
    const user = await prisma.accounts.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create JWT payload
    const payload = { userId: user.id, email: user.email };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

    // Return token + user info (omit password)
    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Signin error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ------------------- LOGOUT -------------------
router.post("/logout", async (req, res) => {
  // With stateless JWT, logout is purely client-side.
  // Just return a success response – the client will discard the token.
  return res.status(200).json({ message: "Logged out successfully" });
});

// ------------------- VERIFY -------------------
// Checks if a provided token is valid and returns the decoded payload

router.get("/verify", async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ ok: true, payload: decoded });
  } catch (err) {
    // Token expired or invalid
    return res.status(401).json({ error: "Invalid or expired token" });
  }
});

module.exports = router;