'use strict';
/* ═══════════════════════════════════════════════════════════════
   SpareTrack — app.js
   Extends original bike-sales-app with 20 new features.
   All original functions preserved.
   ═══════════════════════════════════════════════════════════════ */

const API = 'http://localhost:5000';

const S = {
  page: 'dashboard', companies: [], models: [], items: [],
  customers: [], bills: [], pendingBills: [], allBillRows: [],
  allPendRows: [], allCustRows: [], allReportRows: [],
  dashboard: null, settings: {},
  activeCompany: null, activeModel: null,
  billItems: [], billCustomer: null, searchTimer: null,
};

// ── Boot ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  loadSettings().then(() => navigateTo('dashboard'));
  document.getElementById('billDate').value = todayISO();
  document.addEventListener('click', e => {
    if (!e.target.closest('#billCustSearch') && !e.target.closest('#billCustDropdown'))
      document.getElementById('billCustDropdown').classList.remove('open');
    if (!e.target.closest('#globalSearch') && !e.target.closest('#searchResults'))
      document.getElementById('searchResults').classList.remove('open');
  });
});

// ── Helpers ────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0,10); }
function fmtINR(n)  { return '₹' + parseFloat(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtDate(s) { if (!s) return '—'; try { return new Date(s).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); } catch{return s;} }
function esc(s)     { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
function b64(file)  { return new Promise((r,j)=>{ const rd=new FileReader(); rd.onload=e=>r(e.target.result); rd.onerror=j; rd.readAsDataURL(file); }); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; }

// ── Navigation ─────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => { navigateTo(el.dataset.page); closeMobileNav(); });
  });
}

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active');
  document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  const meta = {
    dashboard:['Dashboard','Today\'s performance overview'],
    customers:['Customers','Customer management'],
    billing:  ['New Bill','Create a customer bill'],
    bills:    ['All Bills','View and manage bills'],
    pending:  ['Pending Payments','Outstanding payments'],
    companies:['Companies','Manage company catalog'],
    models:   ['Bike Models','Browse bike models'],
    items:    ['Spare Parts','Inventory management'],
    history:  ['Parts History','Transaction history'],
    reports:  ['Reports','Sales analytics and reports'],
    settings: ['Settings','Shop configuration'],
  };
  const [title,sub] = meta[page] || [page,''];
  document.getElementById('pageTitle').textContent    = title;
  document.getElementById('pageSubtitle').textContent = sub;
  S.page = page;
  switch(page) {
    case 'dashboard': loadDashboard(); break;
    case 'customers': loadCustomers(); break;
    case 'billing':   initBilling(); break;
    case 'bills':     loadBills(); break;
    case 'pending':   loadPendingBills(); break;
    case 'companies': loadCompanies(); break;
    case 'models':    loadAllModels(); break;
    case 'items':     loadAllItems(); break;
    case 'history':   loadHistory(); break;
    case 'reports':   initReports(); break;
    case 'settings':  loadSettingsPage(); break;
  }
}

function topbarAdd() {
  const map = {companies:openAddCompany,models:openAddModel,items:openAddItem,customers:openAddCustomer,billing:()=>addBillItem(),bills:()=>navigateTo('billing')};
  (map[S.page] || openAddCustomer)();
}

// Mobile nav
// function openMobileNav()  { document.getElementById('sidebar').classList.add('mobile-open'); document.getElementById('navOverlay').classList.add('open'); }
// function closeMobileNav() { document.getElementById('sidebar').classList.remove('mobile-open'); document.getElementById('navOverlay').classList.remove('open'); }
// Mobile nav
function openMobileNav() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('navOverlay');

  sidebar.classList.add('mobile-open');
  overlay.classList.add('open');
}

function closeMobileNav() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('navOverlay');

  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('open');
}
// ── API ────────────────────────────────────────────────────────
// async function api(url, opts={}) {
//   try {
//     const r = await fetch(API+url, {headers:{'Content-Type':'application/json'}, ...opts});
//     const data = await r.json();
//     if (!r.ok) throw new Error(data.error || 'Request failed');
//     return data;
//   } catch(e) { throw e; }
// }
async function api(url, opts = {}) {
  let lastError;

  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      const r = await fetch(API + url, {
        headers: { 'Content-Type': 'application/json' },
        ...opts
      });

      const data = await r.json();

      if (!r.ok) {
        throw new Error(data.error || 'Request failed');
      }

      return data;
    } catch (e) {
      lastError = e;

      if (attempt < 15) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  throw lastError;
}

