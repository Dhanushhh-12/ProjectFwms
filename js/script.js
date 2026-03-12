// EmailJS Initialization Placeholder
// Replace these with your actual keys from EmailJS Dashboard
const EMAILJS_PUBLIC_KEY = "buSCnAcqcxD13_E_g";
const EMAILJS_SERVICE_ID = "service_iyh2kcs";
const EMAILJS_TEMPLATE_ID_CONTACT = "template_5bz428h";
const EMAILJS_TEMPLATE_ID_DONOR = "template_1j27g9j";

// Allow configuring a backend URL from the hosting environment (e.g. Netlify).
// On Netlify set an environment variable `API_BASE` and inject it into the site
// by adding a small script in your HTML that sets `window.API_BASE` to the URL.
const API_BASE = window.API_BASE || '';
const __orig_fetch = window.fetch.bind(window);
window.fetch = (input, init) => {
    try {
        if (typeof input === 'string' && input.startsWith('/api/')) input = API_BASE + input;
    } catch (e) { /* ignore */ }
    return __orig_fetch(input, init);
};

(function () {
    // Initialize EmailJS
    if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }

    // --- Dynamic UI Enhancements ---
    const updateHeader = () => {
        const header = document.querySelector('header');
        if (window.scrollY > 20) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };

    const updateScrollProgress = () => {
        const scrollBar = document.getElementById('scroll-progress');
        if (!scrollBar) return;
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        scrollBar.style.width = scrolled + "%";
    };

    const trackActiveNavLink = () => {
        const sections = document.querySelectorAll('section[id]');
        const scrollPos = window.scrollY + 100;

        sections.forEach(section => {
            if (scrollPos >= section.offsetTop && scrollPos < section.offsetTop + section.offsetHeight) {
                const id = section.getAttribute('id');
                document.querySelectorAll('.nav-links a').forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}` || (id === 'home' && link.getAttribute('href') === 'index.html')) {
                        link.classList.add('active');
                    }
                });
            }
        });
    };

    // Suble Hero Parallax
    const handleHeroParallax = (e) => {
        const visual = document.querySelector('.hero-visual');
        if (!visual) return;
        const x = (window.innerWidth - e.pageX * 2) / 100;
        const y = (window.innerHeight - e.pageY * 2) / 100;
        visual.style.transform = `translateX(${x}px) translateY(${y}px)`;
    };

    window.addEventListener('scroll', () => {
        updateHeader();
        updateScrollProgress();
        trackActiveNavLink();
    });

    window.addEventListener('mousemove', handleHeroParallax);

    // Scroll Reveal Logic
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -80px 0px'
    });

    window.addEventListener('DOMContentLoaded', () => {
        const reveals = document.querySelectorAll('.reveal');
        reveals.forEach(el => revealObserver.observe(el));

        updateHeader();

        // --- Protocol Check ---
        if (window.location.protocol === 'file:') {
            alert('⚠️ Important: You are opening this via File Explorer. Please open http://localhost:3000 in your browser instead so the system can connect to the database.');
        }
    });
})();

// --- Authentication & Data Persistence ---

const USERS_KEY = 'fwms_users';
const SESSION_KEY = 'fwms_current_user';
const VOLUNTEER_SESSION_KEY = 'fwms_current_volunteer';
const DONATIONS_KEY = 'fwms_donations';

/**
 * Enhanced Fetch Wrapper to handle non-JSON responses gracefully
 */
async function apiFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Server error: ${response.status}`);
            return data;
        } else {
            // Not JSON - likely an HTML error page from the server
            const text = await response.text();
            console.error('Non-JSON Response:', text);
            throw new Error(`Server returned HTML instead of JSON. Check if the API route '${url}' exists in server.js.`);
        }
    } catch (err) {
        console.error(`Fetch Error (${url}):`, err);
        throw err;
    }
}

/**
 * Get all registered users from backend
 */
async function getUsers() {
    try {
        return await apiFetch('/api/users');
    } catch (err) {
        console.error('getUsers Failed:', err);
        return [];
    }
}


/**
 * Get current logged in user
 */
function getCurrentUser() {
    const user = localStorage.getItem(SESSION_KEY);
    return user ? JSON.parse(user) : null;
}

/**
 * Get current logged in volunteer
 */
function getVolunteerSession() {
    const user = localStorage.getItem(VOLUNTEER_SESSION_KEY);
    return user ? JSON.parse(user) : null;
}

