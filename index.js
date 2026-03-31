const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();
const prisma = require("./db.js");
const { supabase, supabaseAdmin } = require("./supabase.js");
// const prisma = require("./prisma.js");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: "*", // allow all origins for testing
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Invalid file type. Only PDF, DOC, and DOCX are allowed."),
        false,
      );
    }
  },
});

// Configure Nodemailer transporter (cPanel SMTP)

// const transporter = nodemailer.createTransport({
//   host: "ahaz.io",
//   port: 587,
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// const transporter = nodemailer.createTransport({
//   sendmail: true,
//   newline: "unix",
//   path: "/usr/sbin/sendmail",
// });

const transporter = nodemailer.createTransport({
  host: "mail.ahaz.io", // use the subdomain pointing to your cPanel server
  port: 587,
  secure: false, // STARTTLS will be used automatically
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// POST /api/apply
app.post("/api/apply", upload.single("cv"), async (req, res) => {
  try {
    // Extract all fields from req.body (including optional)
    const {
      firstName,
      lastName,
      email,
      phone,
      jobTitle,
      company,
      linkedIn,
      gitHub,
      jobId,
    } = req.body;
    const cvFile = req.file;

    // Required fields validation
    if (!firstName || !lastName || !email || !phone || !jobTitle || !company) {
      return res
        .status(400)
        .json({ error: "All required fields must be filled." });
    }
    if (!cvFile) {
      return res.status(400).json({ error: "CV file is required." });
    }

    // Configure Nodemailer transporter
    // const transporter = nodemailer.createTransport({
    //   // service: "gmail",
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS,
    //   },
    // });

    // 1. Confirmation email to applicant
    const applicantMailOptions = {
      from: `"${company}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Application Received: ${jobTitle} at ${company}`,
      html: `
        <h2>Dear ${firstName} ${lastName},</h2>
        <p>Thank you for applying for the <strong>${jobTitle}</strong> position at <strong>${company}</strong>.</p>
        <p>We have received your application and will review it shortly. If your qualifications match our requirements, we will contact you for the next steps.</p>        
        <br/>
        <p>Best regards,<br/>The Recruitment Team</p>
      `,
    };

    // 2. Email to company with CV attached
    const companyMailOptions = {
      from: `"${company}" <${process.env.EMAIL_USER}>`,
      replyTo: email,
      to: process.env.EMAIL_USER,
      subject: `New Application: ${jobTitle} from ${firstName} ${lastName}`,
      html: `
        <p>A new application has been received for the <strong>${jobTitle}</strong> position.</p>
        <p><strong>Applicant Details:</strong></p>
        <ul>
          <li><strong>Name:</strong> ${firstName} ${lastName}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Phone:</strong> ${phone}</li>
          <li><strong>Company:</strong> ${company}</li>
          <li><strong>LinkedIn:</strong> ${linkedIn}</li>
          <li><strong>GitHub:</strong> ${gitHub}</li>        
        </ul>
        <p>The CV is attached to this email.</p>
      `,
      attachments: [
        {
          filename: cvFile.originalname,
          content: cvFile.buffer,
          contentType: cvFile.mimetype,
        },
      ],
    };

    // Send both emails

    // ========== SUPABASE INTEGRATION START ==========

    // 1. Upload file to Supabase Storage
    const bucketName = "Ahaz Solutions Applicants";
    const filePath = `${Date.now()}_${cvFile.originalname}`; // unique name
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(filePath, cvFile.buffer, {
        contentType: cvFile.mimetype,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return res
        .status(500)
        .json({ error: "Failed to upload CV. Please try again." });
    }

    // 2. Get public URL of the uploaded file
    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(filePath);
    const cvUrl = urlData.publicUrl;

    // 3. Insert applicant record into the `applicants` table
    //    Adjust fields according to your table schema.
    const { data: applicant, error: insertError } = await supabaseAdmin
      .from("applicants")
      .insert([
        {
          job_id: jobId, // must match a valid job id if foreign key exists
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
          github_link: gitHub || null,
          linkedin_link: linkedIn || null,
          cv_url: cvUrl,
          // created_at will be set automatically if default is now()
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      // Optional: Delete the uploaded file if insert fails
      await supabaseAdmin.storage.from(bucketName).remove([filePath]);
      return res
        .status(500)
        .json({ error: "Failed to save applicant data. Please try again." });
    }

    await transporter.sendMail(applicantMailOptions);
    await transporter.sendMail(companyMailOptions);

    res.status(200).json({
      message:
        "Application submitted successfully. A confirmation email has been sent.",
    });
  } catch (error) {
    console.error("Error processing application:", error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware for multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File too large. Maximum size is 5MB." });
    }
    return res.status(400).json({ error: err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});



// GET /api/jobs - fetch all jobs from db
app.get("/api/jobs", async (req, res) => {
  try {
    const jobs = await prisma.jobs.findMany();
    res.json(jobs);
  } catch (error) {
    console.error(` Prisma error: ${error}`);

    res.status(500).json({ error: error.message });
  }
});

// GET /api/job/:id  - fetch a single job by its UUID from db
app.get("/api/job/:id", async (req, res) => {
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
app.post("/api/job/add", async (req, res) => {
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
app.put("/api/job/edit/:id", async (req, res) => {
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

app.put("/api/job/editstatus/:id", async (req, res) => {
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
app.delete("/api/job/delete/:id", async (req, res) => {
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

// GET /api/applicants - fetch all applicants from db
app.get("/api/applicants", async (req, res) => {
  try {
    const applicants = await prisma.applicants.findMany();
    res.json(applicants);
  } catch (error) {
    console.error(` Prisma error: ${error}`);

    res.status(500).json({ error: error.message });
  }
});

// GET /api/applicant/:id  - fetch a single applicant by its UUID from db
app.get("/api/applicant/:id", async (req, res) => {
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




app.get("/health", (req, res) => {
  res.send("Job Application API is running");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
