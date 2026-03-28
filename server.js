require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const googleClient = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);

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
        if (fs.existsSync(DATA_FILE)) {
             fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
        }
    } catch (err) {
        console.error('[writeData] Failed to write data.json (likely Vercel read-only FS):', err.message);
        // Do not throw; allow the response to proceed as 200/201
    }
};

// --- API ROUTES FIRST ---

// GET /api/users - Get all users
app.get('/api/users', (req, res) => {
    const data = readData();
    res.json(data.users || []);
});

// GET /api/config - Provide non-secret frontend configuration
app.get('/api/config', (req, res) => {
    res.json({
        emailjs_public: process.env.EMAILJS_PUBLIC_KEY,
        emailjs_service: process.env.EMAILJS_SERVICE_ID,
        emailjs_contact: process.env.EMAILJS_TEMPLATE_ID_CONTACT,
        emailjs_donor: process.env.EMAILJS_TEMPLATE_ID_DONOR,
        google_client_id: process.env.GOOGLE_CLIENT_ID
    });
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
    res.status(201).json({ message: 'User registered successfully.', user: newUser });
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

// POST /api/google-auth - Verify Google ID Token and login/register
app.post('/api/google-auth', async (req, res) => {
    const { idToken, role } = req.body;
    console.log(`[Google Auth] Attempting login for role: ${role}`);

    if (!CLIENT_ID) {
        console.error('[Google Auth Error] GOOGLE_CLIENT_ID is not configured in .env file.');
        return res.status(500).json({ error: 'Server configuration error: GOOGLE_CLIENT_ID is missing.' });
    }

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, name, picture, sub: googleId } = payload;

        // Check if user exists in the specified role's data
        let userData = role === 'volunteer' ? readVolunteerData() : readData();
        
        // Ensure users array exists
        if (!userData.users) userData.users = [];
        
        let user = userData.users.find(u => u.email === email);

        if (!user) {
            console.log(`[Google Auth] New user detected: ${email}. Auto-registering as ${role}...`);
            // Auto-register user if they don't exist
            user = {
                id: Date.now(),
                name,
                email,
                photo: picture,
                googleId,
                role: role,
                password: 'google-auth-' + Math.random().toString(36).slice(-8), 
                phone: ''
            };
            userData.users.push(user);
            if (role === 'volunteer') {
                writeVolunteerData(userData);
            } else {
                writeData(userData);
            }
        } else {
            console.log(`[Google Auth] Existing user found: ${email}`);
            // Ensure role is updated if it was missing or different
            user.role = role; 
            // Update photo if changed
            if (picture && user.photo !== picture) {
                user.photo = picture;
                if (role === 'volunteer') {
                    writeVolunteerData(userData);
                } else {
                    writeData(userData);
                }
            }
        }

        // Return user with role for frontend redirection
        const userToReturn = { ...user, role: role };
        res.json({ message: 'Google Authentication successful.', user: userToReturn });
    } catch (err) {
        console.error('[Google Auth Error]:', err.message);
        res.status(401).json({ error: 'Invalid Google Identity token.' });
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
        if (fs.existsSync(VOLUNTEER_DATA_FILE)) {
            fs.writeFileSync(VOLUNTEER_DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
        }
    } catch (err) {
        console.error('[writeVolunteerData] Failed to write volunteer-data.json (likely Vercel read-only FS):', err.message);
        // Do not throw; allow the response to proceed as 200/201
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
    res.status(201).json({ message: 'Volunteer registered successfully.', user: newUser });
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
// Root route serves index.html from the 'public' folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static assets from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


setInterval(() => { }, 1000000);