/**
 * Update UI based on auth state
 */
function updateAuthUI() {
    const user = getCurrentUser();
    const volunteer = getVolunteerSession();
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    // Remove existing auth links
    const existingAuthLinks = navLinks.querySelectorAll('.auth-link');
    existingAuthLinks.forEach(link => link.remove());

    const activeSession = user || volunteer;
    const isVolunteer = !!volunteer;

    if (activeSession) {
        // Logged In state
        const profilePhotoImg = activeSession.photo ?
            `<img src="${activeSession.photo}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">` :
            `<span style="font-size: 1.2rem;">👤</span>`;

        const profileLink = isVolunteer ? 'volunteer-profile.html' : 'profile.html';

        // Filter navigation links based on role
        const allNavLinks = navLinks.querySelectorAll('a');
        allNavLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (isVolunteer && href === 'donor.html') {
                link.parentElement.style.display = 'none'; // Hide Donor link for volunteers
            } else if (!isVolunteer && href === 'volunteer.html') {
                link.parentElement.style.display = 'none'; // Hide Volunteer link for donors
            } else {
                link.parentElement.style.display = 'block'; // Ensure correct link is shown
            }
        });

        const roleLabel = isVolunteer ? '<span style="font-size: 0.75rem; background: #e65100; color: white; padding: 2px 6px; border-radius: 4px; margin-right: 5px;">Volunteer</span>' : '';

        const userLi = document.createElement('li');
        userLi.className = 'auth-link';
        userLi.innerHTML = `
            <a href="${profileLink}" style="display: flex; align-items: center; gap: 8px; border: 1px solid rgba(255,255,255,0.2); padding: 5px 12px; border-radius: 20px; background: rgba(255,255,255,0.1);">
                ${profilePhotoImg}
                <div style="display: flex; flex-direction: column; line-height: 1.1;">
                    <span style="color: var(--white); font-weight: 600;">${activeSession.name.split(' ')[0]}</span>
                    ${roleLabel}
                </div>
            </a>
        `;

        const logoutLi = document.createElement('li');
        logoutLi.className = 'auth-link';
        logoutLi.innerHTML = `<a href="#" id="logoutBtn" style="color: #ff9800;">Logout</a>`;

        navLinks.appendChild(userLi);
        navLinks.appendChild(logoutLi);

        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(VOLUNTEER_SESSION_KEY);
            alert('Logged out successfully.');
            window.location.href = 'index.html';
        });
    } else {
        // Logged Out state - show both entry points or handle as needed
        const allNavLinks = navLinks.querySelectorAll('a');
        allNavLinks.forEach(link => {
            // By default let them see both if they are entry points
            link.parentElement.style.display = 'block';
        });
        const loginLi = document.createElement('li');
        loginLi.className = 'auth-link';
        loginLi.innerHTML = `<a href="login.html">Login</a>`;

        const regLi = document.createElement('li');
        regLi.className = 'auth-link';
        regLi.innerHTML = `<a href="register.html">Register</a>`;

        navLinks.appendChild(loginLi);
        navLinks.appendChild(regLi);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateAuthUI();

    // Register Photo Preview
    const regPhotoInput = document.getElementById('profilePhoto');
    const photoPreview = document.getElementById('photoPreview');
    let regPhotoBase64 = null;

    if (regPhotoInput && photoPreview) {
        regPhotoInput.addEventListener('change', function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    regPhotoBase64 = e.target.result;
                    photoPreview.innerHTML = `<img src="${regPhotoBase64}" style="width: 100%; height: 100%; object-fit: cover;">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Register Form Handling
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = 'Registering...';

            const formData = new FormData(registerForm);
            const role = formData.get('role');
            const endpoint = role === 'volunteer' ? '/api/volunteer/register' : '/api/register';

            const userData = {
                name: formData.get('name'),
                email: formData.get('email'),
                password: formData.get('password'),
                phone: formData.get('phone'),
                photo: regPhotoBase64 // Store photo as Base64
            };

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });

                const result = await response.json();

                if (response.ok) {
                    alert('Registration successful! You can now login.');
                    window.location.href = 'login.html';
                } else {
                    alert(result.error || 'Registration failed.');
                }
            } catch (err) {
                console.error('Registration Error:', err);
                let errorMsg = 'An error occurred during registration.';

                if (window.location.protocol === 'file:') {
                    errorMsg += '\n\n⚠️ CRITICAL: You are running this via "file://" protocol. Please use a local server (e.g., http://localhost:3000) for registration to work.';
                } else if (err.message.includes('Failed to fetch')) {
                    errorMsg += '\n\n⚠️ Server Connection Failed: Ensure the backend server is running and accessible.';
                } else {
                    errorMsg += `\n\nDetails: ${err.message}`;
                }
                alert(errorMsg);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
            }
        });
    }

    // Login Form Handling
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = 'Signing In...';

            const formData = new FormData(loginForm);
            const email = formData.get('email');
            const password = formData.get('password');
            const role = formData.get('role');

            const endpoint = role === 'volunteer' ? '/api/volunteer/login' : '/api/login';

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();

                if (response.ok) {
                    if (role === 'volunteer') {
                        localStorage.setItem(VOLUNTEER_SESSION_KEY, JSON.stringify(result.user));
                    } else {
                        localStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
                    }
                    alert(`Welcome back, ${result.user.name}!`);
                    window.location.href = role === 'volunteer' ? 'volunteer-profile.html' : 'profile.html';
                } else {
                    alert(result.error || 'Invalid email or password.');
                }
            } catch (err) {
                console.error('Login Error:', err);
                let errorMsg = 'An error occurred during login.';

                if (window.location.protocol === 'file:') {
                    errorMsg += '\n\n⚠️ CRITICAL: You are running this via "file://" protocol. Please use a local server (e.g., http://localhost:3000) for login to work.';
                } else if (err.message.includes('Failed to fetch')) {
                    errorMsg += '\n\n⚠️ Server Connection Failed: Ensure the backend server is running and accessible.';
                } else {
                    errorMsg += `\n\nDetails: ${err.message}`;
                }
                alert(errorMsg);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
            }
        });
    }

    // Volunteer Register Form Handling
    const volunteerRegisterForm = document.getElementById('volunteerRegisterForm');
    if (volunteerRegisterForm) {
        const volPhotoInput = document.getElementById('volunteerProfilePhoto');
        const volPhotoPreview = document.getElementById('volunteerPhotoPreview');
        let volPhotoBase64 = null;

        if (volPhotoInput && volPhotoPreview) {
            volPhotoInput.addEventListener('change', function () {
                const file = this.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                        volPhotoBase64 = e.target.result;
                        volPhotoPreview.innerHTML = `<img src="${volPhotoBase64}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        volunteerRegisterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = volunteerRegisterForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = 'Registering...';

            const formData = new FormData(volunteerRegisterForm);

            const userData = {
                name: formData.get('name'),
                email: formData.get('email'),
                password: formData.get('password'),
                phone: formData.get('phone'),
                photo: volPhotoBase64
            };

            try {
                const response = await fetch('/api/volunteer/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData)
                });

                const result = await response.json();

                if (response.ok) {
                    alert('Volunteer registration successful!');
                    window.location.href = 'volunteer-login.html';
                } else {
                    alert(result.error || 'Registration failed.');
                }
            } catch (err) {
                console.error('API Error:', err);
                alert('An error occurred during registration.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
            }
        });
    }

    // Volunteer Login Form Handling
    const volunteerLoginForm = document.getElementById('volunteerLoginForm');
    if (volunteerLoginForm) {
        volunteerLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = volunteerLoginForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = 'Signing In...';

            const formData = new FormData(volunteerLoginForm);
            const email = formData.get('email');
            const password = formData.get('password');

            try {
                const response = await fetch('/api/volunteer/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const result = await response.json();

                if (response.ok) {
                    localStorage.setItem('fwms_current_volunteer', JSON.stringify(result.user));
                    alert(`Welcome back, volunteer ${result.user.name}!`);
                    window.location.href = 'index.html';
                } else {
                    alert(result.error || 'Invalid email or password.');
                }
            } catch (err) {
                console.error('API Error:', err);
                alert('An error occurred during login.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalText;
            }
        });
    }

    // --- Image Compression Utility ---
    const compressImage = (file, maxWidth = 800) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const scale = maxWidth / img.width;
                    if (scale < 1) {
                        canvas.width = maxWidth;
                        canvas.height = img.height * scale;
                    } else {
                        canvas.width = img.width;
                        canvas.height = img.height;
                    }
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    // Compress as JPEG with 0.7 quality
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
            };
        });
    };

    // Image Preview & Compression for Donor Page
    const foodImageInput = document.getElementById('foodImage');
    const imagePreview = document.getElementById('imagePreview');
    const compressedInput = document.getElementById('compressedImage');

    if (foodImageInput && imagePreview) {
        foodImageInput.addEventListener('change', async function () {
            const file = this.files[0];
            if (file) {
                imagePreview.innerHTML = '<p style="color: var(--primary-color);">Compressing image...</p>';
                const compressedData = await compressImage(file);
                window.lastDonationPhoto = compressedData;
                if (compressedInput) compressedInput.value = compressedData;
                imagePreview.innerHTML = `<img src="${compressedData}" alt="Food Preview" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">`;
                console.log("Image compressed successfully.");
            }
        });
    }

    // Mobile Menu Toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            mobileMenuBtn.innerText = navLinks.classList.contains('active') ? '✕' : '☰';
        });
    }

    // Contact Form Submission
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleFormSubmit(contactForm, EMAILJS_TEMPLATE_ID_CONTACT);
        });
    }

    // Donor Form Submission
    const donorForm = document.getElementById('donorForm');
    if (donorForm) {
        // Protect page directly if on donor.html
        const user = getCurrentUser();
        if (!user) {
            alert('Please login to submit a donation.');
            window.location.href = 'login.html';
            return;
        }

        donorForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = donorForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerText;
            submitBtn.disabled = true;
            submitBtn.innerText = 'Submitting...';

            const formData = new FormData(donorForm);
            const donation = {
                id: Date.now(),
                userId: user.email,
                userName: user.name,
                donorName: formData.get('donor_name'),
                phone: formData.get('phone'),
                location: formData.get('location'),
                description: formData.get('description'),
                foodPhoto: window.lastDonationPhoto,
                status: 'pending',
                timestamp: new Date().toISOString()
            };

            try {
                // Save to Backend using robust helper
                await apiFetch('/api/donations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(donation)
                });

                // Send Email via EmailJS as well
                if (typeof emailjs !== 'undefined') {
                    emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID_DONOR, donorForm)
                        .then(() => console.log("Email notification sent"))
                        .catch(err => console.error("Email notification failed", err));
                }

                alert('Success! Your donation request has been submitted.');
                donorForm.reset();
                const preview = document.getElementById('imagePreview');
                if (preview) preview.innerHTML = '';
                window.lastDonationPhoto = null;
            } catch (err) {
                alert(`Submission Failed: ${err.message}`);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
            }
        });
    }

    // Proactive Donor Link Protection
    const donorLinks = document.querySelectorAll('a[href="donor.html"]');
    donorLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            if (!getCurrentUser()) {
                e.preventDefault();
                alert('Access restricted. Please login to become a donor.');
                window.location.href = 'login.html';
            }
        });
    });
});

