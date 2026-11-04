// Aetheria Library Management — Admin Portal Controller

let booksCache = {};
let membersCache = {};

// Override fetch to automatically inject Authorization token
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
    const token = localStorage.getItem('admin_access_token') || localStorage.getItem('access_token');
    if (token && url.startsWith('/api/') && !url.startsWith('/api/auth/login') && !url.startsWith('/api/auth/register')) {
        options.headers = options.headers || {};
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await originalFetch(url, options);
    if ((response.status === 401 || response.status === 403) && !url.startsWith('/api/auth/')) {
        localStorage.removeItem('admin_access_token');
        checkAdminAuth();
    }
    return response;
};

// Check admin authentication
function checkAdminAuth() {
    const token = localStorage.getItem('admin_access_token');
    const authOverlay = document.getElementById('auth-overlay');
    const user = JSON.parse(localStorage.getItem('admin_user') || '{}');

    if (!token || user.role !== 'admin') {
        authOverlay.classList.remove('hidden');
    } else {
        authOverlay.classList.add('hidden');
        if (user.email) {
            document.getElementById('user-name').textContent = user.name || 'Admin';
            document.getElementById('user-email').textContent = user.email;
            document.getElementById('user-avatar').textContent = (user.name || 'A').charAt(0).toUpperCase();
        }
        loadDashboardStats();
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

// Toggle collapsible form sections
function toggleForm(elementId) {
    const formSection = document.getElementById(elementId);
    if (formSection.classList.contains('hidden-anim')) {
        formSection.classList.remove('hidden-anim');
    } else {
        formSection.classList.add('hidden-anim');
    }
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

            pageTitle.textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1);

            if (tabName === 'dashboard') loadDashboardStats();
            else if (tabName === 'books') loadBooks();
            else if (tabName === 'members') loadMembers();
            else if (tabName === 'transactions') loadTransactions();
        });
    });
}

// 1. Dashboard Stats
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error("Failed to load statistics");
        const data = await res.json();

        document.getElementById('stat-total-books').textContent = data.total_books;
        document.getElementById('stat-total-members').textContent = data.total_members;
        document.getElementById('stat-active-borrows').textContent = data.active_borrows;
        document.getElementById('stat-available-copies').textContent = data.available_copies;

        await populateDropdowns();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Populate dropdowns for quick borrow
async function populateDropdowns() {
    try {
        const [booksRes, membersRes] = await Promise.all([
            fetch('/api/books'),
            fetch('/api/members')
        ]);

        if (booksRes.ok && membersRes.ok) {
            const books = await booksRes.json();
            const members = await membersRes.json();

            const bookSelect = document.getElementById('borrow-book-select');
            const memberSelect = document.getElementById('borrow-member-select');

            bookSelect.innerHTML = '<option value="">-- Choose a Book --</option>';
            memberSelect.innerHTML = '<option value="">-- Choose a Member --</option>';

            books.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = `${b.title} (${b.copies_available} left)`;
                if (b.copies_available <= 0) opt.disabled = true;
                bookSelect.appendChild(opt);
            });

            members.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = `${m.name} (${m.email})`;
                memberSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Dropdown error:", err);
    }
}

