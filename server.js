const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Global Request Logger for Debugging
app.use((req, res, next) => {
    console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
    next();
});

// Helper to read data
const readData = () => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { users: [], donations: [] };
    }
};

// Helper to write data
const writeData = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
    } catch (err) {
        console.error('[writeData] Failed to write data.json:', err.message);
        throw err;
    }
};

// --- API ROUTES FIRST ---

// GET /api/users - Get all users
app.get('/api/users', (req, res) => {
    const data = readData();
    res.json(data.users || []);
});

// POST /api/register - Register a new user
app.post('/api/register', (req, res) => {
    const data = readData();
    const newUser = req.body || {};

    // Basic server-side validation
    const validateUser = (u) => {
        if (!u.name || typeof u.name !== 'string' || u.name.trim().length < 2) return 'Invalid name.';
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!u.email || !emailRe.test(u.email)) return 'Invalid email format.';
        if (!u.password || typeof u.password !== 'string' || u.password.length < 6) return 'Password must be at least 6 characters.';
        const phoneRe = /^\+?[0-9\s\-]{7,20}$/;
        if (u.phone && !phoneRe.test(u.phone)) return 'Invalid phone number format.';
        return null;
    };

    const vErr = validateUser(newUser);
    if (vErr) return res.status(400).json({ error: vErr });

    if (!data.users) data.users = [];
    const exists = data.users.find(u => u.email === newUser.email);
    if (exists) {
        return res.status(400).json({ error: 'Email already registered.' });
    }

    // Sanitize photo: accept data URLs only, otherwise clear
    if (newUser.photo && typeof newUser.photo === 'string') {
        if (!newUser.photo.startsWith('data:')) {
            // if upstream provided a large or malformed string, drop it
            newUser.photo = null;
        }
    } else {
        newUser.photo = null;
    }

    data.users.push(newUser);
    writeData(data);
    res.status(201).json({ message: 'User registered successfully.' });
});

// POST /api/login - Authenticate a user
app.post('/api/login', (req, res) => {
    const data = readData();
    const { email, password } = req.body;

    const user = (data.users || []).find(u => u.email === email && u.password === password);
    if (user) {
        res.json({ message: 'Login successful.', user });
    } else {
        res.status(401).json({ error: 'Invalid email or password.' });
    }
});

app.post('/api/forgot-password', (req, res) => {
    const data = readData();
    const { email } = req.body;

    const user = (data.users || []).find(u => u.email === email);
    if (user) {
        const hint = `${user.password.substring(0, 2)}${'•'.repeat(user.password.length - 2)}`;
        res.json({ hint });
    } else {
        res.status(404).json({ error: 'No account found with this email.' });
    }
});

// --- Donation Endpoints ---
app.get('/api/donations', (req, res) => {
    const data = readData();
    res.json(data.donations || []);
});

app.post('/api/donations', (req, res) => {
    console.log('Received new donation request...');
    const data = readData();
    if (!data.donations) data.donations = [];

    const newDonation = req.body;
    data.donations.push(newDonation);
    writeData(data);
    console.log('Donation saved successfully to data.json');
    res.status(201).json({ message: 'Donation added successfully.', donation: newDonation });
});

app.put('/api/donations/:id/claim', (req, res) => {
    const { id } = req.params;
    const { volunteerEmail } = req.body;
    const data = readData();

    const index = (data.donations || []).findIndex(d => d.id == id);
    if (index !== -1) {
        data.donations[index].status = 'claimed';
        data.donations[index].claimedBy = volunteerEmail;
        writeData(data);
        res.json({ message: 'Donation claimed successfully.', donation: data.donations[index] });
    } else {
        res.status(404).json({ error: 'Donation not found.' });
    }
});

// --- Volunteer API Endpoints ---
const VOLUNTEER_DATA_FILE = path.join(__dirname, 'volunteer-data.json');

const readVolunteerData = () => {
    try {
        const data = fs.readFileSync(VOLUNTEER_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) { return { users: [] }; }
};

const writeVolunteerData = (data) => {
    try {
        fs.writeFileSync(VOLUNTEER_DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
    } catch (err) {
        console.error('[writeVolunteerData] Failed to write volunteer-data.json:', err.message);
        throw err;
    }
};

app.post('/api/volunteer/register', (req, res) => {
    const data = readVolunteerData();
    const newUser = req.body || {};

    const validateUser = (u) => {
        if (!u.name || typeof u.name !== 'string' || u.name.trim().length < 2) return 'Invalid name.';
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!u.email || !emailRe.test(u.email)) return 'Invalid email format.';
        if (!u.password || typeof u.password !== 'string' || u.password.length < 6) return 'Password must be at least 6 characters.';
        const phoneRe = /^\+?[0-9\s\-]{7,20}$/;
        if (u.phone && !phoneRe.test(u.phone)) return 'Invalid phone number format.';
        return null;
    };

    const vErr = validateUser(newUser);
    if (vErr) return res.status(400).json({ error: vErr });

    if (!data.users) data.users = [];
    const exists = data.users.find(u => u.email === newUser.email);
    if (exists) return res.status(400).json({ error: 'Email already registered.' });

    if (newUser.photo && typeof newUser.photo === 'string') {
        if (!newUser.photo.startsWith('data:')) newUser.photo = null;
    } else {
        newUser.photo = null;
    }

    data.users.push(newUser);
    writeVolunteerData(data);
    res.status(201).json({ message: 'Volunteer registered successfully.' });
});

app.post('/api/volunteer/login', (req, res) => {
    const data = readVolunteerData();
    const { email, password } = req.body;
    const user = (data.users || []).find(u => u.email === email && u.password === password);
    if (user) res.json({ message: 'Login successful.', user });
    else res.status(401).json({ error: 'Invalid email or password.' });
});

app.post('/api/volunteer/forgot-password', (req, res) => {
    const data = readVolunteerData();
    const { email } = req.body;
    const user = (data.users || []).find(u => u.email === email);
    if (user) {
        const hint = `${user.password.substring(0, 2)}${'•'.repeat(user.password.length - 2)}`;
        res.json({ hint });
    } else res.status(404).json({ error: 'No account found.' });
});

// --- API 404 HANDLER ---
// Must use app.all with wildcard — app.use('/api') in Express 5 intercepts
// ALL /api/* routes (even matched ones), breaking registration & login.
app.all('/api/*path', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} /api/${req.params.path}` });
});

// --- STATIC FILES LAST ---
app.use(express.static(__dirname));

const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


setInterval(() => { }, 1000000);