/**
 * Handle form submission using EmailJS
 * @param {HTMLFormElement} form
 * @param {string} templateId
 */
function handleFormSubmit(form, templateId) {
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerText;

    submitBtn.disabled = true;
    submitBtn.innerText = 'Sending...';

    console.log(`Sending form using template: ${templateId}`);

    if (EMAILJS_PUBLIC_KEY === "YOUR_PUBLIC_KEY") {
        setTimeout(() => {
            alert('Success! Data saved and notification sent (Simulated).');
            form.reset();
            const preview = document.getElementById('imagePreview');
            if (preview) preview.innerHTML = '';
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        }, 1000);
        return;
    }

    emailjs.sendForm(EMAILJS_SERVICE_ID, templateId, form)
        .then(() => {
            alert('Success! Your request has been sent.');
            form.reset();
            const preview = document.getElementById('imagePreview');
            if (preview) preview.innerHTML = '';
        })
        .catch((error) => {
            console.error('EmailJS Error:', error);
            alert('Oops... Something went wrong. Please check your EmailJS configuration.');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerText = originalBtnText;
        });
}

// --- Notification System ---
function showNotification(title, message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: #fff;
        color: #333;
        padding: 20px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        z-index: 10000;
        border-left: 5px solid var(--primary-color);
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 300px;
        animation: slideInRight 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;

    toast.innerHTML = `
        <strong style="color: var(--primary-color); font-size: 1.1rem;">${title}</strong>
        <p style="margin:0; font-size: 0.9rem;">${message}</p>
        <button style="position: absolute; top: 10px; right: 10px; background:none; border:none; cursor:pointer; opacity:0.5;">✕</button>
    `;

    document.body.appendChild(toast);

    toast.querySelector('button').onclick = () => toast.remove();
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 5000);
}

