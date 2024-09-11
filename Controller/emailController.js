const nodemailer = require('nodemailer');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const axios = require('axios');

const generateLegalContractPDF = (bookingDetails) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const filePath = './legal_contract.pdf';

    doc.pipe(fs.createWriteStream(filePath));
    doc.fontSize(12).text('Legal Contract Between Host and User', { align: 'center' });
    doc.moveDown();
    doc.text(`Car Model: ${bookingDetails.carModel}`);
    doc.text('The user agrees to return the car in the same condition and with the same amount of fuel as received.');
    doc.text('The user is liable for any damages caused to the car during the rental period.');
    doc.text('This contract helps Spintrip legally in case of any issues during the rental period.');

    doc.end();

    doc.on('finish', () => resolve(filePath));
    doc.on('error', (err) => reject(err));
  });
};
const fetchPrivacyPolicyPDF = async () => {
    const response = await axios.get('https://spintrip.in/pages/privacy-policy', { responseType: 'arraybuffer' });
    const filePath = './privacy_policy.pdf';
    fs.writeFileSync(filePath, response.data);
    return filePath;
  };
const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true, // Use SSL/TLS
    auth: {
        user: 'info@spintrip.in', 
        pass: 'PandaBhosdiKe24@',
    }
});

const generateEmailTemplate = (subject, bodyContent) => {
    return `
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #f4f4f4;
                    color: #333;
                }
                .email-container {
                    width: 100%;
                    background-color: #fff;
                    padding: 20px;
                    margin: 0 auto;
                    max-width: 600px;
                    border-radius: 8px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                }
                .email-header {
                    text-align: center;
                    padding-bottom: 20px;
                }
                .email-header img {
                    max-width: 150px;
                }
                .email-body {
                    padding: 20px;
                }
                .email-body h1 {
                    color: #007bff;
                }
                .email-body p {
                    line-height: 1.6;
                }
                .email-body table {
                    width: 100%;
                    margin-top: 20px;
                    border-collapse: collapse;
                }
                .email-body table, .email-body th, .email-body td {
                    border: 1px solid #ddd;
                    padding: 8px;
                }
                .email-body th {
                    background-color: #f8f8f8;
                    text-align: left;
                }
                .email-footer {
                    text-align: center;
                    margin-top: 30px;
                    font-size: 12px;
                    color: #777;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="email-header">
                    <img src="cid:logo" alt="Spintrip Logo">
                </div>
                <div class="email-body">
                    <h1>${subject}</h1>
                    ${bodyContent}
                    <p>Best regards,<br>The Spintrip Team</p>
                </div>
                <div class="email-footer">
                    <p>&copy; 2024 Spintrip Car Rentals Private Limited. All rights reserved.</p>
                    <p>Follow us on social media for the latest updates and offers!</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

const sendEmail = async (recipient, subject, bodyContent) => {
    setImmediate(async () => {
        try {
            let mailOptions = {
                from: 'info@spintrip.in',
                to: recipient,
                subject: subject,
                html: generateEmailTemplate(subject, bodyContent),
                attachments: [{
                    filename: 'logo.png',
                    path: path.join(__dirname, 'logo.png'),
                    cid: 'logo',
                }],
            };

            await transporter.sendMail(mailOptions);
            console.log(`${subject} email sent successfully to ${recipient}.`);
        } catch (error) {
            console.error(`Error in sending ${subject} email:`, error);
        }
    });
};

const sendBookingConfirmationEmail = async (userEmail, hostEmail, bookingDetails) => {
    const subject = 'Your Spintrip Booking Confirmation';
    const bodyContent = `
        <p>We are excited to confirm your booking. Please find the details below:</p>
        <table>
            <tr><th>Car Model</th><td>${bookingDetails.carModel}</td></tr>
            <tr><th>Start Date</th><td>${bookingDetails.startDate}</td></tr>
            <tr><th>End Date</th><td>${bookingDetails.endDate}</td></tr>
            <tr><th>Start Time</th><td>${bookingDetails.startTime}</td></tr>
            <tr><th>End Time</th><td>${bookingDetails.endTime}</td></tr>
        </table>
        <p>We wish you a fantastic journey. Should you need any assistance, feel free to contact us at <a href="mailto:info@spintrip.in">info@spintrip.in</a>.</p>
    `;
    sendEmail(userEmail, subject, bodyContent);
    sendEmail(hostEmail, 'New Spintrip Booking Request', bodyContent);
};

const sendBookingApprovalEmail = async (userEmail, hostEmail, bookingDetails) => {
    const subject = 'Your Spintrip Booking Has Been Approved';
    const bodyContent = `
        <p>Your booking has been approved by the host. Below are the details:</p>
        <table>
            <tr><th>Car Model</th><td>${bookingDetails.carModel}</td></tr>
            <tr><th>Start Date</th><td>${bookingDetails.startDate}</td></tr>
            <tr><th>End Date</th><td>${bookingDetails.endDate}</td></tr>
            <tr><th>Start Time</th><td>${bookingDetails.startTime}</td></tr>
            <tr><th>End Time</th><td>${bookingDetails.endTime}</td></tr>
        </table>
        <p>If you have any questions, reach out to us at <a href="mailto:info@spintrip.in">info@spintrip.in</a>.</p>
    `;

    // Generate the PDFs
    const legalContractPath = await generateLegalContractPDF(bookingDetails);
    const privacyPolicyPath = await fetchPrivacyPolicyPDF();

    // Send email to user
    sendEmail(userEmail, subject, bodyContent, [
        { filename: 'Legal_Contract.pdf', path: legalContractPath },
        { filename: 'Privacy_Policy.pdf', path: privacyPolicyPath },
    ]);

    // Send email to host
    sendEmail(hostEmail, 'Your Spintrip Booking is Approved', bodyContent, [
        { filename: 'Legal_Contract.pdf', path: legalContractPath },
        { filename: 'Privacy_Policy.pdf', path: privacyPolicyPath },
    ]);
};
const sendTripStartEmail = async (userEmail, hostEmail, bookingDetails) => {
    const subject = 'Your Spintrip Journey is Starting!';
    const bodyContent = `
        <p>Your journey with Spintrip is about to start. Below are your trip details:</p>
        <table>
            <tr><th>Car Model</th><td>${bookingDetails.carModel}</td></tr>
            <tr><th>Start Date</th><td>${bookingDetails.startDate}</td></tr>
            <tr><th>End Date</th><td>${bookingDetails.endDate}</td></tr>
            <tr><th>Start Time</th><td>${bookingDetails.startTime}</td></tr>
            <tr><th>End Time</th><td>${bookingDetails.endTime}</td></tr>
        </table>
        <p>We wish you a safe and enjoyable journey. For any support, contact us at <a href="mailto:info@spintrip.in">info@spintrip.in</a>.</p>
    `;
    sendEmail(userEmail, subject, bodyContent);
    sendEmail(hostEmail, 'Your Spintrip Journey is About to Start', bodyContent);
};

const sendTripEndEmail = async (userEmail, hostEmail, bookingDetails) => {
    const subject = 'Your Spintrip Journey Has Ended';
    const bodyContent = `
        <p>Your trip has successfully concluded. We hope you had a great experience. Below are your trip details:</p>
        <table>
            <tr><th>Car Model</th><td>${bookingDetails.carModel}</td></tr>
            <tr><th>Start Date</th><td>${bookingDetails.startDate}</td></tr>
            <tr><th>End Date</th><td>${bookingDetails.endDate}</td></tr>
            <tr><th>Start Time</th><td>${bookingDetails.startTime}</td></tr>
            <tr><th>End Time</th><td>${bookingDetails.endTime}</td></tr>
        </table>
        <p>We look forward to serving you again. For any feedback or inquiries, please reach out to us at <a href="mailto:info@spintrip.in">info@spintrip.in</a>.</p>
    `;
    sendEmail(userEmail, subject, bodyContent);
    sendEmail(hostEmail, 'Your Spintrip Journey Has Ended', bodyContent);
};

const sendPaymentConfirmationEmail = async (userEmail, hostEmail, bookingDetails) => {
    const subject = 'Your Spintrip Payment is Confirmed';
    const bodyContent = `
        <p>We have successfully received your payment. Below are your booking details:</p>
        <table>
            <tr><th>Car Model</th><td>${bookingDetails.carModel}</td></tr>
            <tr><th>Start Date</th><td>${bookingDetails.startDate}</td></tr>
            <tr><th>End Date</th><td>${bookingDetails.endDate}</td></tr>
            <tr><th>Start Time</th><td>${bookingDetails.startTime}</td></tr>
            <tr><th>End Time</th><td>${bookingDetails.endTime}</td></tr>
        </table>
        <p>If you have any questions or need assistance, feel free to reach out to us at <a href="mailto:info@spintrip.in">info@spintrip.in</a>.</p>
        <p>We wish you a safe and enjoyable trip!</p>
    `;
    sendEmail(userEmail, subject, bodyContent);
    sendEmail(hostEmail, 'Payment Received for Your Booking', bodyContent);
};

const sendBookingCancellationEmail = async (userEmail, hostEmail, bookingDetails) => {
    const subject = 'Your Spintrip Booking Has Been Cancelled';
    const bodyContent = `
        <p>We regret to inform you that your booking has been cancelled. Below are the details:</p>
        <table>
            <tr><th>Car Model</th><td>${bookingDetails.carModel}</td></tr>
            <tr><th>Start Date</th><td>${bookingDetails.startDate}</td></tr>
            <tr><th>End Date</th><td>${bookingDetails.endDate}</td></tr>
            <tr><th>Start Time</th><td>${bookingDetails.startTime}</td></tr>
            <tr><th>End Time</th><td>${bookingDetails.endTime}</td></tr>
        </table>
        <p>If you have any questions or need further information, feel free to contact us at <a href="mailto:info@spintrip.in">info@spintrip.in</a>.</p>
    `;
    sendEmail(userEmail, subject, bodyContent);
    sendEmail(hostEmail, 'Booking Cancelled for Your Car', bodyContent);
};

const sendBookingCompletionEmail = async (userEmail, hostEmail, bookingDetails) => {
    const subject = 'Your Spintrip Booking is Complete';
    const bodyContent = `
        <p>Thank you for choosing Spintrip. Your booking has been successfully completed. Below are the details:</p>
        <table>
            <tr><th>Car Model</th><td>${bookingDetails.carModel}</td></tr>
            <tr><th>Start Date</th><td>${bookingDetails.startDate}</td></tr>
            <tr><th>End Date</th><td>${bookingDetails.endDate}</td></tr>
            <tr><th>Start Time</th><td>${bookingDetails.startTime}</td></tr>
            <tr><th>End Time</th><td>${bookingDetails.endTime}</td></tr>
        </table>
        <p>We hope you had a great experience with Spintrip. For any feedback or further inquiries, please reach out to us at <a href="mailto:info@spintrip.in">info@spintrip.in</a>.</p>
    `;
    sendEmail(userEmail, subject, bodyContent);
    sendEmail(hostEmail, 'Your Spintrip Booking is Complete', bodyContent);
};

module.exports = { 
    sendBookingConfirmationEmail, 
    sendBookingApprovalEmail, 
    sendTripStartEmail, 
    sendTripEndEmail, 
    sendPaymentConfirmationEmail,
    sendBookingCancellationEmail,
    sendBookingCompletionEmail,
    sendEmail
};