// ── Toast ──────────────────────────────────────────────────────
function toast(msg, type='success') {
  const icons = {success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-icon-wrap">${icons[type]||'ℹ️'}</div><div class="toast-msg">${msg}</div>`;
  document.getElementById('toastWrap').prepend(el);
  setTimeout(()=>{ el.classList.add('removing'); setTimeout(()=>el.remove(),280); }, 3500);
}

// ── Modal ──────────────────────────────────────────────────────
function modal(id, title, icon, body, footer, wide=false) {
  document.getElementById(id)?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop'; wrap.id = id;
  wrap.innerHTML = `
    <div class="modal" style="${wide?'max-width:780px':''}">
      <div class="modal-header">
        <div class="modal-title"><div class="modal-title-icon">${icon}</div>${title}</div>
        <button class="modal-close" onclick="closeModal('${id}')">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer?`<div class="modal-footer">${footer}</div>`:''}
    </div>`;
  wrap.addEventListener('click', e=>{ if(e.target===wrap) closeModal(id); });
  document.getElementById('modalsRoot').appendChild(wrap);
  requestAnimationFrame(()=>wrap.classList.add('open'));
  return wrap;
}
function closeModal(id) {
  const el = document.getElementById(id); if(!el) return;
  el.classList.remove('open'); setTimeout(()=>el.remove(), 280);
}
function wireUpload(inpId, prevId) {
  const inp = document.getElementById(inpId); const pre = document.getElementById(prevId);
  if(!inp) return;
  inp.addEventListener('change', async()=>{ if(inp.files[0]){ const d=await b64(inp.files[0]); if(pre){pre.src=d;pre.classList.add('visible');} } });
}

// ── Global search ──────────────────────────────────────────────
const globalSearchDebounced = debounce(async()=>{
  const q = document.getElementById('globalSearch').value.trim();
  const el = document.getElementById('searchResults');
  if(q.length<2){ el.classList.remove('open'); return; }
  try {
    const data = await api(`/search?q=${encodeURIComponent(q)}`);
    let html='';
    if(data.customers?.length){
      html+=`<div class="search-section-head">Customers</div>`;
      html+=data.customers.map(c=>`
        <div class="search-result-item" onclick="viewCustomer(${c.id});document.getElementById('globalSearch').value='';document.getElementById('searchResults').classList.remove('open')">
          <span class="search-result-icon">👤</span>
          <div class="search-result-info"><div class="search-result-name">${esc(c.name)}</div><div class="search-result-sub">${esc(c.mobile)} ${c.city?'· '+esc(c.city):''}</div></div>
        </div>`).join('');
    }
    if(data.bills?.length){
      html+=`<div class="search-section-head">Bills</div>`;
      html+=data.bills.map(b=>`
        <div class="search-result-item" onclick="viewBillModal(${b.id});document.getElementById('globalSearch').value='';document.getElementById('searchResults').classList.remove('open')">
          <span class="search-result-icon">🧾</span>
          <div class="search-result-info"><div class="search-result-name">${esc(b.bill_number)} — ${esc(b.customer_name)}</div><div class="search-result-sub">${fmtINR(b.grand_total)} · ${b.status}</div></div>
        </div>`).join('');
    }
    if(data.items?.length){
      html+=`<div class="search-section-head">Parts</div>`;
      html+=data.items.map(i=>`
        <div class="search-result-item" onclick="navigateTo('items')">
          <span class="search-result-icon">⚙️</span>
          <div class="search-result-info"><div class="search-result-name">${esc(i.name)}</div><div class="search-result-sub">${fmtINR(i.selling_price)} · Qty: ${i.quantity}</div></div>
        </div>`).join('');
    }
    if(!html) html=`<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:13px">No results found</div>`;
    el.innerHTML=html; el.classList.add('open');
  } catch(e){ el.classList.remove('open'); }
}, 300);

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════

async function loadDashboard() {
  try {
    const d = await api('/dashboard'); S.dashboard = d;
    // Update pending badges
    if(d.pending_count>0){
      const el = document.getElementById('pendingBadge2');

if (el && d.pending_count > 0) {
    el.textContent = d.pending_count;
    el.classList.add('show');
}
      // ['pendingBadge','pendingBadge2'].forEach(id=>{ const el=document.getElementById(id); if(el){el.textContent=d.pending_count;el.classList.add('show');} });
    }
    // Stats grid
    document.getElementById('dashStatsGrid').innerHTML = [
      {label:'Today\'s Bills',value:d.today_bills_count,sub:'Bills generated today',cls:'primary',icon:'🧾'},
      {label:'Today\'s Revenue',value:fmtINR(d.today_bills_rev),sub:'From today\'s bills',cls:'success',icon:'💰'},
      {label:'Monthly Revenue',value:fmtINR(d.month_revenue),sub:'This month\'s total',cls:'info',icon:'📈'},
      {label:'Pending Payments',value:fmtINR(d.bills_pending),sub:`${d.pending_count} bills pending`,cls:'danger',icon:'⏳'},
      // {label:'Total Customers',value:d.total_customers,sub:'Registered',cls:'cyan',icon:'👥'},
      // {label:'Total Bills',value:d.total_bills,sub:'All time',cls:'primary',icon:'📑'},
      {label:'Parts Revenue',value:fmtINR(d.revenue_today),sub:'Parts sold today',cls:'success',icon:'⚙️'},
      {label:'Low Stock',value:d.low_stock_count,sub:'Items below 5 units',cls:'warning',icon:'⚠️'},
    ].map(c=>`
      <div class="stat-card ${c.cls}">
        <div class="stat-icon-wrap">${c.icon}</div>
        <div class="stat-label">${c.label}</div>
        <div class="stat-value" style="font-size:${String(c.value).length>8?'18px':'30px'}">${c.value}</div>
        <div class="stat-sub">${c.sub}</div>
      </div>`).join('');

    // Monthly chart
    renderMonthlyChart(d.monthly_chart);
    // Top items
    renderTopItems(d.top_items);
    // Low stock
    renderLowStock(d.low_stock);
    document.getElementById('lowStockBadge').textContent = d.low_stock_count;
    // Recent pending
    renderRecentPending();
  } catch(e) { toast('Dashboard error: '+e.message,'error'); }
}

function renderMonthlyChart(data) {
  const el = document.getElementById('monthlyChart');
  if(!data||!data.length){ el.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;width:100%;color:var(--text-muted);font-size:12px">No billing data yet</div>`; return; }
  const maxRev = Math.max(...data.map(d=>d.revenue),1);
  el.innerHTML = data.map(d=>{
    const h = Math.max((d.revenue/maxRev)*100, d.revenue>0?4:0);
    const [yr,mo] = d.month.split('-');
    const label = new Date(yr,parseInt(mo)-1).toLocaleDateString('en-IN',{month:'short'});
    return `<div class="chart-col">
      <div class="chart-bars-wrap"><div class="chart-bar revenue" style="height:${h}%" title="${fmtINR(d.revenue)} (${d.bill_count} bills)"></div></div>
      <div class="chart-day-label">${label}</div>
    </div>`;
  }).join('');
}

function renderTopItems(items) {
  const el = document.getElementById('topItemsList');
  if(!items||!items.length){ el.innerHTML=`<div class="empty-state" style="padding:28px"><div class="empty-icon">🏆</div><div class="empty-sub">No sales recorded yet</div></div>`; return; }
  const maxSold = Math.max(...items.map(i=>i.total_sold));
  el.innerHTML = items.map((item,idx)=>`
    <div style="padding:10px 20px;border-bottom:1px solid rgba(79,70,229,0.05);display:flex;align-items:center;gap:12px">
      <div style="width:26px;height:26px;border-radius:8px;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0">${idx+1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.name)}</div>
        <div class="progress-bar-wrap" style="margin-top:4px"><div class="progress-bar" style="width:${(item.total_sold/maxSold)*100}%"></div></div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-family:'Poppins',sans-serif;font-size:13px;font-weight:700;color:var(--primary)">${fmtINR(item.revenue||0)}</div>
        <div style="font-size:10px;color:var(--text-muted)">${item.total_sold} sold</div>
      </div>
    </div>`).join('');
}

function renderLowStock(items) {
  const el = document.getElementById('lowStockBody');
  if(!items||!items.length){ el.innerHTML=`<div class="empty-state" style="padding:24px"><div class="empty-icon">✅</div><div class="empty-title">All stocked up!</div></div>`; return; }
  el.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Part</th><th>Model</th><th>Stock</th><th>Action</th></tr></thead><tbody>
    ${items.map(i=>`<tr>
      <td><strong>${esc(i.name)}</strong></td><td style="color:var(--text-muted)">${esc(i.model_name)}</td>
      <td><span style="font-family:'Poppins',sans-serif;font-weight:700;color:${i.quantity===0?'var(--danger)':'var(--warning)'}">${i.quantity}</span></td>
      <td><button class="btn btn-success btn-sm" onclick="openStockModal('add',${i.id},'${esc(i.name)}',${i.quantity})">+ Restock</button></td>
    </tr>`).join('')}
  </tbody></table></div>`;
}

async function renderRecentPending() {
  try {
    const data = await api('/pending_bills');
    const el = document.getElementById('recentPendingBody');
    const recent = data.slice(0,5);
    if(!recent.length){ el.innerHTML=`<div class="empty-state" style="padding:24px"><div class="empty-icon">✅</div><div class="empty-sub">No pending bills</div></div>`; return; }
    el.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Customer</th><th>Bill No</th><th>Pending</th><th></th></tr></thead><tbody>
      ${recent.map(b=>`<tr>
        <td><strong>${esc(b.customer_name)}</strong><br><span style="font-size:11px;color:var(--text-muted)">${esc(b.customer_mobile)}</span></td>
        <td style="font-family:'Poppins',sans-serif;font-size:12px;color:var(--primary)">${esc(b.bill_number)}</td>
        <td style="font-family:'Poppins',sans-serif;font-weight:700;color:var(--danger)">${fmtINR(b.pending)}</td>
        <td><button class="btn btn-warning btn-sm" onclick="openPaymentModal(${b.id},'${esc(b.bill_number)}',${b.grand_total},${b.pending})">Pay</button></td>
      </tr>`).join('')}
    </tbody></table></div>`;
  } catch(e){}
}

// ══════════════════════════════════════════════════════════════
// CUSTOMERS
// ══════════════════════════════════════════════════════════════

async function loadCustomers() {
  const tbody = document.getElementById('custTbody');
  tbody.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:36px"><div class="spinner" style="margin:auto"></div></td></tr>`;
  try {
    S.customers = await api('/customers');
    S.allCustRows = S.customers;
    renderCustomersTable(S.customers);
    document.getElementById('custCnt').textContent = S.customers.length;
  } catch(e) { toast('Error loading customers: '+e.message,'error'); }
}

function renderCustomersTable(list) {
  const tbody = document.getElementById('custTbody');
  if(!list.length){ tbody.innerHTML=`<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">No customers yet</div><div class="empty-sub">Add your first customer</div></div></td></tr>`; return; }
  tbody.innerHTML = list.map(c=>`
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:10px;background:var(--grad-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0">${esc(c.name.charAt(0).toUpperCase())}</div>
          <div><div style="font-weight:600">${esc(c.name)}</div><div style="font-size:11px;color:var(--text-muted)">${esc(c.email||'')}</div></div>
        </div>
      </td>
      <td>${esc(c.mobile)}</td>
      <td class="hide-mobile">${esc(c.city||'—')}</td>
      <td>${c.bill_count||0}</td>
      <td style="font-family:'Poppins',sans-serif;font-weight:600;color:var(--success)">${fmtINR(c.total_paid)}</td>
      <td style="font-family:'Poppins',sans-serif;font-weight:600;color:${(c.total_pending||0)>0?'var(--danger)':'var(--success)'}">
        ${(c.total_pending||0)>0?fmtINR(c.total_pending):'<span style="color:var(--success)">✅ Clear</span>'}
      </td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="viewCustomer(${c.id})" title="View">👁️</button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="openEditCustomer(${c.id})" title="Edit">✏️</button>
          <button class="btn btn-danger btn-sm btn-icon" onclick="deleteCustomer(${c.id},'${esc(c.name)}')" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>`).join('');
}

function filterCustomers() {
  const q = document.getElementById('custSearch').value.toLowerCase();
  renderCustomersTable(S.allCustRows.filter(c=>c.name.toLowerCase().includes(q)||c.mobile.includes(q)||(c.city||'').toLowerCase().includes(q)));
}

// Add customer
function openAddCustomer() {
  modal('mCust','Add Customer','👤',custFormHTML(),'<button class="btn btn-ghost" onclick="closeModal(\'mCust\')">Cancel</button><button class="btn btn-primary" onclick="submitAddCustomer()">Add Customer</button>');
  document.getElementById('custName').focus();
}

function custFormHTML(c={}) {
  return `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Customer Name *</label><input class="form-control" id="custName" value="${esc(c.name||'')}" placeholder="Full name"></div>
      <div class="form-group"><label class="form-label">Mobile *</label><input class="form-control" id="custMobile" value="${esc(c.mobile||'')}" placeholder="10-digit mobile"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Alt. Mobile</label><input class="form-control" id="custAltMobile" value="${esc(c.alt_mobile||'')}" placeholder="Optional"></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-control" id="custEmail" type="email" value="${esc(c.email||'')}" placeholder="Optional"></div>
    </div>
    <div class="form-group"><label class="form-label">Address</label><textarea class="form-control" id="custAddress" rows="2" placeholder="Street address">${esc(c.address||'')}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">City</label><input class="form-control" id="custCity" value="${esc(c.city||'')}" placeholder="City"></div>
      <div class="form-group"><label class="form-label">Notes</label><input class="form-control" id="custNotes" value="${esc(c.notes||'')}" placeholder="Optional notes"></div>
    </div>`;
}

function custFormData() {
  return {
    name:      document.getElementById('custName').value.trim(),
    mobile:    document.getElementById('custMobile').value.trim(),
    alt_mobile:document.getElementById('custAltMobile').value.trim(),
    email:     document.getElementById('custEmail').value.trim(),
    address:   document.getElementById('custAddress').value.trim(),
    city:      document.getElementById('custCity').value.trim(),
    notes:     document.getElementById('custNotes').value.trim(),
  };
}

async function submitAddCustomer() {
  const d = custFormData();
  if(!d.name)   { toast('Name required','warning'); return; }
  if(!d.mobile) { toast('Mobile required','warning'); return; }
  try { await api('/add_customer',{method:'POST',body:JSON.stringify(d)}); toast(`"${d.name}" added!`); closeModal('mCust'); loadCustomers(); } catch(e) { toast(e.message,'error'); }
}

function openEditCustomer(id) {
  const c = S.allCustRows.find(x=>x.id===id); if(!c) return;
  modal('mCust','Edit Customer','✏️',custFormHTML(c),'<button class="btn btn-ghost" onclick="closeModal(\'mCust\')">Cancel</button><button class="btn btn-warning" onclick="submitEditCustomer('+id+')">Save Changes</button>');
}

async function submitEditCustomer(id) {
  const d = custFormData();
  if(!d.name||!d.mobile) { toast('Name and mobile required','warning'); return; }
  try { await api(`/update_customer/${id}`,{method:'PUT',body:JSON.stringify(d)}); toast('Customer updated!'); closeModal('mCust'); loadCustomers(); } catch(e) { toast(e.message,'error'); }
}

async function deleteCustomer(id,name) {
  if(!confirm(`Delete "${name}"?\nAll bills will remain but customer cannot be linked.`)) return;
  try { await api(`/delete_customer/${id}`,{method:'DELETE'}); toast(`"${name}" deleted.`,'warning'); loadCustomers(); } catch(e) { toast(e.message,'error'); }
}

async function viewCustomer(id) {
  try {
    const c = await api(`/customers/${id}`);
    const pendingAmt = parseFloat(c.total_pending||0);
    modal('mCustView',`${c.name} — Profile`,'👤',`
      <div class="cust-profile-header">
        <div class="cust-avatar">${c.name.charAt(0).toUpperCase()}</div>
        <div>
          <div style="font-size:16px;font-weight:700">${esc(c.name)}</div>
          <div style="font-size:13px;color:var(--text-muted)">📞 ${esc(c.mobile)} ${c.email?'· '+esc(c.email):''}</div>
          <div style="font-size:12px;color:var(--text-muted)">${c.address?esc(c.address)+', ':''} ${esc(c.city||'')}</div>
        </div>
      </div>
      <div class="cust-profile-stats">
        <div class="cust-stat"><div class="cust-stat-val">${c.bill_count||0}</div><div class="cust-stat-lbl">Total Bills</div></div>
        <div class="cust-stat"><div class="cust-stat-val" style="font-size:14px">${fmtINR(c.total_amount)}</div><div class="cust-stat-lbl">Total Purchase</div></div>
        <div class="cust-stat"><div class="cust-stat-val" style="color:var(--success);font-size:14px">${fmtINR(c.total_paid)}</div><div class="cust-stat-lbl">Total Paid</div></div>
        <div class="cust-stat"><div class="cust-stat-val" style="color:${pendingAmt>0?'var(--danger)':'var(--success)'};font-size:14px">${fmtINR(c.total_pending)}</div><div class="cust-stat-lbl">Total Pending</div></div>
      </div>
      <div style="font-weight:700;margin-bottom:10px;font-size:13px">Bill History — All Years (Newest First)</div>
      ${c.bills&&c.bills.length?`<div class="table-wrap"><table><thead><tr><th>Bill No</th><th>Date</th><th>Items Purchased</th><th>Total</th><th>Paid</th><th>Pending</th><th>Status</th><th></th></tr></thead><tbody>
        ${c.bills.map(b=>`<tr>
          <td style="font-family:'Poppins',sans-serif;color:var(--primary);font-size:12px">${esc(b.bill_number)}</td>
          <td>${fmtDate(b.bill_date)}</td>
          <td style="font-size:12px;color:var(--text-muted)">${(b.items||[]).map(it=>`${esc(it.item_name)} ×${it.quantity}`).join(', ')||'—'}</td>
          <td style="font-weight:600">${fmtINR(b.grand_total)}</td>
          <td style="color:var(--success)">${fmtINR(b.amount_paid)}</td>
          <td style="color:${b.pending>0?'var(--danger)':'var(--success)'}">${fmtINR(b.pending)}</td>
          <td><span class="badge status-${b.status}">${b.status.toUpperCase()}</span></td>
          <td><button class="btn btn-ghost btn-sm" onclick="closeModal('mCustView');viewBillModal(${b.id})">View</button></td>
        </tr>`).join('')}
      </tbody></table></div>`:`<div class="empty-state" style="padding:24px"><div class="empty-icon">🧾</div><div class="empty-sub">No bills yet</div></div>`}
    `,`<button class="btn btn-ghost" onclick="closeModal('mCustView')">Close</button>
       <button class="btn btn-primary" onclick="closeModal('mCustView');prefillBillingCustomer(${c.id},'${esc(c.name)}','${esc(c.mobile)}')">+ New Bill</button>`,true);
  } catch(e) { toast(e.message,'error'); }
}

// ══════════════════════════════════════════════════════════════
// BILLING
// ══════════════════════════════════════════════════════════════

function initBilling() {
  if(!S.billItems.length) addBillItem();
  document.getElementById('billDate').value = document.getElementById('billDate').value || todayISO();
  recalcBill();
  // Bill preview number
  api('/settings').then(s=>{ const p=s.bill_prefix||'BILL'; const n=parseInt(s.bill_counter||1000); document.getElementById('billNoPreview').textContent=`Bill # ${p}-${String(n).padStart(5,'0')}`; }).catch(()=>{});
}

function resetBilling() {
  S.billItems=[]; S.billCustomer=null;
  document.getElementById('billCustSearch').value='';
  document.getElementById('billCustId').value='';
  document.getElementById('billCustInfo').style.display='none';
  document.getElementById('billDate').value=todayISO();
  document.getElementById('billDiscount').value='0';
  document.getElementById('billAmountPaid').value='0';
  document.getElementById('billNotes').value='';
  addBillItem(); recalcBill();
}

function addBillItem() {
  const idx = S.billItems.length;
  S.billItems.push({item_name:'',quantity:1,unit_price:0,total:0});
  renderBillItems();
}

function removeBillItem(idx) {
  S.billItems.splice(idx,1);
  if(!S.billItems.length) addBillItem();
  else renderBillItems();
  recalcBill();
}

function renderBillItems() {
  const tbody = document.getElementById('billItemsBody');
  tbody.innerHTML = S.billItems.map((it,idx)=>`
    <tr>
      <td><input placeholder="Item name…" value="${esc(it.item_name)}" oninput="updateBillItem(${idx},'item_name',this.value)"></td>
      <td><input type="number" min="1" value="${it.quantity}" style="width:60px" oninput="updateBillItem(${idx},'quantity',this.value)"></td>
      <td><input type="number" min="0" step="0.01" value="${it.unit_price}" placeholder="0.00" oninput="updateBillItem(${idx},'unit_price',this.value)"></td>
      <td class="item-total-cell">${fmtINR(it.total)}</td>
      <td><button class="remove-item-btn" onclick="removeBillItem(${idx})">✕</button></td>
    </tr>`).join('');
}

function updateBillItem(idx, field, val) {
  S.billItems[idx][field] = field==='item_name' ? val : parseFloat(val)||0;
  if(field==='quantity'||field==='unit_price') {
    S.billItems[idx].total = round2(S.billItems[idx].quantity * S.billItems[idx].unit_price);
    document.querySelectorAll('#billItemsBody tr')[idx].querySelectorAll('.item-total-cell')[0].textContent = fmtINR(S.billItems[idx].total);
  }
  recalcBill();
}

function recalcBill() {
  const subtotal    = round2(S.billItems.reduce((a,b)=>a+b.total,0));
  const discount    = parseFloat(document.getElementById('billDiscount').value)||0;
  const grand       = round2(Math.max(subtotal-discount,0));
  const paid        = parseFloat(document.getElementById('billAmountPaid').value)||0;
  const pending     = round2(Math.max(grand-paid,0));
  const status      = paid<=0?'pending':paid>=grand?'paid':'partial';
  document.getElementById('sumSubtotal').textContent   = fmtINR(subtotal);
  document.getElementById('sumGrandTotal').textContent = fmtINR(grand);
  document.getElementById('sumPending').textContent    = fmtINR(pending);
  const statusEl = document.getElementById('sumStatus');
  const cls = {paid:'badge-success',partial:'badge-warning',pending:'badge-danger'};
  statusEl.innerHTML = `<span class="badge ${cls[status]}">${status.toUpperCase()}</span>`;
}

function round2(n) { return Math.round(n*100)/100; }

async function searchCustomerForBill() {
  const q = document.getElementById('billCustSearch').value.trim();
  const dd = document.getElementById('billCustDropdown');
  if(q.length<1){ dd.classList.remove('open'); return; }
  try {
    const data = await api(`/customers?q=${encodeURIComponent(q)}`);
    if(!data.length){ dd.innerHTML=`<div class="cust-dd-item" style="color:var(--text-muted)">No customers found — <a href="#" onclick="openAddCustomer();return false">Add new</a></div>`; }
    else { dd.innerHTML=data.slice(0,8).map(c=>`<div class="cust-dd-item" onclick="selectBillCustomer(${c.id},'${esc(c.name)}','${esc(c.mobile)}','${esc(c.city||'')}',${c.total_pending||0})"><div class="cust-dd-name">${esc(c.name)}</div><div class="cust-dd-sub">${esc(c.mobile)} ${c.city?'· '+esc(c.city):''} ${(c.total_pending||0)>0?'· <span style="color:var(--danger)">Pending: '+fmtINR(c.total_pending)+'</span>':''}</div></div>`).join(''); }
    dd.classList.add('open');
  } catch(e){}
}

function selectBillCustomer(id,name,mobile,city,pending) {
  document.getElementById('billCustSearch').value=name;
  document.getElementById('billCustomerMobile').value=mobile;
  S.billCustomer={id,name,mobile};
  document.getElementById('billCustSearch').value=name;
  document.getElementById('billCustId').value=id;
  document.getElementById('billCustDropdown').classList.remove('open');
  const info = document.getElementById('billCustInfo');
  info.innerHTML=`<strong>${esc(name)}</strong> · 📞 ${esc(mobile)} ${city?'· '+esc(city):''} ${pending>0?`· <span style="color:var(--danger);font-weight:700">Pending: ${fmtINR(pending)}</span>`:''}`;
  info.style.display='block';
}

function prefillBillingCustomer(id,name,mobile) {
  navigateTo('billing');
  setTimeout(()=>selectBillCustomer(id,name,mobile,'',0),100);
}

async function submitBill() {

  const cid = document.getElementById('billCustId').value || null;

const customer_name =
    document.getElementById('billCustSearch').value.trim();

const customer_mobile =
    document.getElementById('billCustomerMobile').value.trim();

if (!cid && !customer_name) {
    toast('Enter customer name', 'warning');
    return;
}

const validItems = S.billItems.filter(
    i => i.item_name.trim() &&
         i.quantity > 0 &&
         i.unit_price >= 0
);

  const discount =
    parseFloat(document.getElementById('billDiscount').value) || 0;

  const amount_paid =
    parseFloat(document.getElementById('billAmountPaid').value) || 0;

  const bill_date =
    document.getElementById('billDate').value || todayISO();

  const notes =
    document.getElementById('billNotes').value.trim();

  const method =
    document.getElementById('billPayMethod').value;

  try {

    const res = await api('/add_bill', {
      method: 'POST',
      body: JSON.stringify({
    customer_id: cid ? parseInt(cid) : null,

    customer_name:
        document.getElementById('billCustSearch').value.trim(),

    customer_mobile:
        document.getElementById('billCustomerMobile').value.trim(),
        items: validItems,
        discount: discount,
        amount_paid: amount_paid,
        bill_date: bill_date,
        notes: notes,
        payment_method: method
      })
    });

    toast(`Bill ${res.bill_number} created!`);

    resetBilling();

    viewBillModal(res.id);

  } catch (e) {
    toast(e.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════
// BILLS LIST
// ══════════════════════════════════════════════════════════════

async function loadBills() {
  const tbody = document.getElementById('billsTbody');
  tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:36px"><div class="spinner" style="margin:auto"></div></td></tr>`;
  try {
    const status = document.getElementById('billsStatusFilter').value;
    S.bills = await api('/bills'+(status?`?status=${status}`:''));
    S.allBillRows = S.bills;
    renderBillsTable(S.bills);
    document.getElementById('billsCnt').textContent = S.bills.length;
  } catch(e) { toast('Error: '+e.message,'error'); }
}

function renderBillsTable(list) {

  const tbody = document.getElementById('billsTbody');

  if(!list.length){
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <div class="empty-icon">📑</div>
            <div class="empty-title">No bills found</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  let html = '';
  let currentDate = '';

  list.forEach(b => {

    if(currentDate !== b.bill_date){

      currentDate = b.bill_date;

      html += `
      <tr style="
        background:#f3f4f6;
        font-weight:bold;
      ">
        <td colspan="8">
          📅 ${fmtDate(currentDate)}
        </td>
      </tr>`;
    }

    html += `
      <tr>
        <td style="font-family:'Poppins',sans-serif;font-size:12px;color:var(--primary);font-weight:600">
          ${esc(b.bill_number)}
        </td>

        <td>${fmtDate(b.bill_date)}</td>

        <td>
          <strong>${esc(b.customer_name)}</strong><br>
          <span style="font-size:11px;color:var(--text-muted)">
            ${esc(b.customer_mobile)}
          </span>
        </td>

        <td style="font-weight:600">
          ${fmtINR(b.grand_total)}
        </td>

        <td style="color:var(--success)">
          ${fmtINR(b.amount_paid)}
        </td>

        <td style="color:var(--danger);font-weight:600">
          ${fmtINR(b.pending)}
        </td>

        <td>
          <span class="badge status-${b.status}">
            ${b.status.toUpperCase()}
          </span>
        </td>

        <td>
          <div style="display:flex;gap:5px">
            <button class="btn btn-ghost btn-sm btn-icon"
                    onclick="viewBillModal(${b.id})">
              👁️
            </button>

            ${b.status!=='paid'
              ? `<button class="btn btn-warning btn-sm btn-icon"
                  onclick="openPaymentModal(${b.id},'${esc(b.bill_number)}',${b.grand_total},${b.pending})">
                  💰
                </button>`
              : ''}

            <button class="btn btn-danger btn-sm btn-icon"
                    onclick="deleteBill(${b.id},'${esc(b.bill_number)}')">
              🗑️
            </button>
          </div>
        </td>
      </tr>`;
  });

  tbody.innerHTML = html;
}

function filterBillsTable() {
  const q = document.getElementById('billsSearch').value.toLowerCase();
  renderBillsTable(S.allBillRows.filter(b=>b.bill_number.toLowerCase().includes(q)||b.customer_name.toLowerCase().includes(q)||b.customer_mobile.includes(q)));
}

async function viewBillModal(id) {
  try {
    const b = await api(`/bills/${id}`);
    const waRes = await api(`/whatsapp_message/${id}`).catch(()=>null);
    const statusCls = {paid:'badge-success',partial:'badge-warning',pending:'badge-danger'};
    modal('mBillView',`Invoice — ${b.bill_number}`,'🧾',`
      <div class="bill-modal-header">
        <div>
          <div style="font-size:14px;font-weight:700">${esc(b.customer_name)}</div>
          <div style="font-size:12px;color:var(--text-muted)">${esc(b.customer_mobile)} ${b.customer_city?'· '+esc(b.customer_city):''}</div>
        </div>
        <div class="bill-modal-actions">
          <a href="${API}/invoice_pdf/${id}" class="btn btn-info btn-sm" target="_blank">📄 PDF</a>
          ${waRes?`<a href="${waRes.whatsapp_url}" class="btn btn-success btn-sm" target="_blank">📲 WhatsApp</a>`:''}
          ${b.status!=='paid'?`<button class="btn btn-warning btn-sm" onclick="closeModal('mBillView');openPaymentModal(${id},'${esc(b.bill_number)}',${b.grand_total},${b.pending})">💰 Add Payment</button>`:''}
        </div>
      </div>
      <div class="invoice-info-grid">
        <div class="invoice-info-row"><span class="invoice-info-label">Bill Number</span><span class="invoice-info-value">${esc(b.bill_number)}</span></div>
        <div class="invoice-info-row"><span class="invoice-info-label">Date</span><span class="invoice-info-value">${fmtDate(b.bill_date)}</span></div>
        <div class="invoice-info-row"><span class="invoice-info-label">Status</span><span class="invoice-info-value"><span class="badge ${statusCls[b.status]}">${b.status.toUpperCase()}</span></span></div>
        <div class="invoice-info-row"><span class="invoice-info-label">Address</span><span class="invoice-info-value">${esc(b.customer_address||'—')}</span></div>
      </div>
      <div class="divider"></div>
      <div class="table-wrap" style="margin-bottom:12px"><table>
        <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
        <tbody>${(b.items||[]).map((it,idx)=>`<tr><td>${idx+1}</td><td>${esc(it.item_name)}</td><td>${it.quantity}</td><td>${fmtINR(it.unit_price)}</td><td style="font-weight:600;color:var(--primary)">${fmtINR(it.total)}</td></tr>`).join('')}</tbody>
      </table></div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <div style="min-width:240px">
          <div class="summary-row"><span>Subtotal</span><span>${fmtINR(b.subtotal)}</span></div>
          <div class="summary-row"><span>Discount</span><span>- ${fmtINR(b.discount)}</span></div>
          <div class="summary-row summary-grand"><span>Grand Total</span><span>${fmtINR(b.grand_total)}</span></div>
          <div class="summary-row"><span>Amount Paid</span><span style="color:var(--success)">${fmtINR(b.amount_paid)}</span></div>
          <div class="summary-row summary-pending"><span>Pending</span><span>${fmtINR(b.pending)}</span></div>
        </div>
      </div>
      ${b.payments&&b.payments.length?`<div class="divider"></div><div style="font-weight:700;margin-bottom:8px;font-size:13px">Payment History</div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Method</th><th>Amount</th><th>Note</th></tr></thead><tbody>${b.payments.map(p=>`<tr><td>${p.paid_at.slice(0,10)}</td><td>${p.method.toUpperCase()}</td><td style="color:var(--success);font-weight:600">${fmtINR(p.amount)}</td><td>${esc(p.note||'—')}</td></tr>`).join('')}</tbody></table></div>`:''}
    `,`<button class="btn btn-ghost" onclick="closeModal('mBillView')">Close</button>`,true);
  } catch(e) { toast(e.message,'error'); }
}

async function deleteBill(id, billNo) {
  if(!confirm(`Delete bill "${billNo}"?`)) return;
  try { await api(`/delete_bill/${id}`,{method:'DELETE'}); toast(`Bill deleted.`,'warning'); loadBills(); } catch(e) { toast(e.message,'error'); }
}

// ══════════════════════════════════════════════════════════════
// PAYMENT MODAL
// ══════════════════════════════════════════════════════════════

function openPaymentModal(billId, billNo, grandTotal, pending) {
  modal('mPayment','Add Payment','💰',`
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:12px;color:var(--text-muted)">Recording payment for</div>
      <div style="font-weight:700;font-size:15px;margin:4px 0">${esc(billNo)}</div>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:16px">
      <div class="report-stat-card" style="flex:1"><div class="report-stat-val" style="color:var(--primary)">${fmtINR(grandTotal)}</div><div class="report-stat-lbl">Total</div></div>
      <div class="report-stat-card" style="flex:1"><div class="report-stat-val" style="color:var(--danger)">${fmtINR(pending)}</div><div class="report-stat-lbl">Pending</div></div>
    </div>
    <div class="form-group"><label class="form-label">Amount Paying (₹) *</label>
      <input class="form-control" id="payAmount" type="number" min="0.01" step="0.01" value="${pending}" style="font-size:20px;font-family:Poppins,sans-serif;font-weight:700;text-align:center;color:var(--success)">
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Payment Method</label>
        <select class="form-control" id="payMethod">
          <option value="cash">💵 Cash</option><option value="upi">📱 UPI</option>
          <option value="card">💳 Card</option><option value="bank">🏦 Bank Transfer</option><option value="other">Other</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Note (Optional)</label><input class="form-control" id="payNote" placeholder="e.g. Online transfer"></div>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal('mPayment')">Cancel</button>
     <button class="btn btn-success" onclick="submitPayment(${billId})">💰 Record Payment</button>`);
  setTimeout(()=>document.getElementById('payAmount')?.select(),100);
}

async function submitPayment(billId) {
  const amount = parseFloat(document.getElementById('payAmount').value);
  const method = document.getElementById('payMethod').value;
  const note   = document.getElementById('payNote').value.trim();
  if(!amount||amount<=0) { toast('Enter a valid amount','warning'); return; }
  try {
    const res = await api('/add_payment',{method:'POST',body:JSON.stringify({bill_id:billId,amount,method,note})});
    toast(`Payment of ${fmtINR(amount)} recorded! Status: ${res.status.toUpperCase()}`);
    closeModal('mPayment');
    if(S.page==='bills')   loadBills();
    if(S.page==='pending') loadPendingBills();
    if(S.page==='dashboard') loadDashboard();
  } catch(e) { toast(e.message,'error'); }
}

// ══════════════════════════════════════════════════════════════
// PENDING BILLS
// ══════════════════════════════════════════════════════════════

async function loadPendingBills() {
  const tbody = document.getElementById('pendTbody');
  tbody.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:36px"><div class="spinner" style="margin:auto"></div></td></tr>`;
  try {
    S.pendingBills = await api('/pending_bills');
    S.allPendRows = S.pendingBills;
    renderPendingTable(S.pendingBills);
    document.getElementById('pendCnt').textContent = S.pendingBills.length;
  } catch(e) { toast('Error: '+e.message,'error'); }
}

function renderPendingTable(list) {
  const tbody = document.getElementById('pendTbody');
  if(!list.length){ tbody.innerHTML=`<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">No pending payments!</div></div></td></tr>`; return; }
  tbody.innerHTML = list.map(b=>`
    <tr style="background:${b.status==='pending'?'rgba(239,68,68,0.02)':''}">
      <td style="font-family:'Poppins',sans-serif;font-size:12px;color:var(--primary)">${esc(b.bill_number)}</td>
      <td><strong>${esc(b.customer_name)}</strong></td>
      <td>${esc(b.customer_mobile)}</td>
      <td class="hide-mobile">${fmtDate(b.bill_date)}</td>
      <td style="font-weight:600">${fmtINR(b.grand_total)}</td>
      <td style="color:var(--success)">${fmtINR(b.amount_paid)}</td>
      <td style="font-family:'Poppins',sans-serif;font-weight:800;color:var(--danger)">${fmtINR(b.pending)}</td>
      <td><span class="badge status-${b.status}">${b.status.toUpperCase()}</span></td>
      <td>
        <div style="display:flex;gap:5px">
          <button class="btn btn-ghost btn-sm btn-icon" onclick="viewBillModal(${b.id})">👁️</button>
          <button class="btn btn-warning btn-sm btn-icon" onclick="openPaymentModal(${b.id},'${esc(b.bill_number)}',${b.grand_total},${b.pending})">💰</button>
        </div>
      </td>
    </tr>`).join('');
}

function filterPendingTable() {
  const q = document.getElementById('pendSearch').value.toLowerCase();
  renderPendingTable(S.allPendRows.filter(b=>b.customer_name.toLowerCase().includes(q)||b.customer_mobile.includes(q)||b.bill_number.toLowerCase().includes(q)));
}

// ══════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════

function initReports() {
  document.getElementById('reportStart').value = todayISO();
  document.getElementById('reportEnd').value   = todayISO();
}

function onReportTypeChange() {
  const rt = document.getElementById('reportType').value;
  document.getElementById('reportDateRange').style.display = rt==='custom'?'block':'none';
}

async function loadReportData() {
  const rt    = document.getElementById('reportType').value;
  const start = document.getElementById('reportStart').value;
  const end   = document.getElementById('reportEnd').value;
  let url = `/report/data?type=${rt}`;
  if(rt==='custom'&&start&&end) url+=`&start=${start}&end=${end}`;
  try {
    const data = await api(url);

if (
    document.getElementById('reportType').value ===
    'pending'
) {
    data.bills = data.bills.filter(
        b =>
            b.status === 'pending' ||
            b.status === 'partial'
    );
}

const s = data.summary;
S.allReportRows = data.bills;
    document.getElementById('reportSummary').innerHTML=`
      <div class="report-summary-grid">
        <div class="report-stat-card"><div class="report-stat-val" style="color:var(--primary)">${s.bill_count}</div><div class="report-stat-lbl">Bills</div></div>
        <div class="report-stat-card"><div class="report-stat-val" style="color:var(--success);font-size:18px">${fmtINR(s.total_revenue)}</div><div class="report-stat-lbl">Revenue</div></div>
        <div class="report-stat-card"><div class="report-stat-val" style="color:var(--info);font-size:18px">${fmtINR(s.total_paid)}</div><div class="report-stat-lbl">Collected</div></div>
        <div class="report-stat-card"><div class="report-stat-val" style="color:var(--danger);font-size:18px">${fmtINR(s.total_pending)}</div><div class="report-stat-lbl">Pending</div></div>
      </div>`;
    let bills = data.bills;

if (
    document.getElementById('reportType').value ===
    'pending'
) {
    bills = bills.filter(
        b =>
            b.status === 'pending' ||
            b.status === 'partial'
    );
}

renderReportTable(bills);
    document.getElementById('reportTableCard').style.display='block';
  } catch(e) { toast(e.message,'error'); }
}

function renderReportTable(bills) {
  const tbody = document.getElementById('reportTbody');
  if(!bills.length){ tbody.innerHTML=`<tr><td colspan="9"><div class="empty-state" style="padding:24px"><div class="empty-icon">📋</div><div class="empty-sub">No data for this period</div></div></td></tr>`; return; }
  tbody.innerHTML = bills.map(b=>`
    <tr>
      <td style="font-family:'Poppins',sans-serif;color:var(--primary);font-size:12px">${esc(b.bill_number)}</td>
      <td>${fmtDate(b.bill_date)}</td>
      <td>${esc(b.customer_name)}</td>
      <td class="hide-mobile">${esc(b.customer_mobile)}</td>
      <td style="font-weight:600">${fmtINR(b.grand_total)}</td>
      <td style="color:var(--success)">${fmtINR(b.amount_paid)}</td>
      <td style="color:var(--danger)">${fmtINR(b.pending)}</td>
      <td><span class="badge status-${b.status}">${b.status.toUpperCase()}</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="viewBillModal(${b.id})">View</button></td>
    </tr>`).join('');
}

function downloadReportPDF() {
  const rt=document.getElementById('reportType').value; const start=document.getElementById('reportStart').value; const end=document.getElementById('reportEnd').value;
  let url=`${API}/report/pdf?type=${rt}`;
  if(rt==='custom'&&start&&end) url+=`&start=${start}&end=${end}`;
  window.open(url,'_blank');
}
function downloadReportExcel() {
  const rt=document.getElementById('reportType').value; const start=document.getElementById('reportStart').value; const end=document.getElementById('reportEnd').value;
  let url=`${API}/report/excel?type=${rt}`;
  if(rt==='custom'&&start&&end) url+=`&start=${start}&end=${end}`;
  window.open(url,'_blank');
}

// ══════════════════════════════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════════════════════════════

async function loadSettings() {
  try {
    const s = await api('/settings'); S.settings = s;
    if(s.shop_name) {
      document.getElementById('sidebarShopName').textContent = s.shop_name;
      document.title = s.shop_name + ' — Management';
    }
    return s;
  } catch(e) { return {}; }
}

async function loadSettingsPage() {
  try {
    const s = await api('/settings'); S.settings = s;
    document.getElementById('stShopName').value    = s.shop_name||'';
    document.getElementById('stShopAddress').value = s.shop_address||'';
    document.getElementById('stShopMobile').value  = s.shop_mobile||'';
    document.getElementById('stShopEmail').value   = s.shop_email||'';
    document.getElementById('stShopGst').value     = s.shop_gst||'';
    document.getElementById('stBillPrefix').value  = s.bill_prefix||'BILL';
    const prev = document.getElementById('stLogoPreview');
    if(s.shop_logo){ prev.src=API+s.shop_logo; prev.classList.add('visible'); }
    wireUpload('stLogoFile','stLogoPreview');
  } catch(e) { toast('Error loading settings','error'); }
}

async function saveSettings() {
  const file = document.getElementById('stLogoFile').files[0];
  const logo = file ? await b64(file) : null;
  const d = {
    shop_name:    document.getElementById('stShopName').value.trim(),
    shop_address: document.getElementById('stShopAddress').value.trim(),
    shop_mobile:  document.getElementById('stShopMobile').value.trim(),
    shop_email:   document.getElementById('stShopEmail').value.trim(),
    shop_gst:     document.getElementById('stShopGst').value.trim(),
    bill_prefix:  document.getElementById('stBillPrefix').value.trim()||'BILL',
  };
  if(logo) d.shop_logo = logo;
  try {
    await api('/settings',{method:'POST',body:JSON.stringify(d)});
    toast('Settings saved!');
    await loadSettings();
  } catch(e) { toast(e.message,'error'); }
}

async function restoreBackup() {
  const file = document.getElementById('restoreFile').files[0];
  if(!file) { toast('Select a .db file first','warning'); return; }
  if(!confirm('Restore will replace all current data. Are you sure?')) return;
  const fd = new FormData(); fd.append('file',file);
  try {
    const r = await fetch(`${API}/restore`,{method:'POST',body:fd});
    const d = await r.json();
    if(!r.ok) throw new Error(d.error);
    toast('Database restored! Refreshing…');
    setTimeout(()=>location.reload(),1500);
  } catch(e) { toast(e.message,'error'); }
}

// ══════════════════════════════════════════════════════════════
// COMPANIES (original, preserved)
// ══════════════════════════════════════════════════════════════

async function loadCompanies() {
  const grid=document.getElementById('companiesGrid');
  grid.innerHTML='<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    S.companies=await api('/companies');
    renderCompanies(S.companies);
    document.getElementById('coCnt').textContent=S.companies.length;
  } catch(e){ toast(e.message,'error'); }
}

function renderCompanies(list) {
  const grid=document.getElementById('companiesGrid');
  if(!list.length){ grid.innerHTML=`<div class="empty-state"><div class="empty-icon">🏭</div><div class="empty-title">No companies yet</div><div class="empty-sub">Add your first company</div></div>`; return; }
  grid.innerHTML=list.map(c=>`
    <div class="entity-card" id="co-${c.id}">
      <div class="entity-card-img" onclick="drillToModels(${c.id},'${esc(c.name)}')">
        ${c.logo_path?`<img src="${API}${c.logo_path}" alt="${esc(c.name)}" onerror="this.style.display='none'">`:'🏭'}
      </div>
      <div class="entity-card-body" onclick="drillToModels(${c.id},'${esc(c.name)}')">
        <div class="entity-card-name">${esc(c.name)}</div>
        <div class="entity-card-meta">Click to view models →</div>
      </div>
      <div class="entity-card-actions">
        <button class="btn btn-ghost btn-sm btn-icon" onclick="openEditCompany(${c.id})">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon" onclick="deleteCompany(${c.id},'${esc(c.name)}')">🗑️</button>
      </div>
    </div>`).join('');
}

function filterCompanies(){ const q=document.getElementById('coSearch').value.toLowerCase(); renderCompanies(S.companies.filter(c=>c.name.toLowerCase().includes(q))); }
function drillToModels(cid,name){ S.activeCompany={id:cid,name}; navigateTo('models'); setTimeout(()=>{ const s=document.getElementById('moCompanyFilter'); if(s){s.value=cid;loadModels();} },50); }

function openAddCompany(){
  modal('mCo','Add Company','🏭',`<div class="form-group"><label class="form-label">Company Name *</label><input class="form-control" id="coName" placeholder="e.g. Honda, Yamaha…" autofocus></div><div class="form-group"><label class="form-label">Logo</label><div class="file-upload"><input type="file" id="coLogo" accept="image/*"><div class="upload-icon">🖼️</div><div class="upload-hint">Click to upload</div><img id="coLogoPreview" class="upload-preview"></div></div>`,
    `<button class="btn btn-ghost" onclick="closeModal('mCo')">Cancel</button><button class="btn btn-primary" onclick="submitAddCompany()">Add Company</button>`);
  wireUpload('coLogo','coLogoPreview');
}
async function submitAddCompany(){ const name=document.getElementById('coName').value.trim(); if(!name){toast('Name required','warning');return;} const file=document.getElementById('coLogo').files[0]; const logo=file?await b64(file):null; try{await api('/add_company',{method:'POST',body:JSON.stringify({name,logo})});toast(`"${name}" added!`);closeModal('mCo');loadCompanies();refreshCoSelects();}catch(e){toast(e.message,'error');} }
function openEditCompany(id){ const c=S.companies.find(x=>x.id===id);if(!c)return; modal('mCo','Edit Company','✏️',`<div class="form-group"><label class="form-label">Name *</label><input class="form-control" id="coName" value="${esc(c.name)}"></div><div class="form-group"><label class="form-label">Logo</label><div class="file-upload"><input type="file" id="coLogo" accept="image/*"><div class="upload-icon">🖼️</div><div class="upload-hint">Click to replace</div><img id="coLogoPreview" class="upload-preview ${c.logo_path?'visible':''}" src="${c.logo_path?API+c.logo_path:''}"></div></div>`,`<button class="btn btn-ghost" onclick="closeModal('mCo')">Cancel</button><button class="btn btn-warning" onclick="submitEditCompany(${id})">Save</button>`); wireUpload('coLogo','coLogoPreview'); }
async function submitEditCompany(id){ const name=document.getElementById('coName').value.trim();if(!name){toast('Name required','warning');return;} const file=document.getElementById('coLogo').files[0]; const logo=file?await b64(file):null; try{await api(`/update_company/${id}`,{method:'PUT',body:JSON.stringify({name,logo})});toast('Updated!');closeModal('mCo');loadCompanies();refreshCoSelects();}catch(e){toast(e.message,'error');} }
async function deleteCompany(id,name){ if(!confirm(`Delete "${name}"? All models and parts will be removed.`))return; try{await api(`/delete_company/${id}`,{method:'DELETE'});toast(`"${name}" deleted.`,'warning');loadCompanies();refreshCoSelects();}catch(e){toast(e.message,'error');} }

// ── Models (original preserved) ───────────────────────────────
async function loadAllModels(){
  const grid=document.getElementById('modelsGrid');
  grid.innerHTML='<div class="spinner-wrap"><div class="spinner"></div></div>';
  await populateCoSelect('moCompanyFilter');
  const cid=document.getElementById('moCompanyFilter').value;
  try{
    S.models=await api(cid?`/models/${cid}`:'/models');
    renderModels(S.models); document.getElementById('moCnt').textContent=S.models.length;
    const bc=document.getElementById('modelBreadcrumb');
    bc.innerHTML=cid&&S.activeCompany?`<span class="breadcrumb-item" onclick="navigateTo('companies')">Companies</span><span class="breadcrumb-sep">›</span><span class="breadcrumb-current">${esc(S.activeCompany.name)}</span>`:'';
  }catch(e){toast(e.message,'error');}
}
async function loadModels(){ await loadAllModels(); }
function renderModels(list){
  const grid=document.getElementById('modelsGrid');
  if(!list.length){grid.innerHTML=`<div class="empty-state"><div class="empty-icon">🏍️</div><div class="empty-title">No models found</div></div>`;return;}
  grid.innerHTML=list.map(m=>`<div class="entity-card" id="mo-${m.id}"><div class="entity-card-img" onclick="drillToParts(${m.id},'${esc(m.model_name)}')">${m.image_path?`<img src="${API}${m.image_path}" alt="${esc(m.model_name)}" onerror="this.style.display='none'">`:'🏍️'}</div><div class="entity-card-body" onclick="drillToParts(${m.id},'${esc(m.model_name)}')"><div class="entity-card-name">${esc(m.model_name)}</div><div class="entity-card-meta">${esc(m.company_name||'')} · Click for parts →</div></div><div class="entity-card-actions"><button class="btn btn-ghost btn-sm btn-icon" onclick="openEditModel(${m.id})">✏️</button><button class="btn btn-danger btn-sm btn-icon" onclick="deleteModel(${m.id},'${esc(m.model_name)}')">🗑️</button></div></div>`).join('');
}
function filterModels(){ const q=document.getElementById('moSearch').value.toLowerCase(); renderModels(S.models.filter(m=>m.model_name.toLowerCase().includes(q)||(m.company_name||'').toLowerCase().includes(q))); }
function drillToParts(mid,name){ S.activeModel={id:mid,name}; navigateTo('items'); setTimeout(()=>{ const s=document.getElementById('itemModelFilter');if(s){s.value=mid;loadItems();} },50); }
async function openAddModel(){ modal('mMo','Add Bike Model','🏍️',`<div class="form-group"><label class="form-label">Company *</label><select class="form-control" id="moCoId"><option value="">Loading…</option></select></div><div class="form-group"><label class="form-label">Model Name *</label><input class="form-control" id="moName" placeholder="e.g. CBR 150R…"></div><div class="form-group"><label class="form-label">Bike Image</label><div class="file-upload"><input type="file" id="moImg" accept="image/*"><div class="upload-icon">📷</div><div class="upload-hint">Upload bike photo</div><img id="moImgPrev" class="upload-preview"></div></div>`,`<button class="btn btn-ghost" onclick="closeModal('mMo')">Cancel</button><button class="btn btn-primary" onclick="submitAddModel()">Add Model</button>`); await populateCoSelect('moCoId'); wireUpload('moImg','moImgPrev'); if(S.activeCompany){document.getElementById('moCoId').value=S.activeCompany.id;} }
async function submitAddModel(){ const cid=document.getElementById('moCoId').value; const name=document.getElementById('moName').value.trim(); if(!cid){toast('Select company','warning');return;} if(!name){toast('Name required','warning');return;} const file=document.getElementById('moImg').files[0]; const img=file?await b64(file):null; try{await api('/add_model',{method:'POST',body:JSON.stringify({company_id:+cid,model_name:name,image:img})});toast(`"${name}" added!`);closeModal('mMo');loadAllModels();}catch(e){toast(e.message,'error');} }
function openEditModel(id){ const m=S.models.find(x=>x.id===id);if(!m)return; modal('mMo','Edit Model','✏️',`<div class="form-group"><label class="form-label">Company *</label><select class="form-control" id="moCoId"><option value="">Loading…</option></select></div><div class="form-group"><label class="form-label">Model Name *</label><input class="form-control" id="moName" value="${esc(m.model_name)}"></div><div class="form-group"><label class="form-label">Image</label><div class="file-upload"><input type="file" id="moImg" accept="image/*"><div class="upload-icon">📷</div><div class="upload-hint">Click to replace</div><img id="moImgPrev" class="upload-preview ${m.image_path?'visible':''}" src="${m.image_path?API+m.image_path:''}"></div></div>`,`<button class="btn btn-ghost" onclick="closeModal('mMo')">Cancel</button><button class="btn btn-warning" onclick="submitEditModel(${id},${m.company_id})">Save</button>`); populateCoSelect('moCoId',m.company_id); wireUpload('moImg','moImgPrev'); }
async function submitEditModel(id,origCid){ const cid=document.getElementById('moCoId').value||origCid; const name=document.getElementById('moName').value.trim();if(!name){toast('Name required','warning');return;} const file=document.getElementById('moImg').files[0]; const img=file?await b64(file):null; try{await api(`/update_model/${id}`,{method:'PUT',body:JSON.stringify({company_id:+cid,model_name:name,image:img})});toast('Updated!');closeModal('mMo');loadAllModels();}catch(e){toast(e.message,'error');} }
async function deleteModel(id,name){ if(!confirm(`Delete "${name}"?`))return; try{await api(`/delete_model/${id}`,{method:'DELETE'});toast(`"${name}" deleted.`,'warning');loadAllModels();}catch(e){toast(e.message,'error');} }

// ── Items (original preserved) ────────────────────────────────
async function loadAllItems(){
  const grid=document.getElementById('itemsGrid');
  grid.innerHTML='<div class="spinner-wrap"><div class="spinner"></div></div>';
  await populateCoSelect('itemCompanyFilter');
  const mid=document.getElementById('itemModelFilter').value;
  try{
    S.items=await api(mid?`/items/${mid}`:'/items');
    renderItems(S.items); document.getElementById('itemCnt').textContent=S.items.length;
    const bc=document.getElementById('itemsBreadcrumb');
    bc.innerHTML=mid&&S.activeModel?`<span class="breadcrumb-item" onclick="navigateTo('companies')">Companies</span><span class="breadcrumb-sep">›</span><span class="breadcrumb-item" onclick="navigateTo('models')">Models</span><span class="breadcrumb-sep">›</span><span class="breadcrumb-current">${esc(S.activeModel.name)}</span>`:'';
  }catch(e){toast(e.message,'error');}
}
async function loadItemModels(){ const cid=document.getElementById('itemCompanyFilter').value; const sel=document.getElementById('itemModelFilter'); sel.innerHTML='<option value="">All Models</option>'; if(cid){const ms=await api(`/models/${cid}`); ms.forEach(m=>sel.add(new Option(m.model_name,m.id)));} loadAllItems(); }
async function loadItems(){ loadAllItems(); }
function renderItems(list){
  const grid=document.getElementById('itemsGrid');
  if(!list.length){grid.innerHTML=`<div class="empty-state"><div class="empty-icon">⚙️</div><div class="empty-title">No parts found</div></div>`;return;}
  grid.innerHTML=list.map(item=>{
    const sc=item.quantity===0?'empty':item.quantity<5?'low':'ok';
    const sl=item.quantity===0?'Out of Stock':item.quantity<5?'Low Stock':'In Stock';
    return `<div class="part-card"><div class="part-card-img">${item.image_path?`<img src="${API}${item.image_path}" alt="${esc(item.name)}" onerror="this.parentElement.innerHTML='<span style=font-size:52px;opacity:.3>⚙️</span>'">`:'<span style="font-size:52px;opacity:.3">⚙️</span>'}<span class="stock-pill ${sc}">${sl}</span></div><div class="part-card-body"><div class="part-name">${esc(item.name)}</div><div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">${esc(item.company_name||'')} › ${esc(item.model_name||'')}</div><div class="price-row"><div class="price-tag"><span class="price-label">MRP</span><span class="price-value mrp">₹${parseFloat(item.mrp).toFixed(2)}</span></div><div style="color:var(--text-light)">|</div><div class="price-tag"><span class="price-label">Sell</span><span class="price-value sell">₹${parseFloat(item.selling_price).toFixed(2)}</span></div></div><div class="stock-info"><span class="stock-qty">Stock:</span><span class="stock-num ${item.quantity===0?'bad':item.quantity<5?'warn':'good'}">${item.quantity}</span></div></div><div class="part-actions"><button class="btn btn-success btn-sm" style="flex:1" onclick="openStockModal('add',${item.id},'${esc(item.name)}',${item.quantity})">+ Add</button><button class="btn btn-danger btn-sm" style="flex:1" ${item.quantity===0?'disabled':''} onclick="openStockModal('sell',${item.id},'${esc(item.name)}',${item.quantity})">− Sell</button><button class="btn btn-ghost btn-sm btn-icon" onclick="openEditItem(${item.id})">✏️</button><button class="btn btn-ghost btn-sm btn-icon" onclick="deleteItem(${item.id},'${esc(item.name)}')">🗑️</button></div></div>`;
  }).join('');
}
function filterItems(){ const q=document.getElementById('itemSearch').value.toLowerCase(); renderItems(S.items.filter(i=>i.name.toLowerCase().includes(q)||(i.model_name||'').toLowerCase().includes(q)||(i.company_name||'').toLowerCase().includes(q))); }
async function openAddItem(){ modal('mIt','Add Spare Part','⚙️',`<div class="form-group"><label class="form-label">Company *</label><select class="form-control" id="itCoId" onchange="loadAddItemModels()"><option value="">Select company…</option></select></div><div class="form-group"><label class="form-label">Model *</label><select class="form-control" id="itMoId"><option value="">Select model…</option></select></div><div class="form-group"><label class="form-label">Part Name *</label><input class="form-control" id="itName" placeholder="e.g. Brake Pad…"></div><div class="form-row"><div class="form-group"><label class="form-label">MRP (₹) *</label><input class="form-control" id="itMRP" type="number" min="0" step="0.01" placeholder="0.00"></div><div class="form-group"><label class="form-label">Selling Price (₹) *</label><input class="form-control" id="itSP" type="number" min="0" step="0.01" placeholder="0.00"></div></div><div class="form-group"><label class="form-label">Initial Qty</label><input class="form-control" id="itQty" type="number" min="0" value="0"></div><div class="form-group"><label class="form-label">Image</label><div class="file-upload"><input type="file" id="itImg" accept="image/*"><div class="upload-icon">📷</div><div class="upload-hint">Upload part image</div><img id="itImgPrev" class="upload-preview"></div></div>`,`<button class="btn btn-ghost" onclick="closeModal('mIt')">Cancel</button><button class="btn btn-primary" onclick="submitAddItem()">Add Part</button>`); await populateCoSelect('itCoId'); wireUpload('itImg','itImgPrev'); }
async function loadAddItemModels(){ const cid=document.getElementById('itCoId').value; const sel=document.getElementById('itMoId'); sel.innerHTML='<option value="">Loading…</option>'; if(!cid){sel.innerHTML='<option value="">Select model…</option>';return;} const ms=await api(`/models/${cid}`); sel.innerHTML='<option value="">Select model…</option>'; ms.forEach(m=>sel.add(new Option(m.model_name,m.id))); }
async function submitAddItem(){ const mid=document.getElementById('itMoId').value; const name=document.getElementById('itName').value.trim(); const mrp=parseFloat(document.getElementById('itMRP').value); const sp=parseFloat(document.getElementById('itSP').value); const qty=parseInt(document.getElementById('itQty').value)||0; if(!mid){toast('Select model','warning');return;} if(!name){toast('Name required','warning');return;} if(isNaN(mrp)||mrp<0||isNaN(sp)||sp<0){toast('Invalid prices','warning');return;} const file=document.getElementById('itImg').files[0]; const img=file?await b64(file):null; try{await api('/add_item',{method:'POST',body:JSON.stringify({model_id:+mid,name,mrp,selling_price:sp,quantity:qty,image:img})});toast(`"${name}" added!`);closeModal('mIt');loadAllItems();}catch(e){toast(e.message,'error');} }
function openEditItem(id){ const item=S.items.find(x=>x.id===id);if(!item)return; modal('mIt','Edit Part','✏️',`<div class="form-group"><label class="form-label">Name *</label><input class="form-control" id="itName" value="${esc(item.name)}"></div><div class="form-row"><div class="form-group"><label class="form-label">MRP (₹)</label><input class="form-control" id="itMRP" type="number" min="0" step="0.01" value="${item.mrp}"></div><div class="form-group"><label class="form-label">Selling Price (₹)</label><input class="form-control" id="itSP" type="number" min="0" step="0.01" value="${item.selling_price}"></div></div><div class="form-group"><label class="form-label">Quantity</label><input class="form-control" id="itQty" type="number" min="0" value="${item.quantity}"></div><div class="form-group"><label class="form-label">Image</label><div class="file-upload"><input type="file" id="itImg" accept="image/*"><div class="upload-icon">📷</div><div class="upload-hint">Click to replace</div><img id="itImgPrev" class="upload-preview ${item.image_path?'visible':''}" src="${item.image_path?API+item.image_path:''}"></div></div>`,`<button class="btn btn-ghost" onclick="closeModal('mIt')">Cancel</button><button class="btn btn-warning" onclick="submitEditItem(${id},${item.model_id})">Save</button>`); wireUpload('itImg','itImgPrev'); }
async function submitEditItem(id,mid){ const name=document.getElementById('itName').value.trim(); const mrp=parseFloat(document.getElementById('itMRP').value); const sp=parseFloat(document.getElementById('itSP').value); const qty=parseInt(document.getElementById('itQty').value); if(!name||isNaN(mrp)||isNaN(sp)||isNaN(qty)){toast('Fill all fields','warning');return;} const file=document.getElementById('itImg').files[0]; const img=file?await b64(file):null; try{await api(`/update_item/${id}`,{method:'PUT',body:JSON.stringify({model_id:mid,name,mrp,selling_price:sp,quantity:qty,image:img})});toast('Updated!');closeModal('mIt');loadAllItems();}catch(e){toast(e.message,'error');} }
async function deleteItem(id,name){ if(!confirm(`Delete "${name}"?`))return; try{await api(`/delete_item/${id}`,{method:'DELETE'});toast(`"${name}" deleted.`,'warning');loadAllItems();}catch(e){toast(e.message,'error');} }
function openStockModal(type,id,name,cur){ const isSell=type==='sell'; modal('mStock',isSell?'Sell Item':'Add Stock',isSell?'📤':'📥',`<div style="text-align:center;margin-bottom:18px"><div style="font-size:12px;color:var(--text-muted)">${isSell?'Selling':'Adding stock for'}</div><div style="font-weight:700;font-size:15px;margin:4px 0">${esc(name)}</div></div><div class="form-group"><label class="form-label">Quantity *</label><input class="form-control" id="stockQty" type="number" min="1" value="1" style="font-size:22px;font-family:Poppins,sans-serif;font-weight:700;text-align:center;color:${isSell?'var(--danger)':'var(--success)'}" autofocus></div>${isSell&&cur?`<div style="text-align:center;font-size:12px;color:var(--text-muted)">Available: <strong style="color:var(--danger)">${cur}</strong></div>`:''}`,`<button class="btn btn-ghost" onclick="closeModal('mStock')">Cancel</button><button class="btn ${isSell?'btn-danger':'btn-success'}" onclick="submitStock('${type}',${id})">${isSell?'Confirm Sale':'Add Stock'}</button>`); const inp=document.getElementById('stockQty'); inp?.select(); inp?.addEventListener('keydown',e=>{if(e.key==='Enter')submitStock(type,id);}); }
async function submitStock(type,id){ const qty=parseInt(document.getElementById('stockQty').value); if(!qty||qty<=0){toast('Enter valid quantity','warning');return;} const ep=type==='sell'?'/sell_item':'/add_stock'; try{const res=await api(ep,{method:'POST',body:JSON.stringify({item_id:id,quantity:qty})});toast(type==='sell'?`Sold ${qty} units! Revenue: ${fmtINR(res.revenue||0)}`:`Added ${qty} units. Stock: ${res.new_quantity}`);closeModal('mStock');loadAllItems();if(S.page==='dashboard')loadDashboard();}catch(e){toast(e.message,'error');} }

// ── History (original) ────────────────────────────────────────
async function loadHistory(){ const dt=document.getElementById('histDate').value; const url=dt?`/transactions?date=${dt}`:'/transactions?limit=200'; try{ const rows=await api(url); renderHistory(rows); document.getElementById('histCount').textContent=`${rows.length} records`; }catch(e){toast(e.message,'error');} }
function clearHistDate(){ document.getElementById('histDate').value=''; loadHistory(); }
function renderHistory(rows){ const tbody=document.getElementById('histTbody'); if(!rows.length){tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:36px;color:var(--text-muted)">No transactions found</td></tr>`;return;} tbody.innerHTML=rows.map((t,i)=>{ const isSale=t.type==='sale'; const dt=new Date(t.date_time); const ds=dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); const ts=dt.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}); const rev=isSale?fmtINR(t.selling_price*t.quantity):'—'; return `<tr><td style="color:var(--text-muted);font-size:11px">${t.id}</td><td><strong>${esc(t.item_name)}</strong></td><td class="hide-mobile" style="color:var(--text-muted)">${esc(t.company_name||'—')}</td><td class="hide-mobile" style="color:var(--text-muted)">${esc(t.model_name||'—')}</td><td>${isSale?'<span class="badge badge-danger">📤 Sale</span>':'<span class="badge badge-success">📥 Stock</span>'}</td><td style="font-family:Poppins,sans-serif;font-weight:700;color:${isSale?'var(--danger)':'var(--success)'}">${isSale?'−':'+'}${t.quantity}</td><td style="font-family:Poppins,sans-serif;font-size:13px;color:var(--primary)">${rev}</td><td style="font-size:12px;color:var(--text-muted)"><div>${ds}</div><div style="font-size:10px">${ts}</div></td></tr>`; }).join(''); }

// ── Utility selects ───────────────────────────────────────────
async function populateCoSelect(selId, selectedId=null){ const sel=document.getElementById(selId);if(!sel)return; try{ const cos=await api('/companies'); S.companies=cos; const ph=sel.options[0]?.value===''?sel.options[0].textContent:'Select company…'; sel.innerHTML=`<option value="">${ph}</option>`; cos.forEach(c=>{ const o=new Option(c.name,c.id); if(selectedId&&c.id==selectedId)o.selected=true; sel.add(o); }); }catch(_){} }
async function refreshCoSelects(){ for(const id of ['moCompanyFilter','itemCompanyFilter','billCustFilter']) await populateCoSelect(id); }
