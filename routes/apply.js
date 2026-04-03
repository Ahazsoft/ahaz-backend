const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const multer = require("multer");
require("dotenv").config();
const prisma = require("../db.js");
const { supabase, supabaseAdmin } = require("../supabase.js");



const router = express.Router();



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
router.post("/", upload.single("cv"), async (req, res) => {
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
router.use((err, req, res, next) => {
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


module.exports = router;