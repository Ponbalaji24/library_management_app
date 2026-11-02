// Aetheria Library Management Client Controller

// Cache datasets for lookup mapping
let booksCache = {};
let membersCache = {};

// Override fetch to automatically inject Authorization token
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
    const token = localStorage.getItem('access_token');
    if (token && url.startsWith('/api/') && !url.startsWith('/api/auth/')) {
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

// Check authentication status and toggle overlay gate
function checkAuth() {
    const token = localStorage.getItem('access_token');
    const authOverlay = document.getElementById('auth-overlay');
    if (!token) {
        authOverlay.classList.remove('hidden');
    } else {
        authOverlay.classList.add('hidden');
        const user = JSON.parse(localStorage.getItem('current_user') || '{}');
        if (user.email) {
            document.getElementById('user-name').textContent = user.name || 'User';
            document.getElementById('user-email').textContent = user.email;
            document.getElementById('user-avatar').textContent = (user.name || 'U').charAt(0).toUpperCase();
        }
    }
}

// Toast popup utility
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    // Animate in
    toast.classList.remove('hidden');
    
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// Collapsible forms helper
function toggleForm(elementId) {
    const formSection = document.getElementById(elementId);
    if (formSection.classList.contains('hidden-anim')) {
        formSection.classList.remove('hidden-anim');
    } else {
        formSection.classList.add('hidden-anim');
    }
}

// Switch active slide tabs
function setupTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = item.getAttribute('data-tab');

            // Set active class on nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Set active class on panes
            tabPanes.forEach(pane => pane.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');

            // Update title
            pageTitle.textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1);

            // Fetch data for the selected tab
            if (tabName === 'dashboard') {
                loadDashboardStats();
            } else if (tabName === 'books') {
                loadBooks();
            } else if (tabName === 'members') {
                loadMembers();
            } else if (tabName === 'transactions') {
                loadTransactions();
            }
        });
    });
}

// --------------------------------------------------------------------------
// API ACTIONS
// --------------------------------------------------------------------------