// --- Volunteer Dashboard Logic ---
window.renderDonations = async function () {
    const donationsList = document.getElementById('donationsList');
    if (!donationsList) return;

    try {
        const donations = await apiFetch('/api/donations');
        const pendingDonations = donations.filter(d => d.status === 'pending');

        if (pendingDonations.length === 0) {
            donationsList.innerHTML = `
                <div class="empty-state">
                    <span>🍽️</span>
                    <h3>No pending donations</h3>
                    <p>Check back later for new requests.</p>
                </div>
            `;
            return;
        }

        donationsList.innerHTML = pendingDonations.map(donation => {
            const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(donation.location)}`;

            return `
                <div class="donation-card animate-fade-in" data-id="${donation.id}">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                        <div class="donation-badge badge-pending">Required Pickup</div>
                        <span style="font-size: 0.75rem; color: #999;">${new Date(donation.timestamp).toLocaleDateString()}</span>
                    </div>
                    
                    <h3 class="donation-title" style="color: #e65100; font-size: 1.5rem; margin-bottom: 5px;">${donation.donorName}</h3>
                    <p style="font-size: 0.85rem; color: #666; margin-bottom: 15px; display: flex; align-items: center; gap: 5px;">
                        <span style="opacity: 0.7;">📧</span> ${donation.userId}
                    </p>

                    <div class="donation-meta" style="background: #f9f9f9; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                        <p style="margin-bottom: 10px;"><strong>📍 Location:</strong> ${donation.location}</p>
                        <p style="margin-bottom: 10px;"><strong>📞 Phone:</strong> <a href="tel:${donation.phone}" style="color: #e65100; text-decoration: none;">${donation.phone}</a></p>
                        <p style="margin-bottom: 0;"><strong>📝 Food Info:</strong> ${donation.description}</p>
                    </div>

                    ${donation.foodPhoto ? `
                        <div style="margin-bottom: 20px; position: relative; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                            <img src="${donation.foodPhoto}" alt="Food" style="width: 100%; height: 180px; object-fit: cover;">
                            <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 10px; background: linear-gradient(transparent, rgba(0,0,0,0.6)); color: white; font-size: 0.75rem;">
                                Live Evidence Photo
                            </div>
                        </div>
                    ` : ''}

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <a href="${mapLink}" target="_blank" class="btn-claim" style="background: #333; text-align: center; text-decoration: none; display: flex; align-items: center; justify-content: center;">🗺️ Open Map</a>
                        <button onclick="claimDonation(${donation.id})" class="btn-claim pulse">✅ Claim Pickup</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Error rendering donations:', err);
    }
};

window.claimDonation = async function (id) {
    const volunteer = JSON.parse(localStorage.getItem('fwms_current_volunteer'));
    if (!volunteer) {
        alert('Please login as a volunteer to claim donations.');
        return;
    }

    if (!confirm('Are you sure you want to claim this donation for pickup?')) return;

    try {
        const response = await fetch(`/api/donations/${id}/claim`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ volunteerEmail: volunteer.email })
        });

        if (response.ok) {
            // Update local delivery stats for UI feedback
            const stats = JSON.parse(localStorage.getItem('fwms_deliveries_completed') || '{}');
            stats[volunteer.email] = (stats[volunteer.email] || 0) + 1;
            localStorage.setItem('fwms_deliveries_completed', JSON.stringify(stats));

            alert('Donation claimed successfully! Please proceed to the location.');

            renderDonations();
            document.dispatchEvent(new CustomEvent('statsUpdated'));
        } else {
            alert('Claim failed. Try again.');
        }
    } catch (err) {
        console.error('Error claiming donation:', err);
    }
};

// Real-time listener for Founder (Simulated)
if (window.location.pathname.includes('founder.html')) {
    window.addEventListener('storage', (e) => {
        if (e.key === 'fwms_donations') {
            const donations = JSON.parse(e.newValue || '[]');
            const latest = donations[donations.length - 1];
            if (latest && latest.status === 'pending') {
                showNotification('New Donation Request!', `From: ${latest.donorName}`);
            }
        }
    });
}

// Real-time listener for Dashboard Updates (Simulated)
window.addEventListener('storage', (e) => {
    if (e.key === 'fwms_donations' && window.location.pathname.includes('volunteer.html')) {
        renderDonations();
    }
});

