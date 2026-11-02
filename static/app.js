// Aetheria Library Management — Reader Portal Controller

let allBooks = [];

// Override fetch to automatically inject Authorization token
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
    const token = localStorage.getItem('access_token');
    if (token && url.startsWith('/api/') && !url.startsWith('/api/auth/login') && !url.startsWith('/api/auth/register')) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await originalFetch(url, options);
    if (response.status === 401 && !url.startsWith('/api/auth/')) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('current_user');
        checkAuth();
    }
    return response;
};

// Check authentication status
function checkAuth() {
    const token = localStorage.getItem('access_token');
    const authOverlay = document.getElementById('auth-overlay');
    if (!token) {
        authOverlay.classList.remove('hidden');
    } else {
        authOverlay.classList.add('hidden');
        const user = JSON.parse(localStorage.getItem('current_user') || '{}');
        if (user.email) {
            document.getElementById('user-name').textContent = user.name || 'Member';
            document.getElementById('user-email').textContent = user.email;
            const initial = (user.name || 'U').charAt(0).toUpperCase();
            document.getElementById('user-avatar').textContent = initial;
            document.getElementById('top-avatar').textContent = initial;
            document.getElementById('top-username').textContent = user.name || 'Reader';
        }
        loadCatalog();
    }
}

// Toast popup utility
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// Setup tabs
function setupTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = item.getAttribute('data-tab');

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            tabPanes.forEach(pane => pane.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');

            if (tabName === 'catalog') {
                pageTitle.textContent = "Library Book Catalog";
                loadCatalog();
            } else if (tabName === 'my-books') {
                pageTitle.textContent = "My Borrowed Books";
                loadMyBorrows();
            }
        });
    });
}

// 1. Load Catalog
async function loadCatalog() {
    try {
        const res = await fetch('/api/books');
        if (!res.ok) throw new Error("Failed to load catalog");
        allBooks = await res.json();
        renderBooks(allBooks);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Render book cards
function renderBooks(books) {
    const grid = document.getElementById('books-grid');
    grid.innerHTML = '';

    if (books.length === 0) {
        grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No matching books found.</p>';
        return;
    }

    books.forEach(b => {
        const card = document.createElement('div');
        card.className = 'book-card';
        const isAvailable = b.copies_available > 0;
        const stockClass = isAvailable ? 'in-stock' : 'out-of-stock';
        const stockText = isAvailable ? `${b.copies_available} Available` : 'Out of Stock';

        card.innerHTML = `
            <div class="book-cover-mock">
                <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" stroke-width="1.5" fill="none">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
            </div>
            <div class="book-details">
                <h3>${b.title}</h3>
                <div class="author">by ${b.author}</div>
                <div class="book-meta-tags">
                    <span class="tag tag-isbn">ISBN: ${b.isbn}</span>
                    <span class="tag tag-year">Year: ${b.published_year}</span>
                    <span class="tag tag-stock ${stockClass}">${stockText}</span>
                </div>
            </div>
            <div class="card-actions" style="margin-top: 12px;">
                <button class="borrow-now-btn" ${!isAvailable ? 'disabled' : ''} onclick="borrowBookNow(${b.id}, '${b.title.replace(/'/g, "\\'")}')">
                    ${isAvailable ? '📖 Borrow This Book' : 'Unavailable'}
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Borrow a book
async function borrowBookNow(bookId, bookTitle) {
    if (!confirm(`Would you like to borrow "${bookTitle}"?`)) return;

    try {
        const res = await fetch('/api/borrow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ book_id: bookId })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Unable to borrow book");

        showToast(`Successfully borrowed "${bookTitle}"!`);
        loadCatalog();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 2. Load My Borrowed Books
async function loadMyBorrows() {
    try {
        const res = await fetch('/api/my-borrows');
        if (!res.ok) throw new Error("Failed to load your borrowings");
        const list = await res.json();

        const tbody = document.getElementById('my-borrows-table-body');
        tbody.innerHTML = '';

        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">You have not borrowed any books yet.</td></tr>';
            return;
        }

        list.forEach(r => {
            const tr = document.createElement('tr');
            const statusClass = r.is_returned ? 'in-stock' : 'out-of-stock';
            const statusLabel = r.is_returned ? 'Returned' : 'Active Loan';

            tr.innerHTML = `
                <td><strong>${r.book_title}</strong></td>
                <td>${r.book_author}</td>
                <td>${r.borrow_date}</td>
                <td>${r.return_date || '-'}</td>
                <td><span class="tag ${statusClass}">${statusLabel}</span></td>
                <td>
                    ${!r.is_returned ? `<button class="btn btn-primary btn-sm" onclick="returnMyBook(${r.id})">Return Book</button>` : `<span style="color: var(--text-muted); font-size: 12px;">Done</span>`}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Return book
async function returnMyBook(recordId) {
    try {
        const res = await fetch(`/api/return/${recordId}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Failed to return book");

        showToast("Book returned successfully!");
        loadMyBorrows();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    checkAuth();

    // Toggle between login and register forms
    document.getElementById('show-register-btn').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    });

    document.getElementById('show-login-btn').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    });

    // Login Form Submit
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Invalid login credentials");

            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('current_user', JSON.stringify({
                name: data.name,
                email: data.email,
                role: data.role
            }));

            showToast(`Welcome back, ${data.name}!`);
            checkAuth();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Register Form Submit
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Registration failed");

            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('current_user', JSON.stringify({
                name: data.name,
                email: data.email,
                role: data.role
            }));

            showToast(`Welcome to Aetheria, ${data.name}!`);
            checkAuth();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Search input
    document.getElementById('book-search-input').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderBooks(allBooks);
            return;
        }
        const filtered = allBooks.filter(b => 
            b.title.toLowerCase().includes(query) ||
            b.author.toLowerCase().includes(query) ||
            b.isbn.toLowerCase().includes(query)
        );
        renderBooks(filtered);
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('current_user');
        checkAuth();
        showToast("Signed out successfully");
    });

    // Password modal
    document.getElementById('change-password-trigger').addEventListener('click', () => {
        document.getElementById('password-modal').classList.remove('hidden');
    });

    document.getElementById('close-password-modal').addEventListener('click', () => {
        document.getElementById('password-modal').classList.add('hidden');
    });

    document.getElementById('change-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const old_password = document.getElementById('old-password').value;
        const new_password = document.getElementById('new-password').value;

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ old_password, new_password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Failed to update password");

            showToast("Password updated successfully!");
            document.getElementById('password-modal').classList.add('hidden');
            document.getElementById('change-password-form').reset();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
});
