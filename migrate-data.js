require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// ---- Schemas (must match server.js) ----
const userSchema = new mongoose.Schema({
    id: { type: String, default: () => Date.now().toString() },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: String, phone: String, photo: String,
    googleId: String, role: { type: String, default: 'donor' }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const volunteerSchema = new mongoose.Schema({
    id: { type: String, default: () => Date.now().toString() },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: String, phone: String, photo: String,
    googleId: String, role: { type: String, default: 'volunteer' }
}, { timestamps: true });
const Volunteer = mongoose.model('Volunteer', volunteerSchema);

const donationSchema = new mongoose.Schema({
    id: { type: String, default: () => Date.now().toString() },
    userId: String, userName: String, donorName: String,
    donorType: String, phone: String, location: String,
    latitude: Number, longitude: Number,
    foodCategory: String, description: String,
    servings: Number, expiryTime: Date, foodPhoto: String,
    status: { type: String, default: 'pending' },
    claimedBy: String, timestamp: { type: Date, default: Date.now },

    // OLD FIELDS FOR BACKWARD COMPATIBILITY
    name: String, foodType: String, quantity: String,
    pickupLocation: String, contactNumber: String, notes: String,
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });
const Donation = mongoose.model('Donation', donationSchema);

async function migrate() {
    console.log('\n============================');
    console.log('   FWMS — Data Migration');
    console.log('============================\n');

    const uri = process.env.MONGODB_URI;
    // if (!uri || uri.includes('127.0.0.1')) {
    //     console.error('❌ ERROR: Please set a valid MongoDB Atlas URI in your .env file.');
    //     console.error('   MONGODB_URI=mongodb+srv://...\n');
    //     return process.exit(1);
    // }

    try {
        await mongoose.connect(uri);
        console.log('✅ Connected to MongoDB Atlas.\n');
    } catch (err) {
        console.error('❌ Failed to connect:', err.message);
        return process.exit(1);
    }

    let inserted = 0, skipped = 0;

    // ---- 1. Migrate Donors ----
    console.log('--- Migrating Donors ---');
    const dataPath = path.join(__dirname, 'data.json');
    if (fs.existsSync(dataPath)) {
        const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        const donors = data.users || [];
        console.log(`Found ${donors.length} donors in data.json`);
        for (const u of donors) {
            try {
                if (await User.findOne({ email: u.email })) {
                    console.log(`  - Skipped (exists): ${u.email}`);
                    skipped++;
                } else {
                    await new User({ ...u, role: 'donor' }).save();
                    console.log(`  + Inserted donor: ${u.email}`);
                    inserted++;
                }
            } catch (e) { console.error(`  ! Error: ${u.email} — ${e.message}`); }
        }

        // ---- 2. Migrate Donations ----
        console.log('\n--- Migrating Donations ---');
        const donations = data.donations || [];
        console.log(`Found ${donations.length} donations`);
        for (const d of donations) {
            try {
                if (await Donation.findOne({ id: d.id })) {
                    console.log(`  - Skipped (exists): ${d.id}`);
                    skipped++;
                } else {
                    await new Donation(d).save();
                    console.log(`  + Inserted donation from: ${d.donorName || d.id}`);
                    inserted++;
                }
            } catch (e) { console.error(`  ! Error: ${d.id} — ${e.message}`); }
        }
    } else {
        console.log('  (No data.json found — skipping)');
    }

    // ---- 3. Migrate Volunteers ----
    console.log('\n--- Migrating Volunteers ---');
    const volPath = path.join(__dirname, 'volunteer-data.json');
    if (fs.existsSync(volPath)) {
        const vData = JSON.parse(fs.readFileSync(volPath, 'utf8'));
        const volunteers = vData.users || [];
        console.log(`Found ${volunteers.length} volunteers`);
        for (const u of volunteers) {
            try {
                if (await Volunteer.findOne({ email: u.email })) {
                    console.log(`  - Skipped (exists): ${u.email}`);
                    skipped++;
                } else {
                    await new Volunteer({ ...u, role: 'volunteer' }).save();
                    console.log(`  + Inserted volunteer: ${u.email}`);
                    inserted++;
                }
            } catch (e) { console.error(`  ! Error: ${u.email} — ${e.message}`); }
        }
    } else {
        console.log('  (No volunteer-data.json found — skipping)');
    }

    console.log('\n============================');
    console.log(`✅ Migration Complete!`);
    console.log(`   Inserted : ${inserted}`);
    console.log(`   Skipped  : ${skipped}`);
    console.log('============================\n');

    await mongoose.disconnect();
    process.exit(0);
}

migrate();