// 2. Load Books
async function loadBooks() {
    try {
        const res = await fetch('/api/books');
        if (!res.ok) throw new Error("Failed to load books");
        const books = await res.json();

        const grid = document.getElementById('books-grid');
        grid.innerHTML = '';

        if (books.length === 0) {
            grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1;">No books available.</p>';
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
                <div class="card-actions">
                    <button class="btn btn-danger btn-sm" onclick="deleteBook(${b.id})">Delete Book</button>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Delete Book
async function deleteBook(id) {
    if (!confirm("Are you sure you want to delete this book?")) return;
    try {
        const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || "Failed to delete book");
        }
        showToast("Book deleted successfully");
        loadBooks();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 3. Load Members (ADMIN ONLY)
async function loadMembers() {
    try {
        const res = await fetch('/api/members');
        if (!res.ok) throw new Error("Failed to load members list");
        const members = await res.json();

        const tbody = document.getElementById('members-table-body');
        tbody.innerHTML = '';

        if (members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No members found.</td></tr>';
            return;
        }

        members.forEach(m => {
            const tr = document.createElement('tr');
            const roleBadge = m.role === 'admin' 
                ? '<span class="admin-badge">Admin</span>' 
                : '<span style="color: #38bdf8; font-weight: 500; font-size: 12px;">Member</span>';

            tr.innerHTML = `
                <td><strong>#${m.id}</strong></td>
                <td>${m.name}</td>
                <td>${m.email}</td>
                <td>${roleBadge}</td>
                <td>${m.membership_date}</td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteMember(${m.id})">Remove</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Delete Member
async function deleteMember(id) {
    if (!confirm("Are you sure you want to remove this member?")) return;
    try {
        const res = await fetch(`/api/members/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || "Failed to delete member");
        }
        showToast("Member removed successfully");
        loadMembers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 4. Load Transactions
async function loadTransactions() {
    try {
        const res = await fetch('/api/borrows');
        if (!res.ok) throw new Error("Failed to load transactions");
        const borrows = await res.json();

        const tbody = document.getElementById('transactions-table-body');
        tbody.innerHTML = '';

        if (borrows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No borrowing transactions yet.</td></tr>';
            return;
        }

        borrows.forEach(b => {
            const tr = document.createElement('tr');
            const isReturned = b.status === "Returned";
            const badgeClass = isReturned ? 'in-stock' : 'out-of-stock';

            tr.innerHTML = `
                <td><strong>#${b.id}</strong></td>
                <td>${b.member_name} <br><small style="color: var(--text-muted);">${b.member_email}</small></td>
                <td>${b.book_title}</td>
                <td>${b.borrow_date}</td>
                <td>${b.return_date || '-'}</td>
                <td><span class="tag ${badgeClass}">${b.status}</span></td>
                <td>
                    ${!isReturned ? `<button class="btn btn-primary btn-sm" onclick="returnBook(${b.id})">Mark Return</button>` : `<span style="color: var(--text-muted); font-size: 12px;">Completed</span>`}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Return Book
async function returnBook(id) {
    try {
        const res = await fetch(`/api/return/${id}`, { method: 'POST' });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || "Failed to return book");
        }
        showToast("Book marked as returned successfully");
        loadTransactions();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    checkAdminAuth();

    // Toggle between login and register forms
    const showRegisterBtn = document.getElementById('show-admin-register-btn');
    const showLoginBtn = document.getElementById('show-admin-login-btn');
    const loginForm = document.getElementById('admin-login-form');
    const registerForm = document.getElementById('admin-register-form');
    const authSubtitle = document.getElementById('auth-subtitle');

    if (showRegisterBtn && showLoginBtn) {
        showRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            if (authSubtitle) authSubtitle.textContent = 'Register a new Administrator account';
        });

        showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            registerForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            if (authSubtitle) authSubtitle.textContent = 'Restricted to Administrators only';
        });
    }

    // Admin register form
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-admin-name').value;
            const email = document.getElementById('reg-admin-email').value;
            const password = document.getElementById('reg-admin-password').value;
            const admin_secret = document.getElementById('reg-admin-secret').value;

            try {
                const res = await fetch('/api/auth/register-admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, admin_secret })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || "Registration failed");

                localStorage.setItem('admin_access_token', data.access_token);
                localStorage.setItem('admin_user', JSON.stringify({
                    name: data.name,
                    email: data.email,
                    role: data.role
                }));

                showToast(`Welcome Administrator ${data.name}! Your account is active.`);
                checkAdminAuth();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });
    }

    // Admin login form
    document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Authentication failed");

            if (data.role !== 'admin') {
                throw new Error("Access Denied: Your account is a regular member account, not an administrator.");
            }

            localStorage.setItem('admin_access_token', data.access_token);
            localStorage.setItem('admin_user', JSON.stringify({
                name: data.name,
                email: data.email,
                role: data.role
            }));

            showToast("Welcome Administrator!");
            checkAdminAuth();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_user');
        checkAdminAuth();
        showToast("Logged out successfully");
    });

    // Add Book Form
    document.getElementById('add-book-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const bookData = {
            title: document.getElementById('book-title').value,
            author: document.getElementById('book-author').value,
            isbn: document.getElementById('book-isbn').value,
            published_year: parseInt(document.getElementById('book-year').value),
            copies_available: parseInt(document.getElementById('book-copies').value)
        };

        try {
            const res = await fetch('/api/books', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Failed to add book");

            showToast("Book added to catalog!");
            document.getElementById('add-book-form').reset();
            toggleForm('add-book-section');
            loadBooks();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Add Member Form (Admin)
    document.getElementById('add-member-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const memberData = {
            name: document.getElementById('member-name').value,
            email: document.getElementById('member-email').value,
            password: document.getElementById('member-password').value,
            role: document.getElementById('member-role').value,
            membership_date: document.getElementById('member-date').value
        };

        try {
            const res = await fetch('/api/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(memberData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Failed to register member");

            showToast(`Member registered as ${memberData.role}!`);
            document.getElementById('add-member-form').reset();
            toggleForm('add-member-section');
            loadMembers();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // Quick Borrow Form
    document.getElementById('quick-borrow-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const book_id = parseInt(document.getElementById('borrow-book-select').value);
        const member_id = parseInt(document.getElementById('borrow-member-select').value);

        try {
            const res = await fetch('/api/borrow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ book_id, member_id })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Borrow failed");

            showToast("Book issued successfully!");
            loadDashboardStats();
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
});

