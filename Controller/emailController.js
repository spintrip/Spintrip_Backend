const nodemailer = require('nodemailer');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const axios = require('axios');


  const generateLegalContractPDF = async (userEmail, hostEmail, bookingDetails) => {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const filePath = './legal_contract.pdf';
  
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);
  
        const logoPath = path.join(__dirname, 'assets', 'logo.png'); 
        doc.image(logoPath, 50, 45, { width: 100 })
          .moveDown(5); 
  
        doc
          .fontSize(20)
          .font('Helvetica-Bold')
          .text('Legal Contract Between Host and User', { align: 'center' })
          .moveDown(1);
  
        doc
          .moveTo(50, 150)
          .lineTo(550, 150)
          .stroke()
          .moveDown(2);
  
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Booking Details:', { underline: true })
          .moveDown(1);
  
        doc
          .font('Helvetica')
          .text('Car Model: ', { continued: true })
          .font('Helvetica-Bold')
          .text(bookingDetails.carModel)
          .moveDown(0.5);
  
        doc
          .font('Helvetica')
          .text('Booking Start Date: ', { continued: true })
          .font('Helvetica-Bold')
          .text(bookingDetails.startDate)
          .moveDown(0.5);

       doc
          .font('Helvetica')
          .text('Booking Start Time: ', { continued: true })
          .font('Helvetica-Bold')
          .text(bookingDetails.startTime)
          .moveDown(0.5);  

          doc
          .font('Helvetica')
          .text('Booking End Date: ', { continued: true })
          .font('Helvetica-Bold')
          .text(bookingDetails.endDate)
          .moveDown(0.5);    

          doc
          .font('Helvetica')
          .text('Booking End Time: ', { continued: true })
          .font('Helvetica-Bold')
          .text(bookingDetails.endTime)
          .moveDown(0.5);      
  
        doc
          .font('Helvetica')
          .text('Host Email: ', { continued: true })
          .font('Helvetica-Bold')
          .text(hostEmail)
          .moveDown(0.5);
  
        doc
          .font('Helvetica')
          .text('User Email: ', { continued: true })
          .font('Helvetica-Bold')
          .text(userEmail)
          .moveDown(2);
  
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Contract Terms:', { underline: true })
          .moveDown(1);
  
        doc
          .fontSize(12)
          .font('Helvetica')
          .list([
            'The user agrees to return the car in the same condition and with the same amount of fuel as received.',
            'The user is liable for any damages caused to the car during the rental period.',
            'This contract helps Spintrip legally in case of any issues during the rental period.',
            'Spintrip reserves the right to take action in case of non-compliance with the terms of this contract.',
          ], { bulletRadius: 3 })
          .moveDown(2);

        doc
          .fontSize(10)
          .font('Helvetica-Oblique')
          .text(
            'Note: This contract is legally binding between both parties. Any disputes should be resolved in accordance with the Spintrip terms and conditions.',
            { align: 'center' }
          );
  
        doc.end();
  
        writeStream.on('finish', () => {
          resolve(filePath);
        });
  
        writeStream.on('error', (err) => {
          reject(new Error('Error writing to PDF file: ' + err.message));
        });
  
      } catch (err) {
        reject(new Error('Unexpected error: ' + err.message));
      }
    });
  };
  const fetchPrivacyPolicyPDF = async () => {
    try {
        const doc = new PDFDocument();
        const filePath = './privacy_policy.pdf';
        
        const writeStream = fs.createWriteStream(filePath);
        doc.pipe(writeStream);

        const logoPath = path.join(__dirname, 'assets', 'logo.png'); 
        doc.image(logoPath, 50, 45, { width: 100 })
          .moveDown(5); 
        
        // Set the title and header for the PDF document
        doc.fontSize(18).text('Privacy Policy', { align: 'center', underline: true });
        doc.moveDown(2);
        
        // Add the company name
        doc.fontSize(14).text('Spintrip Car Rentals Pvt Ltd', { align: 'center' });
        doc.moveDown();
        
        // Add the full privacy policy text
        doc.fontSize(12).text(`
        THIS PRIVACY POLICY IS AN ELECTRONIC RECORD IN THE FORM OF AN ELECTRONIC CONTRACT FORMED UNDER THE INFORMATION TECHNOLOGY ACT, 2000 AND THE RULES MADE THEREUNDER AND THE AMENDED PROVISIONS PERTAINING TO ELECTRONIC DOCUMENTS/RECORDS IN VARIOUS STATUTES AS AMENDED BY THE INFORMATION TECHNOLOGY ACT, 2000. THIS PRIVACY POLICY DOES NOT REQUIRE ANY PHYSICAL, ELECTRONIC, OR DIGITAL SIGNATURE.

        THE TERMS "WE/US/OUR/SPINTRIP" INDIVIDUALLY AND COLLECTIVELY REFER TO SPINTRIP CAR RENTALS PVT LTD AND THE TERMS "YOU/YOUR/YOURSELF" REFER TO THE USERS/MEMBERS UNDER THE MEMBERSHIP AGREEMENT.

        THIS PRIVACY POLICY IS A LEGALLY BINDING DOCUMENT BETWEEN YOU AND SPINTRIP (BOTH TERMS DEFINED ABOVE).

        THIS DOCUMENT IS PUBLISHED AND SHALL BE CONSTRUED IN ACCORDANCE WITH THE PROVISIONS OF THE INFORMATION TECHNOLOGY (REASONABLE SECURITY PRACTICES AND PROCEDURES AND SENSITIVE PERSONAL DATA OR INFORMATION) RULES, 2011 UNDER INFORMATION TECHNOLOGY ACT, 2000; THAT REQUIRE PUBLISHING OF THE PRIVACY POLICY FOR COLLECTION, USE, STORAGE AND TRANSFER OF SENSITIVE PERSONAL DATA OR INFORMATION.

        PLEASE READ THIS PRIVACY POLICY CAREFULLY. BY USING THE WEBSITE, YOU INDICATE THAT YOU UNDERSTAND, AGREE AND CONSENT TO THIS PRIVACY POLICY. IF YOU DO NOT AGREE WITH THE TERMS OF THIS PRIVACY POLICY, PLEASE DO NOT USE THIS WEBSITE. YOU HEREBY PROVIDE YOUR UNCONDITIONAL & IRREVOCABLE CONSENT TO SPINTRIP FOR THE PURPOSES PRESCRIBED UNDER INCLUDING BUT NOT LIMITED TO PROVISIONS OF SECTIONS 43A, 72 AND SECTION 72A OF INFORMATION TECHNOLOGY ACT, 2000.

        This Privacy Policy (the “Policy”) sets out how Spintrip collects, uses, protects, and shares any information that you give to us when you use this website i.e. www.spintrip.in including its mobile application (the “Website”). Spintrip is committed to ensuring that your privacy is protected to all possible, reasonable, and commercial extents, as your privacy on the Internet is of the utmost importance to us. Because we gather certain types of information about You in order to provide, protect, maintain and improve our services, We feel You should fully understand the Policy surrounding the capture and use of that information and solicit Your full attention towards it.

        By providing us your Information or by making use of the facilities provided by the Website, You hereby consent to the collection, storage, processing, and transfer of any or all of Your Personal Information and Non-Personal Information by Spintrip, as specified under this Policy. You further represent and warrant that such collection, use, storage, and transfer of Your Information shall not cause any loss or wrongful gain to you or any other person.

        This Policy is a legally binding contract between You and Spintrip, whose Website You use or access or You otherwise deal with. This Policy shall be read together with the other terms and conditions of the Website viz, Membership Agreement, and Fees Policy being displayed on the website www.spintrip.in.

        Collection, Storage, and Use of Personal Information:
        When You apply for or maintain an account with Spintrip, We collect certain personally identifiable information (“Personal Information”), such as:

        Your name, age, gender, photograph, contact preferences, telephone number, mailing address, including but not limited to permanent and current residential addresses, e-mail address, financial information, internet protocol address, history of Your transactions (booking and payment history), any other items of sensitive personal data or information, as such term is defined under the Information Technology (Reasonable Security Practices And Procedures And Sensitive Personal Data Of Information) Rules, 2011 enacted under the Information Technology Act, 2000, identification code of Your communication device which You use to access the Website, any other information that You provide during Your registration, use of availing of services via Website and other relevant documents viz; driving license and additional address cum identity proofs, as prescribed under the Membership Agreement of Spintrip. By providing information to create a user account or complete Your user profile, You expressly and voluntarily accept this Policy and You shall be deemed to have voluntarily consented to authenticate Yourself with a government-issued photo identity document which also contains your address, other than driver’s license, (hereafter “Government-issued ID”) and hereby give Your voluntary consent for seeding identification details as provided in Government-issued ID to all Membership requirements and to provide Your identity information for authentication for the purpose of availing of the Services and to enforce any breach committed by you of the Membership Agreement through police, government/enforcement authority or court of law.

        Vehicle Use Data: Vehicles will contain hardware that gathers and transmits information about vehicle use. This is done as a security measure against accident or theft and also to provide You with valuable services and information, such as other drivers data.

        Location Tracking: To prevent theft, and to allow us to locate You in case of emergency, accident, lock-out, etc., We track the location of your vehicle. Your location information will be confined to Spintrip’s service, and we endeavor not to make your location or movements public unless it is required under personal, medical, and legal (recovery and insurance) exigencies. As part of our service, the location of your vehicle may be released to insurance companies, the police, courts, tribunals, or similar law enforcement agencies, in the course of an investigation and/or accident claim, and to provide assistance in emergencies. Information regarding the location of each vehicle on Spintrip’s Website is also transmitted to Spintrip.

        Driver and Vehicle Information: As a member of Spintrip’s Website, you authorize us to access Your driver’s record, vehicle travel history report pertaining to Your ride/trip from all applicable entities and authorities’. Moreover, You authorize all DMVs, RMVs, auto mechanics, and all other entities and interested parties to release information to us regarding Your driving record and vehicle travel history.

        You have the right to request Spintrip to discontinue the use of Your personal information. To withdraw Your consent to our collection and processing of Your information in the future, You may do so by closing your account. However, the registered mobile number and transactional details shall be collected and stored in an anonymized manner for accounting and security purposes. Should you choose to sign up for your account using the existing number in our database, first-time user (“FTU”) discount benefits shall not be applicable to YOU and/or on YOUR account. Please note that in case there is an outstanding payable at your end or if there is an ongoing/upcoming booking or listing on the Spintrip Platform made by you, to withdraw your consent or seek deletion of data collected or being processed by us you shall have to clear the payables or complete/cancel the booking/listing (as the case may be).

        As you access and use our services we collect information such as, but not limited to - phone number, email address, device make-details, and IP address. We may disclose to third-party services certain information to ensure fraud prevention and PayLater checkout experience. The information may also be disclosed to third-party vendors like call centers and customer care vendors for the purpose of carrying out services as provided by Spintrip. Please refer to the third-party privacy policy for more details.

        Collection and Use of Non-Personal Information
        We also collect non-personal information – data in a form that does not permit direct association with any specific individual, including the browser You use, usage details, and identifying technologies. We may use, transfer, collect and disclose non-personal information for any purpose. If We do combine non-personal information with personal information, the combined information will be treated as personal information for as long as it remains combined.

        Aggregate Information:
        We may share non-personally identifiable information (such as referring/exit pages, anonymous usage data, and URLs, platform types, number of clicks, etc.) with interested third parties to help them understand the usage patterns for certain Spintrip services.

        Third-party ad servers or ad networks may serve advertisements on the Website. These third-party ad servers or ad networks may automatically receive Your internet protocol address when they serve ads to Your Internet browser. They may also use other technologies (such as cookies, JavaScript, or web beacons) to measure the effectiveness of their advertisements and to personalize the advertising content. However, please note that if an advertiser asks Spintrip to show an advertisement to a certain audience and you respond to that advertisement, the advertiser or ad-server may conclude that You fit the description of the audience they are trying to reach. Spintrip’s Policy does not apply to, and we cannot control the activities of, third-party advertisers.

        Cookies
        We use various technologies, including “cookies,” to collect non-identifiable information. A cookie is a piece of data that any website can send to Your browser, which may then be stored on Your computer as an anonymous tag that identifies Your computer but not You. To enhance Our Service, some Spintrip pages use cookies, sent by Spintrip or its third-party vendors, or other technologies. You may control the effect of cookies through Your browser settings, however, some features of Spintrip’s Service may not work properly if Your use of cookies is disabled.

        We may also use Web beacons or other technologies, often in conjunction with cookies, to enhance Our Service on a number of pages of Spintrip’s Website. A non-identifiable notice of a visitor’s visit to a page on Spintrip’s site is generated and recorded, which may be processed by us or by Our suppliers. To disable some of these features, You may disable cookies in Your web browser’s settings. Web beacons and other technologies will still detect visits to these pages, but the notices they generate are disregarded and cannot be associated with other non-identifiable cookie information.

        Information Sharing
        Spintrip only shares Personal Information with third parties in the following limited circumstances:

        To provide other businesses or persons for the purpose of processing personal information on our behalf. We require that these parties agree to process such information based on Our instructions and in compliance with this Policy and any other appropriate confidentiality and security measures.
        We have a good faith belief that access, use, preservation, or disclosure of such information is reasonably necessary to: (a) satisfy any applicable law, regulation, legal process, or enforceable governmental request, (b) enforce applicable Terms of Service, including investigation of potential violations thereof, (c) detect, prevent, or otherwise address fraud, security, or technical issues, or (d) protect against imminent harm to the rights, property, or safety of Spintrip, its users, or the public as required or permitted by law.
        This privacy policy will help you understand how Spintrip uses and protects the data you provide to us when you visit and use the website.

        We reserve the right to update this privacy policy at any time, so please check back periodically. By continuing to use the website after any changes to this privacy policy, you agree to accept those changes.

        If you have any questions or concerns about our privacy policy or data processing, please contact us at support@spintrip.in.
        `, { align: 'left', lineGap: 6 });
        
        doc.end();
        
        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(filePath));
            writeStream.on('error', (err) => reject(new Error('Error writing PDF file: ' + err.message)));
        });
    } catch (error) {
        console.error('Error fetching and generating Privacy Policy PDF:', error.message);
        throw error;
    }
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
const sendEmailWithAttachments = async (recipient, subject, bodyContent, attachments = []) => {
    setImmediate(async () => {
        try {
            let mailOptions = {
                from: 'info@spintrip.in',
                to: recipient,
                subject: subject,
                html: generateEmailTemplate(subject, bodyContent),
                attachments: [
                    {
                        filename: 'logo.png',
                        path: path.join(__dirname, 'logo.png'),
                        cid: 'logo',
                    },
                    ...attachments, // Add additional attachments provided as argument
                ],
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
    const legalContractPath = await generateLegalContractPDF(userEmail, hostEmail, bookingDetails);;
    const privacyPolicyPath = await fetchPrivacyPolicyPDF();
    console.log("done")
    // Send email to user
    sendEmailWithAttachments(userEmail, subject, bodyContent, [
        { filename: 'Legal_Contract.pdf', path: legalContractPath },
        { filename: 'Privacy_Policy.pdf', path: privacyPolicyPath },
    ]);

    // Send email to host
    sendEmailWithAttachments(hostEmail, 'Your Spintrip Booking is Approved', bodyContent, [
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
