const express = require("express");
require("dotenv").config();
const prisma = require("../db.js");



// router = express();
router = express.Router();


// GET /api/jobs - fetch all jobs from db
router.get("/", async (req, res) => {
  try {
    const jobs = await prisma.jobs.findMany();
    res.json(jobs);
  } catch (error) {
    console.error(` Prisma error: ${error}`);

    res.status(500).json({ error: error.message });
  }
});

// GET /api/job/:id  - fetch a single job by its UUID from db
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const job = await prisma.jobs.findUnique({
      where: { id },
    });

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    console.log(` job title ${job.title}`);
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/job/add - add a job to the db
router.post("/add", async (req, res) => {
  try {
    const {
      company,
      title,
      jobType,
      jobLevel,
      location,
      salary,
      description,
      education,
      email,
      expiryDate,
      status,
    } = req.body;

    // Basic required‑field validation
    if (
      !title ||
      !jobType ||
      !jobLevel ||
      !location ||
      !salary ||
      !description ||
      !education ||
      !email ||
      !expiryDate
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newJob = await prisma.jobs.create({
      data: {
        company: company || "Ahaz Solutions", // fallback as in your Next.js code
        title,
        job_type: jobType,
        job_level: jobLevel,
        location,
        salary,
        description,
        education,
        email,
        post_date: new Date().toISOString(), // always set on creation
        expiry_date: expiryDate,
        status: status || "open",
      },
    });

    res.status(201).json({ success: true, job: newJob });
  } catch (error) {
    console.error("POST /api/job/add error:", error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/job/edit/:id - edit a job
router.put("/edit/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      company,
      title,
      jobType,
      jobLevel,
      location,
      salary,
      description,
      education,
      email,
      expiryDate,
      status,
    } = req.body;

    // Check if job exists
    const existingJob = await prisma.jobs.findUnique({ where: { id } });
    if (!existingJob) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Build update data dynamically – only include fields that were sent
    const updateData = {};
    if (company !== undefined) updateData.company = company;
    if (title !== undefined) updateData.title = title;
    if (jobType !== undefined) updateData.job_type = jobType;
    if (jobLevel !== undefined) updateData.job_level = jobLevel;
    if (location !== undefined) updateData.location = location;
    if (salary !== undefined) updateData.salary = salary;
    if (description !== undefined) updateData.description = description;
    if (education !== undefined) updateData.education = education;
    if (email !== undefined) updateData.email = email;
    if (expiryDate !== undefined) updateData.expiry_date = expiryDate;
    if (status !== undefined) updateData.status = status;
    // post_date is usually not updated

    const updatedJob = await prisma.jobs.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, job: updatedJob });
  } catch (error) {
    console.error("PUT /api/job/edit/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/editstatus/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Check if job exists
    const existingJob = await prisma.jobs.findUnique({ where: { id } });
    if (!existingJob) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Build update data dynamically – only include fields that were sent
    const updateData = {};
    if (status !== undefined) updateData.status = status;

    const updatedJob = await prisma.jobs.update({
      where: { id },
      data: updateData,
    });

    res.json({ success: true, job: updatedJob });
  } catch (error) {
    console.error("PUT /api/job/editstatus/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE - delete a job from the db
router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Optional: check existence first
    const existingJob = await prisma.jobs.findUnique({ where: { id } });
    if (!existingJob) {
      return res.status(404).json({ error: "Job not found" });
    }

    await prisma.jobs.delete({ where: { id } });

    res.json({ success: true, message: "Job deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/job/delete/:id error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;