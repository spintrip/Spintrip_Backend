require('dotenv').config();
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * 🛡️ Spintrip Automated Database Backup
 * This script performs a pg_dump of the configured PostgreSQL database
 * and uploads the resulting file to the specified Amazon S3 bucket.
 * 
 * Instructions:
 * 1. Ensure 'pg_dump' is in your system PATH (or set PG_DUMP_PATH in .env).
 * 2. Run with 'node backup_to_s3.js'.
 */

// 1. AWS Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 2. Database Configuration
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '1234';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_NAME = process.env.DB_NAME || 'mydatabase';
const BUCKET_NAME = 'spintrip-s3bucket'; // Confirmed from project config

// 3. File Metadata
const date = new Date().toISOString().replace(/[:.]/g, '-');
const fileName = `backup-${DB_NAME}-${date}.sql`;
const filePath = path.join(__dirname, fileName);

// 4. Utility Path (Useful for Windows environments)
const PG_DUMP_PATH = process.env.PG_DUMP_PATH || 'pg_dump';

const runBackup = () => {
  console.log(`[Backup] Starting backup of database: ${DB_NAME} at ${new Date().toLocaleString()}`);

  // Constructing the command. We use the 'env' option to pass PGPASSWORD securely.
  const command = `"${PG_DUMP_PATH}" -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -f "${filePath}"`;

  exec(command, {
    env: { ...process.env, PGPASSWORD: DB_PASSWORD }
  }, async (error, stdout, stderr) => {
    if (error) {
      console.error(`[Backup Error] Failed to generate dump: ${error.message}`);
      return;
    }
    
    if (stderr) {
       console.log(`[Backup Info] ${stderr}`);
    }

    console.log(`[Backup] Local dump created successfully: ${fileName}`);

    try {
      // 5. Upload to S3
      console.log(`[S3] Uploading ${fileName} to bucket: ${BUCKET_NAME}...`);
      const fileStream = fs.createReadStream(filePath);
      
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: `database-backups/${fileName}`,
        Body: fileStream,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      console.log(`[S3] Successfully uploaded backup to 'database-backups/${fileName}'`);

      // 6. Local Cleanup
      fs.unlinkSync(filePath);
      console.log('[Backup] Local temporary file removed. Process complete.');
      
    } catch (uploadErr) {
      console.error(`[S3 Error] Upload failed: ${uploadErr.message}`);
      // Keep the local file in case of upload failure for manual recovery
      console.log(`[Manual Recovery] Local file preserved at: ${filePath}`);
    }
  });
};

// Execute the backup
runBackup();
