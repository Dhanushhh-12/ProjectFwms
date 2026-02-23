require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Allow requests from the HTML frontend
app.use(cors());
app.use(express.json());

// --- Health Check ---
app.get('/', (req, res) => {
    res.json({ status: 'FWMS SMS Server is running!' });
});

// --- SMS Endpoint ---
app.post('/api/send-sms', async (req, res) => {
    const { name, email, message } = req.body;

    // Basic validation
    if (!name || !email || !message) {
        return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    const smsText = `FWMS Contact:\nName: ${name}\nEmail: ${email}\nMsg: ${message}`;

    try {
        const response = await axios.post(
            'https://www.fast2sms.com/dev/bulkV2',
            {
                route: 'q',
                message: smsText,
                language: 'english',
                flash: 0,
                numbers: process.env.RECIPIENT_PHONE
            },
            {
                headers: {
                    authorization: process.env.FAST2SMS_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data.return) {
            console.log(`✅ SMS sent successfully to ${process.env.RECIPIENT_PHONE}`);
            return res.json({ success: true, message: 'SMS sent successfully!' });
        } else {
            console.error('❌ Fast2SMS error:', response.data);
            return res.status(500).json({ success: false, error: 'SMS sending failed.', details: response.data });
        }
    } catch (err) {
        console.error('❌ Server error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 FWMS SMS Server running at http://localhost:${PORT}`);
    console.log(`   Recipient: +91 ${process.env.RECIPIENT_PHONE}`);
});
