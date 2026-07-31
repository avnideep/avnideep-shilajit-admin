// API Client for Avnideep Admin Panel

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

  ? 'http://localhost:8787'

  : 'https://avnideep-admin-api.officialavnideepayurveda.workers.dev';



const API = API_BASE + '/api/admin';



async function apiRequest(path, options = {}) {

  const token = localStorage.getItem('admin_token');

  const headers = {

    'Content-Type': 'application/json',

    ...(token ? { 'Authorization': 'Bearer ' + token } : {}),

    ...options.headers

  };



  const res = await fetch(API + path, { ...options, headers });



  // Handle 401 - redirect to login

  if (res.status === 401) {

    localStorage.removeItem('admin_token');

    localStorage.removeItem('admin_email');

    window.location.href = '/index.html';

    return null;

  }



  let data;

  try {

    data = await res.json();

  } catch {

    throw new Error('Server error (HTTP ' + res.status + ')');

  }

  if (!data.ok) throw new Error(data.error || 'Request failed (HTTP ' + res.status + ')');

  return data.data;

}



// Auth

async function login(email, password) {

  const data = await apiRequest('/auth/login', {

    method: 'POST',

    body: JSON.stringify({ email, password })

  });

  localStorage.setItem('admin_token', data.token);

  localStorage.setItem('admin_email', data.email);

  return data;

}



async function verifyToken() {

  try {

    await apiRequest('/auth/verify');

    return true;

  } catch {

    localStorage.removeItem('admin_token');

    localStorage.removeItem('admin_email');

    return false;

  }

}



function logout() {

  localStorage.removeItem('admin_token');

  localStorage.removeItem('admin_email');

  window.location.href = '/index.html';

}



// Dashboard

async function getDashboard(period = 'all') {

  return await apiRequest('/dashboard?period=' + period);

}



// Orders

async function getOrders(params = {}) {

  const q = new URLSearchParams();

  if (params.page) q.set('page', params.page);

  if (params.limit) q.set('limit', params.limit);

  if (params.search) q.set('search', params.search);

  if (params.status) q.set('status', params.status);

  if (params.from) q.set('from', params.from);

  if (params.to) q.set('to', params.to);

  return await apiRequest('/orders?' + q.toString());

}



async function getOrderDetail(orderId) {

  return await apiRequest('/orders/' + encodeURIComponent(orderId));

}



async function updateOrderStatus(orderId, status) {

  return await apiRequest('/orders/' + encodeURIComponent(orderId) + '/status', {

    method: 'PATCH',

    body: JSON.stringify({ status })

  });

}



// Analytics
async function getAnalytics(period = 'all') {
  return await apiRequest('/analytics?period=' + period);
}

// Payment Settings
async function getPaymentSettings() {
  return await apiRequest('/payment-settings');
}

async function getSeoSettings() {
  return await apiRequest('/seo');
}

async function updateSeoSettings(data) {
  return await apiRequest('/seo', { method: 'PUT', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
}

async function getGeneralSettings() {
  return await apiRequest('/settings');
}

async function updateGeneralSettings(data) {
  return await apiRequest('/settings', { method: 'PUT', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } });
}

async function updatePaymentSettings(settings) {
  return await apiRequest('/payment-settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  });
}

async function testPaymentConnection() {
  return await apiRequest('/payment-settings/test');
}

// Public payment config (no auth needed)
async function getPublicPaymentConfig() {
  const res = await fetch(API + '/payment-config', {
    headers: { 'Content-Type': 'application/json' }
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Failed to get payment config');
  return data.data;
}

// Razorpay
async function createRazorpayOrder(orderData) {
  return await apiRequest('/razorpay/create-order', {
    method: 'POST',
    body: JSON.stringify(orderData)
  });
}

async function verifyRazorpayPayment(paymentData) {
  return await apiRequest('/razorpay/verify', {
    method: 'POST',
    body: JSON.stringify(paymentData)
  });
}

async function saveRazorpayOrder(orderData) {
  return await apiRequest('/razorpay/save-order', {
    method: 'POST',
    body: JSON.stringify(orderData)
  });
}

// Rewards
async function getRewards(params = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', params.page);
  if (params.limit) q.set('limit', params.limit);
  if (params.search) q.set('search', params.search);
  if (params.status) q.set('status', params.status);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  return await apiRequest('/rewards?' + q.toString());
}

async function getRewardDetail(rewardId) {
  return await apiRequest('/rewards/' + encodeURIComponent(rewardId));
}

async function updateRewardStatus(rewardId, status) {
  return await apiRequest('/rewards/' + encodeURIComponent(rewardId) + '/status', {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}
async function deleteOrders(orderIds) {
  return await apiRequest('/orders/delete', {
    method: 'POST',
    body: JSON.stringify({ orderIds })
  });
}

async function exportOrders(params = {}) {

  const q = new URLSearchParams();

  if (params.status) q.set('status', params.status);

  if (params.from) q.set('from', params.from);

  if (params.to) q.set('to', params.to);

  if (params.format) q.set('format', params.format);



  const token = localStorage.getItem('admin_token');

  const res = await fetch(API + '/orders/export?' + q.toString(), {

    headers: { 'Authorization': 'Bearer ' + token }

  });

  if (!res.ok) throw new Error('Export failed');

  const blob = await res.blob();

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;

  a.download = 'orders_export.' + (params.format === 'excel' ? 'xls' : 'csv');

  a.click();

  URL.revokeObjectURL(url);

}

