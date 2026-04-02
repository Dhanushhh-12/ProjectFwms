require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const googleClient = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const VOLUNTEER_DATA_FILE = path.join(__dirname, 'volunteer-data.json');

let isMongoConnected = false;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/FWMS')
    .then(() => {
        isMongoConnected = true;
        console.log('[INFO] Connected to MongoDB. Using MongoDB as data store.');
    }).catch((err) => {
        isMongoConnected = false;
        console.warn('[WARN] MongoDB not available, falling back to JSON files. Error:', err.message);
    });

mongoose.connection.on('connected', () => { isMongoConnected = true; });
mongoose.connection.on('disconnected', () => { isMongoConnected = false; });

// --- MONGOOSE MODELS ---
const userSchema = new mongoose.Schema({
    id: { type: String, default: () => Date.now().toString() },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    phone: { type: String },
    photo: { type: String },
    googleId: { type: String },
    role: { type: String, default: 'donor' }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const volunteerSchema = new mongoose.Schema({
    id: { type: String, default: () => Date.now().toString() },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    phone: { type: String },
    photo: { type: String },
    googleId: { type: String },
    role: { type: String, default: 'volunteer' }
}, { timestamps: true });
const Volunteer = mongoose.model('Volunteer', volunteerSchema);

const donationSchema = new mongoose.Schema({
    id: { type: String, default: () => Date.now().toString() },
    userId: String,
    userName: String,
    donorName: String,
    donorType: String,
    phone: String,
    location: String,
    latitude: Number,
    longitude: Number,
    foodCategory: String,
    description: String,
    servings: Number,
    expiryTime: Date,
    foodPhoto: String,
    status: { type: String, default: 'pending' },
    claimedBy: String,
    timestamp: { type: Date, default: Date.now },

    // OLD FIELDS FOR BACKWARD COMPATIBILITY
    name: String,
    foodType: String,
    quantity: String,
    pickupLocation: String,
    contactNumber: String,
    notes: String,
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
const Donation = mongoose.model('Donation', donationSchema);

// --- JSON FILE HELPERS (fallback) ---
const readJSON = (file) => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { return { users: [], donations: [] }; }
};
const writeJSON = (file, data) => {
    try { fs.writeFileSync(file, JSON.stringify(data, null, 4), 'utf8'); }
    catch (err) { console.error('[writeJSON] Failed:', err.message); }
};

// --- STARTUP CHECKS ---
if (!process.env.GOOGLE_CLIENT_ID) {
    console.warn('[WARNING] GOOGLE_CLIENT_ID NOT SET! Google Auth will NOT work.');
} else {
    console.log('[INFO] GOOGLE_CLIENT_ID is configured.');
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use((req, res, next) => {
    console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
    next();
});

// --- API ROUTES ---

app.get('/api/users', async (req, res) => {
    try {
        let users;
        if (isMongoConnected) {
            users = await User.find({}).lean();
        } else {
            users = readJSON(DATA_FILE).users || [];
        }
        const safeUsers = users.map(({ password, googleId, ...u }) => u);
        res.json(safeUsers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

app.get('/api/config', (req, res) => {
    res.json({
        emailjs_public: process.env.EMAILJS_PUBLIC_KEY,
        emailjs_service: process.env.EMAILJS_SERVICE_ID,
        emailjs_contact: process.env.EMAILJS_TEMPLATE_ID_CONTACT,
        emailjs_donor: process.env.EMAILJS_TEMPLATE_ID_DONOR,
        google_client_id: process.env.GOOGLE_CLIENT_ID,
        app_version: "3.0.0-mongo-fallback"
    });
});

// POST /api/register
app.post('/api/register', async (req, res) => {
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

    // Sanitize photo
    if (newUser.photo && typeof newUser.photo === 'string') {
        if (!newUser.photo.startsWith('data:')) newUser.photo = null;
    } else {
        newUser.photo = null;
    }

    try {
        if (isMongoConnected) {
            const exists = await User.findOne({ email: newUser.email });
            if (exists) return res.status(400).json({ error: 'Email already registered.' });
            const saved = new User(newUser);
            await saved.save();
            return res.status(201).json({ message: 'User registered successfully.', user: saved });
        } else {
            // JSON fallback
            const data = readJSON(DATA_FILE);
            if (!data.users) data.users = [];
            if (data.users.find(u => u.email === newUser.email)) {
                return res.status(400).json({ error: 'Email already registered.' });
            }
            newUser.id = Date.now().toString();
            data.users.push(newUser);
            writeJSON(DATA_FILE, data);
            return res.status(201).json({ message: 'User registered successfully.', user: newUser });
        }
    } catch (err) {
        console.error('[POST /api/register] Error:', err);
        res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user;
        if (isMongoConnected) {
            user = await User.findOne({ email, password }).lean();
        } else {
            const data = readJSON(DATA_FILE);
            user = (data.users || []).find(u => u.email === email && u.password === password);
        }
        if (user) res.json({ message: 'Login successful.', user });
        else res.status(401).json({ error: 'Invalid email or password.' });
    } catch (err) {
        console.error('[POST /api/login] Error:', err);
        res.status(500).json({ error: 'Login failed: ' + err.message });
    }
});

// POST /api/google-auth
app.post('/api/google-auth', async (req, res) => {
    const { idToken, role } = req.body;
    console.log(`[Google Auth] Attempting login for role: ${role}`);

    if (!CLIENT_ID) {
        return res.status(500).json({ error: 'Server configuration error: GOOGLE_CLIENT_ID is missing.' });
    }

    try {
        const ticket = await googleClient.verifyIdToken({ idToken, audience: CLIENT_ID });
        const payload = ticket.getPayload();
        const { email, name, picture, sub: googleId } = payload;

        if (isMongoConnected) {
            const Model = role === 'volunteer' ? Volunteer : User;
            let user = await Model.findOne({ email });
            if (!user) {
                user = new Model({
                    id: Date.now().toString(), name, email,
                    photo: picture, googleId, role,
                    password: 'google-auth-' + Math.random().toString(36).slice(-8),
                    phone: ''
                });
                await user.save();
            } else {
                let updated = false;
                if (user.role !== role) { user.role = role; updated = true; }
                if (picture && user.photo !== picture) { user.photo = picture; updated = true; }
                if (updated) await user.save();
            }
            return res.json({ message: 'Google Authentication successful.', user: { ...user.toObject(), role } });
        } else {
            // JSON fallback
            const file = role === 'volunteer' ? VOLUNTEER_DATA_FILE : DATA_FILE;
            const data = readJSON(file);
            if (!data.users) data.users = [];
            let user = data.users.find(u => u.email === email);
            if (!user) {
                user = {
                    id: Date.now().toString(), name, email,
                    photo: picture, googleId, role,
                    password: 'google-auth-' + Math.random().toString(36).slice(-8),
                    phone: ''
                };
                data.users.push(user);
                writeJSON(file, data);
            }
            return res.json({ message: 'Google Authentication successful.', user: { ...user, role } });
        }
    } catch (err) {
        console.error('[Google Auth Error]:', err.message);
        res.status(401).json({ error: 'Invalid Google Identity token.' });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        let user;
        if (isMongoConnected) {
            user = await User.findOne({ email }).lean();
        } else {
            const data = readJSON(DATA_FILE);
            user = (data.users || []).find(u => u.email === email);
        }
        if (user) {
            const hint = `${user.password.substring(0, 2)}${'•'.repeat(user.password.length - 2)}`;
            res.json({ hint });
        } else {
            res.status(404).json({ error: 'No account found with this email.' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Error: ' + err.message });
    }
});

// --- Donation Endpoints ---
app.get('/api/donations', async (req, res) => {
    try {
        let donations;
        if (isMongoConnected) {
            donations = await Donation.find({}).lean();
        } else {
            donations = readJSON(DATA_FILE).donations || [];
        }
        res.json(donations);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch donations.' });
    }
});

// --- Haversine Distance Function ---
function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.get('/api/nearby-donors', async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required.' });
    try {
        let allDonations;
        if (isMongoConnected) {
            allDonations = await Donation.find({ status: 'pending' }).lean();
        } else {
            allDonations = (readJSON(DATA_FILE).donations || []).filter(d => d.status === 'pending');
        }
        const nearby = allDonations
            .filter(d => d.latitude && d.longitude)
            .map(d => ({ ...d, distance: Math.round(getDistanceKm(parseFloat(lat), parseFloat(lng), d.latitude, d.longitude) * 10) / 10 }))
            .filter(d => d.distance <= 10)
            .sort((a, b) => a.distance - b.distance);
        res.json(nearby);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch nearby donors.' });
    }
});

app.post('/api/donations', async (req, res) => {
    try {
        let donation;
        if (isMongoConnected) {
            donation = new Donation(req.body);
            await donation.save();
        } else {
            const data = readJSON(DATA_FILE);
            if (!data.donations) data.donations = [];
            donation = { ...req.body, id: Date.now().toString() };
            data.donations.push(donation);
            writeJSON(DATA_FILE, data);
        }
        console.log('Donation saved.');
        res.status(201).json({ message: 'Donation added successfully.', donation });
    } catch (err) {
        console.error('[POST /api/donations] Error:', err);
        res.status(500).json({ error: 'Failed to save donation: ' + err.message });
    }
});

app.put('/api/donations/:id/claim', async (req, res) => {
    const { id } = req.params;
    const { volunteerEmail } = req.body;
    try {
        if (isMongoConnected) {
            const donation = await Donation.findOne({ id });
            if (!donation) return res.status(404).json({ error: 'Donation not found.' });
            donation.status = 'claimed';
            donation.claimedBy = volunteerEmail;
            await donation.save();
            return res.json({ message: 'Donation claimed.', donation });
        } else {
            const data = readJSON(DATA_FILE);
            const idx = (data.donations || []).findIndex(d => d.id == id);
            if (idx === -1) return res.status(404).json({ error: 'Donation not found.' });
            data.donations[idx].status = 'claimed';
            data.donations[idx].claimedBy = volunteerEmail;
            writeJSON(DATA_FILE, data);
            return res.json({ message: 'Donation claimed.', donation: data.donations[idx] });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to claim donation: ' + err.message });
    }
});

// --- Volunteer Endpoints ---
app.post('/api/volunteer/register', async (req, res) => {
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

    if (newUser.photo && typeof newUser.photo === 'string') {
        if (!newUser.photo.startsWith('data:')) newUser.photo = null;
    } else { newUser.photo = null; }

    try {
        if (isMongoConnected) {
            const exists = await Volunteer.findOne({ email: newUser.email });
            if (exists) return res.status(400).json({ error: 'Email already registered.' });
            const saved = new Volunteer(newUser);
            await saved.save();
            return res.status(201).json({ message: 'Volunteer registered successfully.', user: saved });
        } else {
            const data = readJSON(VOLUNTEER_DATA_FILE);
            if (!data.users) data.users = [];
            if (data.users.find(u => u.email === newUser.email)) {
                return res.status(400).json({ error: 'Email already registered.' });
            }
            newUser.id = Date.now().toString();
            data.users.push(newUser);
            writeJSON(VOLUNTEER_DATA_FILE, data);
            return res.status(201).json({ message: 'Volunteer registered successfully.', user: newUser });
        }
    } catch (err) {
        console.error('[POST /api/volunteer/register] Error:', err);
        res.status(500).json({ error: 'Registration failed: ' + err.message });
    }
});

app.post('/api/volunteer/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user;
        if (isMongoConnected) {
            user = await Volunteer.findOne({ email, password }).lean();
        } else {
            const data = readJSON(VOLUNTEER_DATA_FILE);
            user = (data.users || []).find(u => u.email === email && u.password === password);
        }
        if (user) res.json({ message: 'Login successful.', user });
        else res.status(401).json({ error: 'Invalid email or password.' });
    } catch (err) {
        res.status(500).json({ error: 'Login failed: ' + err.message });
    }
});

app.post('/api/volunteer/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        let user;
        if (isMongoConnected) {
            user = await Volunteer.findOne({ email }).lean();
        } else {
            const data = readJSON(VOLUNTEER_DATA_FILE);
            user = (data.users || []).find(u => u.email === email);
        }
        if (user) {
            const hint = `${user.password.substring(0, 2)}${'•'.repeat(user.password.length - 2)}`;
            res.json({ hint });
        } else res.status(404).json({ error: 'No account found.' });
    } catch (err) {
        res.status(500).json({ error: 'Error: ' + err.message });
    }
});

app.get('/api/volunteers', async (req, res) => {
    try {
        let volunteers;
        if (isMongoConnected) {
            volunteers = await Volunteer.find({}).lean();
        } else {
            volunteers = readJSON(VOLUNTEER_DATA_FILE).users || [];
        }
        const safe = volunteers.map(({ password, googleId, ...u }) => u);
        res.json(safe);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch volunteers.' });
    }
});

// --- API 404 HANDLER ---
app.all('/api/*path', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

// --- STATIC FILES ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database mode: ${isMongoConnected ? 'MongoDB' : 'JSON files (fallback)'}`);
});

setInterval(() => { }, 1000000);
