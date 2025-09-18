// Crop Contract App - Complete JavaScript Implementation
// Connects to FastAPI backend and Supabase

// Configuration
const CONFIG = {
    supabaseUrl: 'https://mpemhpwqajcjmyknyvca.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wZW1ocHdxYWpjam15a255dmNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgxMDg4MDEsImV4cCI6MjA3MzY4NDgwMX0.pe4Pa__2NOG7lX9QPZcZvpbZw_4o5yw9LuyfxFf6OkE',
    apiBaseUrl: 'http://localhost:8000'
};

// Global variables
let supabaseClient = null;
let currentUser = null;
let currentUserData = null;

// Initialize Supabase client
function initializeSupabase() {
    supabaseClient = supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
}

// Improved error handling for API Client
class ApiClient {
    static async request(method, endpoint, data = null) {
        showLoading(true);
        try {
            const config = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            if (data) {
                config.body = JSON.stringify(data);
            }

            // Add user_id as query param for authenticated requests
            if (currentUser && !endpoint.includes('user_id=')) {
                const separator = endpoint.includes('?') ? '&' : '?';
                endpoint += `${separator}user_id=${currentUser.id}`;
            }

            console.log('API Request:', method, CONFIG.apiBaseUrl + endpoint);
            const response = await fetch(CONFIG.apiBaseUrl + endpoint, config);

            let result;
            try {
                result = await response.json();
            } catch (jsonError) {
                console.error('JSON parse error:', jsonError);
                throw new Error('Server returned invalid response');
            }

            console.log('API Response:', response.status, result);

            if (!response.ok) {
                const errorMessage = result.detail || result.message || `HTTP ${response.status}`;
                throw new Error(errorMessage);
            }

            showLoading(false);
            return result;
        } catch (error) {
            console.error('API Client error:', error);
            showLoading(false);
            throw error; // let the caller show alert
        }
    }

    static get(endpoint) { return this.request('GET', endpoint); }
    static post(endpoint, data) { return this.request('POST', endpoint, data); }
    static put(endpoint, data) { return this.request('PUT', endpoint, data); }
}

// Authentication Functions
async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.error('Login error:', error);
            throw new Error(error.message || 'Login failed');
        }

        currentUser = data.user;

        // Get user profile to determine role
        try {
            const userProfile = await ApiClient.get(`/dashboard/farmer/${currentUser.id}`);

            if (userProfile.success && userProfile.data.user.role === 'farmer') {
                window.location.href = 'farmer.html';
            } else {
                // Try buyer dashboard
                const buyerProfile = await ApiClient.get(`/dashboard/buyer/${currentUser.id}`);
                if (buyerProfile.success) {
                    window.location.href = 'buyer.html';
                } else {
                    throw new Error('User profile not found');
                }
            }
        } catch (profileError) {
            console.error('Profile error:', profileError);
            showAlert('Failed to load user profile. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert('Login failed: ' + (error.message || 'Unknown error'), 'error');
    }
}

async function handleSignup(event) {
    event.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const role = document.getElementById('userRole').value;

    // Disable submit button to prevent multiple attempts
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    try {
        // Create auth user first
        console.log('Creating Supabase user...');
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password
        });

        if (error) {
            console.error('Supabase signup error:', error);

            if (error.message.includes('For security purposes')) {
                throw new Error('Please wait a moment before trying again (rate limit)');
            } else if (error.message.includes('already registered')) {
                throw new Error('This email is already registered. Please try logging in instead.');
            } else {
                throw new Error(error.message || 'Signup failed');
            }
        }

        if (!data.user) {
            throw new Error('Failed to create user account');
        }

        console.log('Supabase user created:', data.user.id);

        // Create user profile in your backend
        try {
            console.log('Creating user profile...');
            const profileResponse = await ApiClient.post('/users', {
                name: name,
                role: role
            }, `?user_id=${data.user.id}`);

            console.log('Profile created:', profileResponse);

            showAlert('Account created successfully! Please check your email for verification.', 'success');

            // Reset form and show login
            document.getElementById('signupForm').reset();
            setTimeout(() => showLogin(), 2000);

        } catch (profileError) {
            console.error('Profile creation error:', profileError);
            showAlert('Account created but profile setup failed. Please contact support.', 'error');
        }

    } catch (error) {
        console.error('Signup error:', error);
        showAlert('Signup failed: ' + (error.message || 'Unknown error'), 'error');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentUserData = null;
    window.location.href = 'index.html';
}

// Check if user is authenticated
async function checkAuth(requiredRole = null) {
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        window.location.href = 'index.html';
        return false;
    }

    currentUser = user;
    return true;
}

