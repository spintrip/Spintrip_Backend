const fs = require('fs');
const path = require('path');
const { OpenAI } = require("openai");
const { sendEmail } = require('../Controller/emailController'); // Adjust the path as necessary
const { Admin, UserAdditional } = require('../Models'); // Assuming Admin model is properly defined and connected

const TEMP_FILE_PATH = path.join(__dirname, 'route_outcome_logs.json');

// Configure OpenAI API with the key from the .env file
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY, // Ensure API key is set in your .env file
// });

// Middleware to log route outcomes
const routeLogger = (req, res, next) => {
  const originalSend = res.send;

  res.send = function (body) {
    // Capture details about the route and the affected user
    const outcome = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      user: req.user ? req.user.id : null, // Capture user ID if available
      timestamp: new Date().toISOString(),
      body: typeof body === 'object' ? body : { message: body },
    };

    // Log to the temporary file
    logOutcome(outcome);

    // Call the original `send` method
    return originalSend.apply(this, arguments);
  };

  next();
};

// Function to log data to the temporary file
const logOutcome = (outcome) => {
  try {
    const logs = fs.existsSync(TEMP_FILE_PATH) ? JSON.parse(fs.readFileSync(TEMP_FILE_PATH)) : [];
    logs.push(outcome);
    fs.writeFileSync(TEMP_FILE_PATH, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error logging route outcome:', error);
  }
};

// Scheduler to run log analysis every 30 minutes
// setInterval(() => {
//   analyzeAndSendLogs();
// }, 30 * 60 * 1000); // 30 minutes interval

// Function to analyze logs and send email notifications
// const analyzeAndSendLogs = async () => {
//   try {
//     if (!fs.existsSync(TEMP_FILE_PATH)) return;

//     // Read and parse logs
//     const logs = JSON.parse(fs.readFileSync(TEMP_FILE_PATH));
//     if (logs.length === 0) return;

//     // Process logs in batches if necessary to avoid exceeding API call limits
//     const batchSize = 10; // Set batch size for logs
//     let processedLogs = [];
//     for (let i = 0; i < logs.length; i += batchSize) {
//       const logBatch = logs.slice(i, i + batchSize);
//       const batchSummary = await generateSummaryFromLogs(logBatch);
//       processedLogs.push(batchSummary);

//       // Pause between requests to comply with rate limits
//       await new Promise(resolve => setTimeout(resolve, 20000)); // 20 seconds interval
//     }

//     // Concatenate all summaries
//     const finalSummary = processedLogs.join('\n\n');

//     // Step 2: Generate the email content using the summarized logs
//     const emailContent = await generateEmailFromSummary(finalSummary);

//     // Fetch admin emails
//     const adminEmails = await getAdminEmails();

//     // Email details
//     const emailSubject = 'Backend Log Analysis';

//     // Send analysis results to all admins
//     await sendAnalysisEmails(adminEmails, emailSubject, emailContent);

//     // Clear the log file only after successfully sending emails
//     clearProcessedLogs(logs.length);
//   } catch (error) {
//     console.error('Error analyzing and sending logs:', error);
//   }
// };

// Function to generate a summary from logs using OpenAI
// const generateSummaryFromLogs = async (logs) => {
//   try {
//     const query = {
//       model: "gpt-4",
//       messages: [
//         { role: "system", content: "Analyze these logs and generate a report with concise information on changes to the backend. Focus on routes like update profile, bookings, new users, or anything more insightful for site owners, not search routes." },
//         { role: "user", content: JSON.stringify(logs) },
//       ],
//     };

//     const response = await openai.chat.completions.create(query);
//     return response.choices[0].message.content;
//   } catch (error) {
//     console.error('Error generating summary from logs:', error);
//     throw error;
//   }
// };

// Function to generate email content from the summary using OpenAI
// const generateEmailFromSummary = async (summary) => {
//   try {
//     const query = {
//       model: "gpt-4",
//       messages: [
//         { role: "system", content: "Write a professional and concise email body for the backend log analysis report. Include points most useful like new cars added, new bookings, user profile verification requests, or anything needing immediate attention." },
//         { role: "user", content: summary },
//       ],
//     };

//     const response = await openai.chat.completions.create(query);
//     return buildHtmlEmailBody(response.choices[0].message.content);
//   } catch (error) {
//     console.error('Error generating email content from summary:', error);
//     throw error;
//   }
// };

// Function to fetch admin emails from UserAdditional table using admin IDs
const getAdminEmails = async () => {
  try {
    const admins = await Admin.findAll({ attributes: ['id'] });
    const adminIds = admins.map(admin => admin.id);

    // Fetch emails from UserAdditional table using the admin IDs
    const adminEmails = await UserAdditional.findAll({
      attributes: ['Email'],
      where: { id: adminIds }  // Assuming 'id' in UserAdditional corresponds to admin IDs
    });

    // Extract email addresses
    return adminEmails.map(user => user.Email);
  } catch (error) {
    console.error('Error fetching admin emails:', error);
    throw error;
  }
};

// Function to send emails to the list of admin emails
// const sendAnalysisEmails = async (emails, subject, body) => {
//   try {
//     await Promise.all(emails.map(async (email) => {
//       console.log(`Sending email to ${email} with subject: "${subject}"`);
//       await sendEmail(email, subject, body, { html: true }); // Ensure sendEmail supports HTML content
//     }));
//     console.log('Log analysis sent to all admins.');
//   } catch (error) {
//     console.error('Error sending analysis emails:', error);
//   }
// };

// Function to build HTML content for the email
const buildHtmlEmailBody = (summaryContent) => {
  return `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #333;
            line-height: 1.6;
            padding: 20px;
          }
          h1, h2, h3, h4 {
            color: #0056b3;
            margin-bottom: 10px;
          }
          .summary-section {
            margin-bottom: 20px;
          }
          .key-findings {
            list-style-type: none;
            padding-left: 0;
          }
          .key-findings li {
            margin-bottom: 5px;
          }
          .recommendations {
            margin-top: 20px;
          }
          .car-image {
            max-width: 200px;
            display: block;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <h1>Backend Log Analysis</h1>
        <h2>Backend Change Report</h2>
        <div class="summary-section">
          <strong>Date of Analysis:</strong> ${new Date().toLocaleDateString()}<br>
          <strong>Endpoint Analyzed:</strong> Provided in logs
        </div>
        <h3>Summary</h3>
        <p>${summaryContent}</p>
        <br>
        <p>Best regards,<br>The Spintrip Team</p>
      </body>
    </html>
  `;
};

// Function to clear processed logs after successful email sending
const clearProcessedLogs = (processedCount) => {
  try {
    const logs = JSON.parse(fs.readFileSync(TEMP_FILE_PATH));
    const remainingLogs = logs.slice(processedCount);
    fs.writeFileSync(TEMP_FILE_PATH, JSON.stringify(remainingLogs, null, 2));
  } catch (error) {
    console.error('Error clearing processed logs:', error);
  }
};

module.exports = routeLogger;
