const express = require("express");
require("dotenv").config();
const prisma = require("../db.js");

// const router = express();
router = express.Router();



// GET /api/applicants - fetch all applicants from db
router.get("/", async (req, res) => {
  try {
    const applicants = await prisma.applicants.findMany();
    res.json(applicants);
  } catch (error) {
    console.error(` Prisma error: ${error}`);

    res.status(500).json({ error: error.message });
  }
});

// GET /api/applicant/:id  - fetch a single applicant by its UUID from db
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const applicant = await prisma.applicants.findUnique({
      where: { id },
    });

    if (!applicant) {
      return res.status(404).json({ error: "Applicant not found" });
    }

    console.log(` Applicant found ${applicant.first_name} ${applicant.last_name}`);
    res.json(applicant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;