// Dashboard Loading Functions
async function loadFarmerDashboard() {
    if (!await checkAuth()) return;

    try {
        const response = await ApiClient.get(`/dashboard/farmer/${currentUser.id}`);
        if (response.success) {
            currentUserData = response.data;
            updateFarmerUI();
        }
    } catch (error) {
        showAlert('Failed to load dashboard', 'error');
    }
}

async function loadBuyerDashboard() {
    if (!await checkAuth()) return;

    try {
        const response = await ApiClient.get(`/dashboard/buyer/${currentUser.id}`);
        if (response.success) {
            currentUserData = response.data;
            updateBuyerUI();
        }
    } catch (error) {
        showAlert('Failed to load dashboard', 'error');
    }
}

// UI Update Functions
function updateFarmerUI() {
    document.getElementById('farmerName').textContent = currentUserData.user.name;
    document.getElementById('walletBalance').textContent = currentUserData.wallet?.balance || '0.00';

    renderTable('listingsTable', currentUserData.listings, [
        { key: 'crop_type', label: 'Crop Type' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'delivery_date', label: 'Delivery Date' },
        { key: 'expected_price', label: 'Expected Price', prefix: '₹' },
        { key: 'status', label: 'Status', render: renderStatus }
    ], [
        { label: 'View Proposals', action: 'viewProposals', class: 'btn-primary' }
    ]);

    renderTable('proposalsTable', currentUserData.proposals, [
        { key: 'crop_type', label: 'Crop Type' },
        { key: 'buyer_name', label: 'Buyer' },
        { key: 'price', label: 'Proposed Price', prefix: '₹' },
        { key: 'payment_terms', label: 'Payment Terms' },
        { key: 'status', label: 'Status', render: renderStatus }
    ], [
        { label: 'Accept', action: 'acceptProposal', class: 'btn-success', condition: (item) => item.status === 'pending' },
        { label: 'Generate Contract', action: 'generateContract', class: 'btn-primary', condition: (item) => item.status === 'accepted' }
    ]);

    renderTable('contractsTable', currentUserData.contracts, [
        { key: 'crop_type', label: 'Crop Type' },
        { key: 'buyer_name', label: 'Buyer' },
        { key: 'amount', label: 'Amount', prefix: '₹' },
        { key: 'status', label: 'Status', render: renderStatus }
    ], [
        { label: 'View', action: 'viewContract', class: 'btn-primary' },
        { label: 'Sign', action: 'signContract', class: 'btn-success', condition: (item) => item.status === 'drafted' }
    ]);
}

function updateBuyerUI() {
    document.getElementById('buyerName').textContent = currentUserData.user.name;
    document.getElementById('walletBalance').textContent = currentUserData.wallet?.balance || '0.00';

    renderTable('marketplaceTable', currentUserData.all_listings, [
        { key: 'farmer_name', label: 'Farmer' },
        { key: 'crop_type', label: 'Crop Type' },
        { key: 'quantity', label: 'Quantity' },
        { key: 'delivery_date', label: 'Delivery Date' },
        { key: 'expected_price', label: 'Expected Price', prefix: '₹' }
    ], [
        { label: 'Make Proposal', action: 'makeProposal', class: 'btn-primary' }
    ]);

    renderTable('proposalsTable', currentUserData.my_proposals, [
        { key: 'crop_type', label: 'Crop Type' },
        { key: 'farmer_name', label: 'Farmer' },
        { key: 'price', label: 'My Price', prefix: '₹' },
        { key: 'payment_terms', label: 'Payment Terms' },
        { key: 'status', label: 'Status', render: renderStatus },
        { key: 'created_at', label: 'Date', render: formatDate }
    ]);

    renderTable('contractsTable', currentUserData.contracts, [
        { key: 'crop_type', label: 'Crop Type' },
        { key: 'farmer_name', label: 'Farmer' },
        { key: 'amount', label: 'Amount', prefix: '₹' },
        { key: 'status', label: 'Status', render: renderStatus }
    ], [
        { label: 'View', action: 'viewContract', class: 'btn-primary' },
        { label: 'Sign', action: 'signContract', class: 'btn-success', condition: (item) => item.status === 'drafted' }
    ]);
}

// Generic Table Renderer
function renderTable(tableId, data, columns, actions = []) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    const emptyState = document.getElementById(tableId.replace('Table', 'Empty'));

    if (!data || data.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = data.map(item => {
        const cells = columns.map(col => {
            let value = item[col.key];
            if (col.render) value = col.render(value);
            if (col.prefix) value = col.prefix + value;
            return `<td>${value}</td>`;
        }).join('');

        const actionButtons = actions.filter(action =>
            !action.condition || action.condition(item)
        ).map(action =>
            `<button class="btn ${action.class}" onclick="${action.action}('${item.id}')">${action.label}</button>`
        ).join(' ');

        return `<tr>${cells}<td>${actionButtons}</td></tr>`;
    }).join('');
}

