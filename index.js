const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();
const prisma = require("./db.js");
const { supabase, supabaseAdmin } = require("./supabase.js");
// const prisma = require("./prisma.js");

const authRoute = require("./routes/auth.js");
const applyRoute = require("./routes/apply.js");
const jobsRoute = require("./routes/jobs.js");
const applicantsRoute = require("./routes/applicants.js");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: "*", // allow all origins for testing
    // credentials: true
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use("/api/auth", authRoute);
app.use("/api/apply",applyRoute)
app.use("/api/jobs", jobsRoute);
app.use("/api/job", jobsRoute);
app.use("/api/applicants", applicantsRoute);
app.use("/api/applicant", applicantsRoute);

app.get("/health", (req, res) => {
  res.send("Job Application API is running");
});



app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
