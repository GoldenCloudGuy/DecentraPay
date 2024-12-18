const express = require('express');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// Email sending endpoint
app.post('/send-email', async (req, res) => {
    const { to, subject, text } = req.body;

    if (!to || !subject || !text) {
        return res.status(400).json({ message: "Missing 'to', 'subject', or 'text' in request body" });
    }

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true, // true for port 465 (SSL)
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        // Send mail
        const info = await transporter.sendMail({
            from: `"DecentraPay" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            text
        });

        console.log("Email sent: ", info.messageId);
        res.status(200).json({ message: 'Email sent successfully!', messageId: info.messageId });
    } catch (error) {
        console.error("Error sending email: ", error);
        res.status(500).json({ message: 'Failed to send email', error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