// Form Handlers
async function handleListingForm(event) {
    event.preventDefault();
    const formData = {
        crop_type: document.getElementById('cropType').value,
        quantity: parseInt(document.getElementById('quantity').value),
        delivery_date: document.getElementById('deliveryDate').value,
        expected_price: parseFloat(document.getElementById('expectedPrice').value)
    };

    try {
        await ApiClient.post('/listings', formData);
        showAlert('Listing created successfully!', 'success');
        document.getElementById('listingForm').reset();
        showSection('listings');
        loadFarmerDashboard(); // Refresh data
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

async function handleProposalForm(event) {
    event.preventDefault();
    const listingId = document.getElementById('proposalForm').dataset.listingId;
    const formData = {
        listing_id: listingId,
        price: parseFloat(document.getElementById('proposalPrice').value),
        payment_terms: document.getElementById('paymentTerms').value
    };

    try {
        await ApiClient.post('/proposals', formData);
        showAlert('Proposal sent successfully!', 'success');
        closeModal();
        loadBuyerDashboard(); // Refresh data
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

async function handleAddFundsForm(event) {
    event.preventDefault();
    const amount = parseFloat(document.getElementById('fundAmount').value);

    try {
        await ApiClient.post('/wallet/add-funds', { amount });
        showAlert('Funds added successfully!', 'success');
        closeModal();
        // Refresh dashboard to update wallet balance
        if (currentUserData.user.role === 'farmer') {
            loadFarmerDashboard();
        } else {
            loadBuyerDashboard();
        }
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

// Action Functions
async function acceptProposal(proposalId) {
    try {
        await ApiClient.put(`/proposals/${proposalId}/accept`);
        showAlert('Proposal accepted!', 'success');
        loadFarmerDashboard();
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

async function generateContract(proposalId) {
    try {
        await ApiClient.post('/contracts/generate', { proposal_id: proposalId });
        showAlert('Contract generated successfully!', 'success');
        loadFarmerDashboard();
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

async function signContract(contractId) {
    try {
        await ApiClient.post(`/contracts/${contractId}/sign`);
        showAlert('Contract signed successfully!', 'success');
        if (currentUserData.user.role === 'farmer') {
            loadFarmerDashboard();
        } else {
            loadBuyerDashboard();
        }
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    }
}

function makeProposal(listingId) {
    const listing = currentUserData.all_listings.find(l => l.id === listingId);
    document.getElementById('cropDetails').innerHTML = `
        <h4>${listing.crop_type}</h4>
        <p>Quantity: ${listing.quantity} units</p>
        <p>Expected Price: ₹${listing.expected_price}</p>
        <p>Delivery Date: ${listing.delivery_date}</p>
    `;
    document.getElementById('proposalForm').dataset.listingId = listingId;
    openModal('proposalModal');
}

// Modal Functions
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
}

// Navigation Functions
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(sectionId).classList.add('active');
    event.target.classList.add('active');
}

function showLanding() { showPage('landingPage'); }
function showLogin() { showPage('loginPage'); }
function showSignup() { showPage('signupPage'); }
function showAddFunds() { openModal('addFundsModal'); }

// Utility Functions
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.toggle('hidden', !show);
    }
}

// Improved alert function
function showAlert(message, type = 'info') {
    console.log('Alert:', type, message);

    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) {
        console.error('Alert container not found');
        return;
    }

    const alert = document.createElement('div');
    alert.className = `alert ${type}`;
    alert.innerHTML = `
        ${message}
        <button onclick="this.parentElement.remove()" class="alert-close">&times;</button>
    `;

    alertContainer.appendChild(alert);

    setTimeout(() => {
        alert.classList.add('fade-out');
        setTimeout(() => alert.remove(), 300);
    }, 5000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function renderStatus(status) {
    return `<span class="status ${status}">${status}</span>`;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeSupabase();

    // Check which page we're on and load data
    if (document.getElementById('farmerPage')) {
        loadFarmerDashboard();
    } else if (document.getElementById('buyerPage')) {
        loadBuyerDashboard();
    }
});

// Expose functions to window
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.logout = logout;
window.handleListingForm = handleListingForm;
window.handleProposalForm = handleProposalForm;
window.handleAddFundsForm = handleAddFundsForm;
window.showLanding = showLanding;
window.showLogin = showLogin;
window.showSignup = showSignup;
window.showSection = showSection;
window.makeProposal = makeProposal;
window.acceptProposal = acceptProposal;
window.generateContract = generateContract;
window.signContract = signContract;
window.showAddFunds = showAddFunds;
window.openModal = openModal;
window.closeModal = closeModal;
