// EmailJS Initialization Placeholder
// Replace these with your actual keys from EmailJS Dashboard
const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY";
const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
const EMAILJS_TEMPLATE_ID_CONTACT = "YOUR_CONTACT_TEMPLATE_ID";
const EMAILJS_TEMPLATE_ID_DONOR = "YOUR_DONOR_TEMPLATE_ID";

(function () {
    // Initialize EmailJS
    if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }

    // --- Dynamic UI Enhancements ---

    // Inject Scroll Progress Bar
    const progressDiv = document.createElement('div');
    progressDiv.id = 'scrollProgress';
    document.body.prepend(progressDiv);

    window.addEventListener('scroll', () => {
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height) * 100;
        progressDiv.style.width = scrolled + "%";

        // Navbar Transformation
        const header = document.querySelector('header');
        if (winScroll > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Magnetic Button Effect
    const handleMagnetic = (e) => {
        const btn = e.currentTarget;
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
    };

    const resetMagnetic = (e) => {
        e.currentTarget.style.transform = `translate(0, 0)`;
    };

    // Auto-Stagger Logic
    const initStagger = () => {
        document.querySelectorAll('.stagger-parent').forEach(parent => {
            const children = parent.children;
            Array.from(children).forEach((child, index) => {
                child.style.animationDelay = `${(index + 1) * 0.1}s`;
            });
        });
    };

    // Scroll Reveal Logic
    const revealCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    };

    const revealObserver = new IntersectionObserver(revealCallback, {
        threshold: 0.1
    });

    window.addEventListener('DOMContentLoaded', () => {
        const reveals = document.querySelectorAll('.reveal');
        reveals.forEach(el => revealObserver.observe(el));

        // Initialize Pro Effects
        initStagger();

        document.querySelectorAll('.btn-magnetic, .nav-links a, .logo').forEach(btn => {
            btn.addEventListener('mousemove', handleMagnetic);
            btn.addEventListener('mouseleave', resetMagnetic);
        });
    });
})();

// --- Authentication & Data Persistence ---

const USERS_KEY = 'fwms_users';
const SESSION_KEY = 'fwms_current_user';
const DONATIONS_KEY = 'fwms_donations';

/**
 * Get all registered users
 */
function getUsers() {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : [];
}

/**
 * Get current logged in user
 */
function getCurrentUser() {
    const user = localStorage.getItem(SESSION_KEY);
    return user ? JSON.parse(user) : null;
}

/**
 * Update UI based on auth state
 */
function updateAuthUI() {
    const user = getCurrentUser();
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    // Remove existing auth links
    const existingAuthLinks = navLinks.querySelectorAll('.auth-link');
    existingAuthLinks.forEach(link => link.remove());

    if (user) {
        // Logged In state
        const profilePhotoImg = user.photo ?
            `<img src="${user.photo}" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">` :
            `<span style="font-size: 1.2rem;">👤</span>`;

        const userLi = document.createElement('li');
        userLi.className = 'auth-link';
        userLi.innerHTML = `
            <a href="profile.html" style="display: flex; align-items: center; gap: 10px; border: 1px solid rgba(255,255,255,0.2); padding: 5px 12px; border-radius: 20px; background: rgba(255,255,255,0.1);">
                ${profilePhotoImg}
                <span style="color: var(--white); font-weight: 600;">${user.name.split(' ')[0]}</span>
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
            alert('Logged out successfully.');
            window.location.href = 'index.html';
        });
    } else {
        // Logged Out state
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
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            const name = formData.get('name');
            const email = formData.get('email');
            const password = formData.get('password');
            const location = formData.get('location');
            const gender = formData.get('gender');

            const users = getUsers();
            if (users.find(u => u.email === email)) {
                alert('Email already registered.');
                return;
            }

            users.push({
                name,
                email,
                password,
                location,
                gender,
                photo: regPhotoBase64 // Store photo as Base64
            });
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            alert('Registration successful! You can now login.');
            window.location.href = 'login.html';
        });
    }

    // Login Form Handling
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const email = formData.get('email');
            const password = formData.get('password');

            const users = getUsers();
            const user = users.find(u => u.email === email && u.password === password);

            if (user) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(user));
                alert(`Welcome back, ${user.name}!`);
                window.location.href = 'index.html';
            } else {
                alert('Invalid email or password.');
            }
        });
    }

    // Image Preview for Donor Page
    const foodImageInput = document.getElementById('foodImage');
    const imagePreview = document.getElementById('imagePreview');

    if (foodImageInput && imagePreview) {
        foodImageInput.addEventListener('change', function () {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    window.lastDonationPhoto = e.target.result;
                    imagePreview.innerHTML = `<img src="${e.target.result}" alt="Food Preview" style="max-width: 100%; border-radius: 8px; margin-top: 10px;">`;
                };
                reader.readAsDataURL(file);
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

        donorForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Save to JSON (mock storage)
            const formData = new FormData(donorForm);
            const donation = {
                id: Date.now(),
                userId: user.email,
                userName: user.name,
                donorName: formData.get('donor_name'),
                location: formData.get('location'),
                description: formData.get('description'),
                foodPhoto: window.lastDonationPhoto,
                status: 'pending',
                timestamp: new Date().toISOString()
            };

            const donations = JSON.parse(localStorage.getItem(DONATIONS_KEY) || '[]');
            donations.push(donation);
            localStorage.setItem(DONATIONS_KEY, JSON.stringify(donations));

            handleFormSubmit(donorForm, EMAILJS_TEMPLATE_ID_DONOR);
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

// Real-time listener for Founder (Simulated)
if (window.location.pathname.includes('founder.html')) {
    window.addEventListener('storage', (e) => {
        if (e.key === DONATIONS_KEY) {
            const donations = JSON.parse(e.newValue || '[]');
            const latest = donations[donations.length - 1];
            if (latest && latest.status === 'pending') {
                showNotification('New Donation Request!', `From: ${latest.donorName}`);
            }
        }
    });
}