// 1. Fetch Dashboard Stats
async function loadDashboardStats() {
    try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error("Failed to load statistics");
        const stats = await res.json();

        document.getElementById('stat-total-books').textContent = stats.total_books;
        document.getElementById('stat-total-members').textContent = stats.total_members;
        document.getElementById('stat-active-borrows').textContent = stats.active_borrows;
        document.getElementById('stat-available-copies').textContent = stats.available_copies;

        // Load active transactions for dashboard widget
        await refreshCaches();
        const borrowRes = await fetch('/api/borrows');
        const borrows = await borrowRes.json();

        const activeList = document.getElementById('active-borrows-list');
        activeList.innerHTML = '';

        const activeBorrows = borrows.filter(b => b.return_date === null).slice(0, 5);
        if (activeBorrows.length === 0) {
            activeList.innerHTML = '<li class="activity-item" style="color: var(--text-muted);">No active loans.</li>';
            return;
        }

        activeBorrows.forEach(b => {
            const bookTitle = booksCache[b.book_id]?.title || `Book #${b.book_id}`;
            const memberName = membersCache[b.member_id]?.name || `Member #${b.member_id}`;
            
            const li = document.createElement('li');
            li.className = 'activity-item';
            li.innerHTML = `
                <div class="activity-details">
                    <h4>${bookTitle}</h4>
                    <p>Borrowed by: <strong>${memberName}</strong> on ${b.borrow_date}</p>
                </div>
                <button class="btn btn-secondary" onclick="returnBook(${b.id}, 'dashboard')">Return</button>
            `;
            activeList.appendChild(li);
        });

    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 2. Fetch Books Catalog
async function loadBooks() {
    try {
        const res = await fetch('/api/books');
        if (!res.ok) throw new Error("Failed to load catalog");
        const books = await res.json();

        // Update cache
        books.forEach(b => booksCache[b.id] = b);

        const grid = document.getElementById('books-grid');
        grid.innerHTML = '';

        if (books.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No books available in the catalog.</p>';
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
                    <button class="btn btn-danger btn-sm" onclick="deleteBook(${b.id})">Delete</button>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// 3. Fetch Members list
async function loadMembers() {
    try {
        const res = await fetch('/api/members');
        if (!res.ok) throw new Error("Failed to load members list");
        const members = await res.json();

        // Update cache
        members.forEach(m => membersCache[m.id] = m);

        const tbody = document.getElementById('members-table-body');
        tbody.innerHTML = '';

        if (members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No members registered yet.</td></tr>';
            return;
        }

        members.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>#${m.id}</strong></td>
                <td>${m.name}</td>
                <td>${m.email}</td>
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

// 4. Fetch Transactions history
async function loadTransactions() {
    try {
        await refreshCaches();
        const res = await fetch('/api/borrows');
        if (!res.ok) throw new Error("Failed to load logs");
        const borrows = await res.json();

        const tbody = document.getElementById('transactions-table-body');
        tbody.innerHTML = '';

        if (borrows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No transaction logs recorded.</td></tr>';
            return;
        }

        borrows.forEach(b => {
            const bookTitle = booksCache[b.book_id]?.title || `Book #${b.book_id}`;
            const memberName = membersCache[b.member_id]?.name || `Member #${b.member_id}`;
            const isReturned = b.return_date !== null;
            
            const statusBadge = isReturned 
                ? '<span class="badge badge-returned">Returned</span>' 
                : '<span class="badge badge-active">Active Loan</span>';
                
            const actionBtn = isReturned 
                ? '-' 
                : `<button class="btn btn-secondary btn-sm" onclick="returnBook(${b.id}, 'transactions')">Return Book</button>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>#${b.id}</strong></td>
                <td>${memberName}</td>
                <td>${bookTitle}</td>
                <td>${b.borrow_date}</td>
                <td>${b.return_date || '-'}</td>
                <td>${statusBadge}</td>
                <td>${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Refresh Caches (Auxiliary function)
async function refreshCaches() {
    try {
        const [booksRes, membersRes] = await Promise.all([
            fetch('/api/books'),
            fetch('/api/members')
        ]);
        const books = await booksRes.json();
        const members = await membersRes.json();

        books.forEach(b => booksCache[b.id] = b);
        members.forEach(m => membersCache[m.id] = m);
    } catch (e) {
        console.error("Caches refresh failed", e);
    }
}

// Populate Dropdown Menus in quick actions
async function populateBorrowSelects() {
    try {
        const [booksRes, membersRes] = await Promise.all([
            fetch('/api/books'),
            fetch('/api/members')
        ]);
        const books = await booksRes.json();
        const members = await membersRes.json();

        const memberSelect = document.getElementById('borrow-member');
        const bookSelect = document.getElementById('borrow-book');

        // Clear existing items but retain default placeholder options
        memberSelect.innerHTML = '<option value="" disabled selected>Select library member...</option>';
        bookSelect.innerHTML = '<option value="" disabled selected>Select available book...</option>';

        members.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.name} (${m.email})`;
            memberSelect.appendChild(opt);
        });

        books.forEach(b => {
            if (b.copies_available > 0) {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = `${b.title} by ${b.author} [Stock: ${b.copies_available}]`;
                bookSelect.appendChild(opt);
            }
        });

    } catch (e) {
        console.error("Dropdown population failed", e);
    }
}

// --------------------------------------------------------------------------
// SUBMIT FORM HANDLERS
// --------------------------------------------------------------------------

// Process borrowing Action
async function handleBorrow(e) {
    e.preventDefault();
    const book_id = parseInt(document.getElementById('borrow-book').value);
    const member_id = parseInt(document.getElementById('borrow-member').value);

    try {
        const res = await fetch('/api/borrow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ book_id, member_id })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.detail || "Borrow transaction failed");
        }

        showToast("Book borrowed successfully!");
        document.getElementById('quick-borrow-form').reset();
        
        // Reload dashboard
        loadDashboardStats();
        populateBorrowSelects();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Add Book Action
async function handleAddBook(e) {
    e.preventDefault();
    const title = document.getElementById('book-title').value;
    const author = document.getElementById('book-author').value;
    const isbn = document.getElementById('book-isbn').value;
    const published_year = parseInt(document.getElementById('book-year').value);
    const copies_available = parseInt(document.getElementById('book-copies').value);

    try {
        const res = await fetch('/api/books', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, author, isbn, published_year, copies_available })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.detail || "Failed to add book");
        }

        showToast("New book registered successfully!");
        document.getElementById('add-book-form').reset();
        toggleForm('add-book-section');
        
        loadBooks();
        populateBorrowSelects();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Register Member Action
async function handleAddMember(e) {
    e.preventDefault();
    const name = document.getElementById('member-name').value;
    const email = document.getElementById('member-email').value;
    const password = document.getElementById('member-password').value;
    const membership_date = document.getElementById('member-date').value;

    try {
        const res = await fetch('/api/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, membership_date })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.detail || "Failed to register member");
        }

        showToast("New member registered successfully!");
        document.getElementById('add-member-form').reset();
        toggleForm('add-member-section');

        loadMembers();
        populateBorrowSelects();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Return Borrowed Book Action
async function returnBook(recordId, currentTab = 'dashboard') {
    try {
        const res = await fetch(`/api/return/${recordId}`, {
            method: 'POST'
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.detail || "Return transaction failed");
        }

        showToast("Book returned successfully!");
        
        // Refresh appropriate view
        if (currentTab === 'dashboard') {
            loadDashboardStats();
        } else {
            loadTransactions();
        }
        populateBorrowSelects();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Delete Book Action
async function deleteBook(bookId) {
    if (!confirm("Are you sure you want to delete this book? This will also remove any related borrow records.")) return;
    try {
        const res = await fetch(`/api/books/${bookId}`, {
            method: 'DELETE'
        });

        if (!res.ok) throw new Error("Delete book failed");
        
        showToast("Book deleted successfully");
        loadBooks();
        populateBorrowSelects();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Remove Member Action
async function deleteMember(memberId) {
    if (!confirm("Are you sure you want to remove this member? This will also remove any related borrow records.")) return;
    try {
        const res = await fetch(`/api/members/${memberId}`, {
            method: 'DELETE'
        });

        if (!res.ok) throw new Error("Remove member failed");

        showToast("Member removed successfully");
        loadMembers();
        populateBorrowSelects();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Auth and Password actions
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Login failed");
        }
        const data = await res.json();
        localStorage.setItem('access_token', data.access_token);
        
        const membersRes = await fetch('/api/members');
        if (membersRes.ok) {
            const members = await membersRes.json();
            const matchedMember = members.find(m => m.email === email);
            if (matchedMember) {
                localStorage.setItem('current_user', JSON.stringify(matchedMember));
            } else {
                localStorage.setItem('current_user', JSON.stringify({ name: email.split('@')[0], email }));
            }
        } else {
            localStorage.setItem('current_user', JSON.stringify({ name: email.split('@')[0], email }));
        }
        
        showToast("Welcome back!");
        document.getElementById('login-form').reset();
        checkAuth();
        
        loadDashboardStats();
        populateBorrowSelects();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const membership_date = new Date().toISOString().split('T')[0];
    try {
        const res = await fetch('/api/members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, membership_date })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Registration failed");
        }
        showToast("Registration successful! Please login.");
        document.getElementById('register-form').reset();
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('auth-subtitle').textContent = "Sign in to access your library dashboard";
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function handleLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('current_user');
    showToast("Logged out successfully");
    checkAuth();
}

async function handleChangePassword(e) {
    e.preventDefault();
    const old_password = document.getElementById('old-password').value;
    const new_password = document.getElementById('new-password').value;
    
    if (new_password.length < 6) {
        showToast("New password must be at least 6 characters long", "error");
        return;
    }
    
    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_password, new_password })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to update password");
        }
        showToast("Password updated successfully!");
        document.getElementById('change-password-form').reset();
        document.getElementById('password-modal').classList.add('hidden');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --------------------------------------------------------------------------
// INIT AND EVENT BINDING
// --------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupTabs();
    
    // Form binds
    document.getElementById('quick-borrow-form').addEventListener('submit', handleBorrow);
    document.getElementById('add-book-form').addEventListener('submit', handleAddBook);
    document.getElementById('add-member-form').addEventListener('submit', handleAddMember);
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('change-password-form').addEventListener('submit', handleChangePassword);

    // Auth screen toggles
    document.getElementById('show-register-btn').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('auth-subtitle').textContent = "Register a new library account";
    });
    
    document.getElementById('show-login-btn').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('auth-subtitle').textContent = "Sign in to access your library dashboard";
    });

    // Password modal triggers
    document.getElementById('change-password-trigger').addEventListener('click', () => {
        document.getElementById('password-modal').classList.remove('hidden');
    });
    document.getElementById('close-password-modal').addEventListener('click', () => {
        document.getElementById('password-modal').classList.add('hidden');
    });
    
    // Logout trigger
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        handleLogout();
    });

    // Initial date field auto-fill
    document.getElementById('member-date').value = new Date().toISOString().split('T')[0];

    // Load initial slide if logged in
    if (localStorage.getItem('access_token')) {
        loadDashboardStats();
        populateBorrowSelects();
    }
});
