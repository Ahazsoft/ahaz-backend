# Job Board Backend API

This is the backend API for a job board application. It handles job postings (CRUD) and job applications with email notifications. Built with **Node.js**, **Express**, **Prisma** (PostgreSQL via Supabase), and **Nodemailer**.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express
- **ORM**: Prisma (with PostgreSQL on Supabase)
- **Email**: Nodemailer (local SMTP, e.g., cPanel)
- **File Upload**: Multer (in‑memory)
- **Database**: Supabase PostgreSQL

## Features

- **CRUD operations** for job postings
- **Job application endpoint** with CV upload
- Sends confirmation email to applicant
- Sends application details + CV to the company
- **Health check** endpoint
- Uses environment variables for configuration

## Prerequisites

- Node.js (v18 or later)
- npm or pnpm
- A Supabase project (or any PostgreSQL database)
- SMTP server details (for Nodemailer)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Ahazsoft/ahaz-backend
   cd ahaz-backend
   ```

2. Install dependencies:
   ```
   npm install
   ```
   or
   ```
   pnpm install
   ```
3. Environment Variables

    rename the .env.example to  .env


4. Generate Prisma client and sync schema:

   ```
   npx prisma init // optional: just to create prisma folder including the prisma.schema and config files

   npx prisma db pull // required : to pull the database scheme from the db and sync your prisma.schema
   npx prisma generate // required : to generate the synced schema
   npx prisma db push  // warning : only use this if you update the schema and wanted to push the updated schema directly to the database

   ```

5. run it Enjoy!