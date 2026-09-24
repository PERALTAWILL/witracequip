/* Render root /
/ ---------------------------------------------------------------------- */

/* Page key: the arrival animation only plays when changing pages, not on every minor refresh (otherwise everything would flicker). */
let lastPage = null;

function render(){
const focus = captureFocus();
// A background refresh should not close the open menu.
const menuOpen = !!document.getElementById('user-dropdown')?.classList.contains('open');
paint();
if(menuOpen) document.getElementById('user-dropdown')?.classList.add('open');
const page = location.hash + '|' + !!state.session;
const main = document.querySelector('#app main');
if(main && page !== lastPage){
main.classList.remove('entry'); void main.offsetWidth; main.classList.add('entry');
if(lastPage !== null) window.scrollTo({ top: 0, behavior: 'instant' });
}
lastPage = page;
restoreFocus(focus);
}

function paint(){
const app = document.getElementById('app');
document.body.dataset.role = state.route.name === 'p' ? '' : roleTheme();
if(state.loading){
app.innerHTML = <div class="center-screen startup"><img src="${LOGO_DATA_URL}" alt=""><div class="spinner"></div></div>;
return;
}
// Public consultation: the address carried by the QR code stuck on the
// equipment. No account, no registration — a controller, inspector, or insurer
// scans and reads the logbook. Read-only: nothing editable, and the database remains closed (only one function is
// open to the visitor, it only returns THIS equipment).
if(state.route.name === 'p' && state.route.param){
app.innerHTML = renderPublicRoute(state.route.param);
return;
}
if(state.accessError){
app.innerHTML = renderAccessSuspended();
return;
}
if(state.session && computerState.mode === 'waiting'){ app.innerHTML = renderComputerWaiting(); drawComputerQr(); return; }
if(state.session && computerState.mode === 'paused'){ app.innerHTML = renderMobilePaused(); return; }
if(!state.session){
// Invitation link: accessible without being logged in.
if(state.route.name === 'join' && state.route.param){
app.innerHTML = renderJoin(state.route.param);
return;
}
// Labels printed before the public link was set up: they
// carry the internal address of the record. A visitor who scans them
// gets the same read-only consultation, not a login screen. The administrator can cut these old links equipment
// by equipment with "Change link".
if(state.route.name === 'equip' && state.route.param){
app.innerHTML = viewPublicRecord(state.route.param);
return;
}
app.innerHTML = renderAuth();
return;
}
app.innerHTML = renderShell();
}

/* ---------------------------------------------------------------------- /
/ Serial number already registered: we warn, we don't block /
/ ---------------------------------------------------------------------- */

/* Two trucks can legitimately have the same partial chassis number,
and a press operator should never be stuck by a machine.
We therefore signal the duplicate without preventing registration.
Intentionally without render(): refreshing the view would erase the current input. We write directly into the alert area. */
let serialTimer = null;
let serialRequest = 0;

function alertZoneSerial(){ return document.getElementById('alert-serial'); }

function showSerialAlert(html){
const zone = alertZoneSerial();
if(!zone) return;
zone.innerHTML = html || '';
zone.classList.toggle('empty', !html);
}

function verifySerial(value, excludeId){
const v = (value || '').trim();
clearTimeout(serialTimer);

if(v.length < 3){ showSerialAlert(''); return; }

const request = ++serialRequest;
serialTimer = setTimeout(async () => {
try{
let q = sb.from('equipments')
.select('id, name, archived, type_id')
.eq('serial_value', v)
.limit(4);
if(excludeId) q = q.neq('id', excludeId);
const { data, error } = await q;
if(error) throw error;
if(request !== serialRequest) return; // input continued in the meantime

const found = data || [];
if(!found.length){ showSerialAlert(''); return; }

const lines = found.map(e => {
const t = state.types.find(x => x.id === e.type_id);
return <div>• <a href="#/equip/${e.id}">${esc(e.name)}</a>

${t ? ' — ' + esc(t.name) : ''}
${e.archived ? ' <em>(retired from service)</em>' : ''}</div>;
}).join('');
showSerialAlert(
<strong>This number is already registered</strong>${found.length > 1 ?  (${found.length} records) : ''} :

lines
<div style="margin-top:4px;">You can still register: this is just a warning.</div>
);
}catch(e){
// A verification that fails should never prevent input.
if(request === serialRequest) showSerialAlert('');
}
}, 400);
}
/* ---------------------------------------------------------------------- /
/ Public consultation - read-only, no account /
/ ---------------------------------------------------------------------- */

let publicRecord = { token:null, data:null, loading:false, error:'' };

/* The technician scanning a label often wants to follow up with entering
their intervention. We retain the label they were looking at to
bring them back directly to that record once logged in. */
function connectionFromScan(){
try{ sessionStorage.setItem('wt_return_scan', publicRecord.token || state.route.param || ''); }catch(e){}
state.authError = ''; state.authNotice = '';
nav('/login');
}

/* ---------------------------------------------------------------------- /
/ Offline: last known state, kept on the device /
/ ---------------------------------------------------------------------- /
/ Profile, types, and equipment list from the last connection, stored
in the browser's storage under the account name (deleted on logout).
Without a network, the application starts and displays this last state, clearly
indicated as such, instead of an error. /
function isNetworkError(e){
if(!navigator.onLine) return true;
return /failed to fetch|networkerror|load failed|network request failed|fetch failed|too long/i.test((e && e.message) || String(e || ''));
}
function instantKey(){ return 'wte_hl_' + (state.session?.user?.id || ''); }
function readInstant(){
try{ return JSON.parse(localStorage.getItem(instantKey()) || 'null') || {}; }catch(e){ return {}; }
}
function saveInstant(addition){
// Computer open for 45 min: no data copy remains there.
if(deviceType() === 'computer' && !state.superAdmin) return;
try{ localStorage.setItem(instantKey(), JSON.stringify({ ...readInstant(), ...addition })); }catch(e){}
}
function clearInstants(){
try{ Object.keys(localStorage).filter(k => k.startsWith('wte_hl_')).forEach(k => localStorage.removeItem(k)); }catch(e){}
}
/ Known equipment without network: those pending sending + the last list. */
async function knownEquipment(){
const pending = await offlineEquipmentAsLines();
const list = (dashboardCache.items && dashboardCache.items.length) ? dashboardCache.items : (readInstant().equipment || []);
return [...pending, ...list.filter(e => !pending.some(x => x.id === e.id))];
}

function returnAfterLogin(){
let t = '';
try{ t = sessionStorage.getItem('wt_return_scan') || ''; sessionStorage.removeItem('wt_return_scan'); }catch(e){}
if(t){ nav('/p/' + t); state.route = parseHash(); }
}
let resolvePublic = { token:null, busy:false };

/* A person already logged in who scans a label from their park does not need
the public view: they are taken to the full record, where they can enter the intervention. If the token does not correspond to anything they are allowed to see, they fall back to the public view like everyone else. */
function renderPublicRoute(token){
if(!state.session){ return viewPublicRecord(token); }

if(resolvePublic.token !== token){
resolvePublic = { token, busy:true };
sb.from('equipments').select('id').eq('public_token', token).maybeSingle()
.then(async ({ data, error }) => {
if(data && data.id){ nav('/equip/' + data.id); return; }
if(error || !navigator.onLine){
const known = (await knownEquipment()).find(e => e.public_token === token);
if(known){ nav('/equip/' + known.id); return; }
}
resolvePublic.busy = false; render();
})
.catch(() => { resolvePublic.busy = false; render(); });
}
if(resolvePublic.busy) return <div class="center-screen"><div class="spinner"></div></div>;
return viewPublicRecord(token);
}

function viewPublicRecord(token){
if(publicRecord.token !== token){
publicRecord = { token, data:null, loading:true, error:'' };
sb.rpc('public_record', { p_token: token })
.then(({ data, error }) => {
if(error) throw error;
publicRecord.data = data || null;
publicRecord.loading = false; render();
})
.catch(e => {
publicRecord.error = (e && e.message) ? e.message : String(e);
publicRecord.loading = false; render();
});
}

if(publicRecord.loading) return <div class="center-screen"><div class="spinner"></div></div>;

if(publicRecord.error || !publicRecord.data){
return `

${publicHeader('')}
Record unavailable
This label does not correspond to any viewable record. It may have been replaced, or public viewing has been closed by the equipment owner.
${publicFooter()}
`; }
const d = publicRecord.data;
const fields = Array.isArray(d.fields) ? d.fields : [];
const values = d.values || {};
const ivs = Array.isArray(d.interventions) ? d.interventions : [];

const infoRows = fields.map(c => {
const raw = values[c.key];
const val = !raw ? '—' : (c.type === 'date' ? fmtDate(raw) : raw);
return <tr><td class="muted">${esc(c.label)}</td><td>${esc(val)}</td></tr>;
}).join('');

const ivRows = ivs.map(iv => `

${fmtDate(iv.date)} ${esc(iv.type)} ${esc(iv.technician)} ${esc(iv.description || '—')} `).join('');
const last = ivs.length ? fmtDate(ivs[0].date) : null;

return `

${publicHeader(d.organization || '')}
${esc(d.name || '')}
${esc(d.type || '')}${d.serial_value ? ' · ' + esc(d.serial_value) : ''}
🔒 Read-only consultation ${d.archived ? `⚠️ Retired from service` : ''}
Information
${last ? `` : ''} ${infoRows}
Monitoring started	${fmtDate(d.created_at)}
Last intervention	${last}
Intervention history
${ivs.length ? `
${ivRows}
Date	Type	Technician	Description
` : `
No interventions recorded to date.
`}
${publicFooter()}

`; }
function publicHeader(org){
return `


WiTracEQUIP
Technical equipment passport
${org ? `
${esc(org)}
` : ''} Log in
`; }
function publicFooter(){
return `

Maintenance log kept with WiTracEQUIP — by WiDIAG MQ.
This page is a free consultation: it does not allow any modification.
Technician on the team? "Log in" at the top of the page opens the full record.
${supportFooter()}`; }
function renderAccessSuspended(){
const suspended = state.accessError === 'ACCESS_SUSPENDED';
return `

${suspended ? 'Access suspended' : 'Connection impossible'}
${suspended ? "Your access to WiTracEQUIP is currently suspended." : esc(state.accessError)}
${suspended ? "Contact your organization's administrator to reinstate it." : "Try again in a moment, or log in again."}
Log out
${supportFooter()}
`; }
/* ---------------------------------------------------------------------- /
/ Roles: color theme and menus /
/ ---------------------------------------------------------------------- /
/ Each role has its color: user blue, manager green, administrator
purple, founder night & gold. You know at a glance which profile you are on. */
function roleTheme(){
if(!state.session || !state.profile) return '';
if(isSuperAdmin() || state.profile.founder) return 'founder';
return state.profile.role || '';
}
function roleLabelTheme(){
if(isSuperAdmin()) return 'Founder · WiDIAG MQ';
if(state.profile?.founder) return 'Founder';
return roleLabel(state.profile?.role);
}

/* Super-admin: works client by client: Home · Clients · Support · Log. */
function navEntries(r){
if(isSuperAdmin()){
const toProcess = (settings.support || []).filter(d => d.status !== 'processed').length;
const subPage = r.name === 'settings' ? (r.param || 'clients') : '';
return [
{ path:'/', icon:'home', label:'Home', active: r.name === 'home' },
{ path:'/settings/clients', icon:'briefcase', label:'Clients',
active: subPage === 'clients' || ['equip','equip-new','types','equipments','dashboard'].includes(r.name) },
{ path:'/settings/profiles', icon:'users', label:'Profiles', active: subPage === 'profiles' },
{ path:'/settings/support', icon:'inbox', label:'Support', active: subPage === 'support' || r.name === 'support', badge: toProcess || '' },
{ path:'/settings/log', icon:'log', label:'Log', active: subPage === 'log' },
];
}
const equipmentActive = ['dashboard','equipments','equip','equip-new'].includes(r.name);
return [
{ path:'/', icon:'home', label:'Home', active: r.name === 'home' },
{ path:'/equipments', icon:'box', label:'Equipment', short:'Equip.', active: equipmentActive },
...(canManageTypes() ? [{ path:'/types', icon:'tag', label:"Equipment types", short:'Types', active: r.name === 'types' }] : []),
{ path:'/log', icon:'log', label:'Log', active: r.name === 'log', badge: unreadActivityCount() || '' },
...(canManageSettings() ? [{ path:'/settings', icon:'gear', label:'Settings', active: r.name === 'settings' || r.name === 'team' }] : []),
{ path:'/support', icon:'help', label:'Support', active: r.name === 'support' },
];
}

/* Super-admin: a piece of equipment's park is its client's record. */
function parkRoute(orgId){ return isSuperAdmin() && orgId ? '/settings/clients/' + orgId : '/equipments'; }
function clientNameOf(orgId){ return ((settings.clients || []).find(c => c.id === orgId) || {}).name || ''; }
function typesFor(orgId){ return isSuperAdmin() ? state.types.filter(t => t.organization_id === orgId) : state.types; }
function targetOrgTypes(){ return isSuperAdmin() ? state.route.param : state.profile.organization_id; }

/* ---------------------------------------------------------------------- /
/ Passwords /
/ ---------------------------------------------------------------------- */
const MIN_PWD = 8;

function translatePasswordError(m){
const s = String(m || '').toLowerCase();
if(s.includes('different from the old')) return "The new password must be different from the old one.";
if(s.includes('at least') || s.includes('weak') || s.includes('pwned')) return Password too weak: at least ${MIN_PWD} characters, mixing letters and numbers.;
if(s.includes('reauthentication')) return "For security reasons, log out and log back in before changing the password.";
if(s.includes('failed to fetch') || s.includes('network')) return "No network: try again once connected.";
return m;
}

function controlNewPassword(newPassword, confirmation){
if((newPassword || '').length < MIN_PWD) return Password must be at least ${MIN_PWD} characters long.;
if(!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) return 'Mix at least letters and numbers.';
if(newPassword !== confirmation) return 'The two entries for the new password are not identical.';
return null;
}

async function changeMyPassword(){
const email = state.session?.user?.email;
const ok = await openForm({
title: 'Change my password',
text: At least ${MIN_PWD} characters, with letters and numbers.,
fields: [
{ name:'current', label:'Current password', autocomplete:'current-password' },
{ name:'new', label:'New password', autocomplete:'new-password' },
{ name:'confirmation', label:'Confirm new', autocomplete:'new-password' },
],
ok: 'Save',
verify: async (v) => {
if(!v.current) return 'Enter your current password.';
const pb = controlNewPassword(v.new, v.confirmation);
if(pb) return pb;
if(v.new === v.current) return "The new password must be different from the old one.";
// We verify the current one: someone finding the unlocked phone
// should not be able to change the password.
const verify = await sb.auth.signInWithPassword({ email, password: v.current });
if(verify.error) return /invalid/i.test(verify.error.message) ? 'Incorrect current password.' : translatePasswordError(verify.error.message);
// New session on the same device: we attach it to the device.
if(await linkDevice() === 'refused'){ setTimeout(refuseDevice, 0); return null; }
const { error } = await sb.auth.updateUser({ password: v.new });
if(error) return translatePasswordError(error.message);
try{ await passwordChangeDone(); }catch(e){}
return null;
},
});
if(ok) toast('Password changed');
}

/* After a reset by the founder: the person chooses theirs. */
async function imposeNewPassword(){
if(!state.profile?.password_to_change) return;
const ok = await openForm({
title: 'Choose your password',
text: You logged in with a temporary password. Choose yours to continue (at least ${MIN_PWD} characters, letters and numbers).,
fields: [
{ name:'new', label:'New password', autocomplete:'new-password' },
{ name:'confirmation', label:'Confirm', autocomplete:'new-password' },
],
ok: 'Save', cancel: 'Log out',
verify: async (v) => {
const pb = controlNewPassword(v.new, v.confirmation);
if(pb) return pb;
const { error } = await sb.auth.updateUser({ password: v.new });
if(error) return translatePasswordError(error.message);
try{ await passwordChangeDone(); }catch(e){}
return null;
},
});
if(ok) toast('Password saved');
else { voluntaryLogout = true; clearInstants(); sb.auth.signOut({ scope:'local' }); }
}

/* Founder: temporary password for a profile. */
async function resetMemberPassword(id){
const m = (settings.members || []).find(x => x.id === id);
if(!m || !isSuperAdmin()) return;
const email = settings.emails?.[id]?.email || '';
const v = await openForm({
title: Reset password for ${m.full_name || 'this profile'},
text: ${email ? email + ' — ' : ''}A temporary password is proposed; you can change it. The person will be logged out of their devices and will have to choose their own password on their next login.,
fields: [{ name:'password', label:'Temporary password', type:'text', value: generatePassword() }],
ok: 'Reset',
verify: async (x) => {
const pwd = (x.password || '').trim();
if(pwd.length < MIN_PWD) return At least ${MIN_PWD} characters.;
await resetPassword(id, pwd);
return null;
},
});
if(!v) return;
const pwd = v.password.trim();
let copied = false;
try{ await navigator.clipboard.writeText(pwd); copied = true; }catch(e){}
settings.log = null;
await confirm(Password reset\n\nSend to ${m.full_name || 'the person'}:\n${email ? 'Username: ' + email + '\n' : ''}Temporary password: ${pwd}\n\n${copied ? 'The password is copied: you can paste it into an SMS or email. They will be asked to choose a new one on login.' : ''} They will be asked to choose a new one on login., { ok:'Understood', danger:false, info:true });
}

async function renameMe(){
closeMenus();
const name = await ask("Change my name\n\nFirst and last name, as they will appear in the application and on your next interventions.",
{ ok:'Save', placeholder:'First Name Last Name', value: state.profile?.full_name || '' });
if(name === null) return;
const clean = name.trim().replace(/\s+/g, ' ');
if(clean.length < 2){ toast('Indicate at least the first and last name.', 'error'); return; }
try{
await renameMember(state.profile.id, clean);
state.profile.full_name = clean;
const m = (settings.members || []).find(x => x.id === state.profile.id);
if(m) m.full_name = clean;
toast('Name updated');
render();
}catch(e){ toast('Error: ' + e.message, 'error'); }
}

function renderShell(){
const r = state.route;
let content = '';
const sa = isSuperAdmin();
try{
if(r.name === 'home') content = sa ? viewHomeFounder() : viewHome();
// Super-admin has no personal park: their key figures and clients, at a glance.
else if(r.name === 'dashboard' || r.name === 'equipments') content = sa ? viewSettings('clients') : viewDashboard();
else if(r.name === 'types') content = !canManageTypes() ? viewDashboard() : (sa && !r.param ? viewSettings('clients') : viewTypes());
else if(r.name === 'equip-new') content = viewEquipNew();
else if(r.name === 'equip') content = viewEquipDetail(r.param);
else if(r.name === 'settings') content = viewSettings(r.param);
else if(r.name === 'team') content = viewSettings('members'); // old address
else if(r.name === 'support') content = sa ? viewSettings('support', r.param)
: !canViewStats() ? viewSupport()
: supportSubMenu(r.param === 'stats' ? 'stats' : 'requests') + (r.param === 'stats' ? viewStats() : viewSupport());
else if(r.name === 'log') content = sa ? viewSettings('log') : viewActivity();
else content = sa ? viewSettings('clients') : viewDashboard();
}catch(e){
content = <div class="alert alert-error">Display error: ${esc(e.message||e)}</div>;
}

return `

WiTracEQUIP
WiTracEQUIP
by WiDIAG MQ
${navEntries(r).map(n => `
${navIcon(n.icon)}${n.label}${n.badge ? `${n.badge}` : ''}
`).join('')}
${sa ? `
${navIcon('crown', 16)}
Founder space${esc(state.orgName || 'WiDIAG MQ')}
` : ''} ${state.pendingCount > 0 ? `
${navIcon('clock',15)}${state.pendingCount} pending
` : ''}
WiTracEQUIP
WiTracEQUIP
by WiDIAG MQ
${state.pendingCount > 0 ? `⏳ ${state.pendingCount}` : ''}
${esc(state.orgName || '…')}
${esc(initials(state.profile?.full_name || state.session.user.email))} ${esc((state.profile?.full_name || '').trim() || state.session.user.email)}
${esc(state.profile?.full_name || 'No name')}
${esc(state.session.user.email)}
${esc(roleLabelTheme())}
${navIcon('pencil', 15)} Change my name ${navIcon('key', 15)} Change my password ${!sa && computerState.mode === 'mobile' ? `${navIcon('monitor', 15)} Open on a computer` : ''} ${!sa ? `${navIcon('help', 15)} Support & requests` : ''} Log out
${renderComputerBanner()}${content}${supportFooter()}
${renderModal()}
${navEntries(r).map(n => `
${navIcon(n.icon,20)}${n.short || n.label}${n.badge ? `${n.badge}` : ''}
`).join('')}
`; }
/* ---------------------------------------------------------------------- /
/ Auth view /
/ ---------------------------------------------------------------------- */

function renderAuth(){
// Free registration does not exist: an account can only be created by
// opening an invitation link (#/join/...). This screen is only for logging in.
return `

WiTracEQUIP
WiTracEQUIP
Your equipment's technical passport — by WiDIAG MQ
${state.authError ? <div class="alert alert-error">${esc(state.authError)}</div> : ''}
${state.authNotice ? <div class="alert alert-success">${esc(state.authNotice)}</div> : ''}

Email 
you@example.com
Password ${passwordField('current-password')}
${state.authBusy ? '…' : 'Log in'}
Access to WiTracEQUIP is by invitation only.
Did you receive an invitation link? Open it to create your account.
${supportFooter()}
`; }
async function handleAuthSubmit(form){
state.authError = ''; state.authNotice = ''; state.authBusy = true; render();
const fd = new FormData(form);
const email = fd.get('email').trim();
const password = fd.get('password');
try{
const { error } = await sb.auth.signInWithPassword({ email, password });
if(error) throw error;
// onAuthStateChange handles the rest (including device verification)
}catch(e){
state.authError = translateAuthError(e.message || String(e));
}finally{
state.authBusy = false; render();
}
}

function translateAuthError(msg){
const m = msg.toLowerCase();
if(m.includes('invalid login credentials')) return "Incorrect email or password.";
if(m.includes('user already registered') || m.includes('already registered')) return "An account already exists with this email.";
if(m.includes('email not confirmed')) return "Please confirm your email before logging in (link sent by email).";
if(m.includes('password should be at least')) return "Password must be at least 6 characters long.";
if(m.includes('inscription_sur_invitation'))
return "Account creation is only possible via an invitation link.";
if(m.includes('organisation_suspendue'))
return "The organization inviting you is currently suspended. Contact WiDIAG MQ.";
if(m.includes('invite_invalide') || m.includes('database error saving new user'))
return "This invitation link is no longer valid. Request a new one from your administrator.";
return msg;
}

/* ---------------------------------------------------------------------- /
/ View: Home /
/ ---------------------------------------------------------------------- */

let homeCache = { figures: null, loading: false, error: '' };

async function loadFigures(){
const [eq, iv] = await Promise.all([
sb.from('equipments').select('id, archived'),
sb.from('interventions').select('date').order('date', { ascending: false }),
]);
if(eq.error) throw eq.error;
if(iv.error) throw iv.error;
const equipment = eq.data || [];
const interventions = iv.data || [];
return {
active: equipment.filter(e => !e.archived).length,
interventions: interventions.length,
last: interventions.length ? interventions[0].date : null,
};
}

/* ---------------------------------------------------------------------- /
/ Founder's Home (super-admin): activity dashboard /
/ ---------------------------------------------------------------------- /
/ No personal park: their key figures and clients, at a glance. */
let founderCache = { data:null, loading:false, error:'' };

async function loadFounderDashboard(){
const startOfMonth = new Date(); startOfMonth.setDate(1);
const iso = ${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-01;
const iv = await sb.from('interventions').select('id').gte('date', iso);
if(iv.error) throw iv.error;
return { interventionsThisMonth: (iv.data || []).length };
}

function viewHomeFounder(){
loadClients(false);
loadSupport(false);
if(founderCache.data === null && !founderCache.loading && !founderCache.error && state.typesLoaded){
founderCache.loading = true;
loadFounderDashboard()
.then(d => { founderCache.data = d; founderCache.error = ''; })
.catch(e => { founderCache.error = e.message; })
.finally(() => { founderCache.loading = false; render(); });
}
const firstName = (state.profile?.full_name || '').trim().split(/\s+/)[0] || '';
const clients = (settings.clients || []).filter(c => !c.is_my_organization);
loadMembers(false);
const activeProfiles = (settings.members || []).filter(m => m.active && m.id !== state.profile?.id).length;
const toProcess = (settings.support || []).filter(d => d.status !== 'processed').length;
const d = founderCache.data;
const hour = new Date().getHours();
const greeting = hour < 5 || hour >= 18 ? 'Good evening' : 'Good morning';
const todayDate = new Date().toLocaleDateString('en-FR', { weekday:'long', day:'numeric', month:'long' });
const figure = (v) => v === null || v === undefined ? '' : v;

if(scannerState.open) setTimeout(() => attachScanner(), 0);

return `

${esc(todayDate)}
${greeting}${firstName ? ', ' + esc(firstName) : ''}
${navIcon('crown', 14)} Founder · ${esc(state.orgName || 'WiDIAG MQ')}

${figure(settings.clients ? clients.length : null)}
Clients
${figure(settings.members ? activeProfiles : null)}
Active profiles
${figure(d ? d.interventionsThisMonth : null)}
Interventions this month
${figure(settings.support ? toProcess : null)}
Requests to process
Your clients
All clients
${settings.clients === null ? skeletonList(4).replace('card list-select', 'list-select') : clients.length ? [...clients].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 8).map(c => `
${esc(initials(c.name))}
${esc(c.name)}
No. ${esc(c.client_code)} · ${c.nb_equipments} equipment${c.nb_equipments > 1 ? 's' : ''}
›
`).join('') : `
No clients. Create the first one
`}
${navIcon('scan', 26)}
On the field
Scan an equipment label at any of your clients: its record opens directly.

Scan QR code
${scannerState.open ? renderScannerOverlay() : ''} `; }
function viewHome(){
if(homeCache.figures === null && !homeCache.loading && !homeCache.error){
homeCache.loading = true;
loadFigures()
.then(c => { homeCache.figures = c; homeCache.loading = false; render(); })
.catch(e => {
// Without a network, the home page remains usable (figures will return with the network).
if(isNetworkError(e)) homeCache.figures = {}; else homeCache.error = e.message;
homeCache.loading = false; render();
});
}

const firstName = (state.profile?.full_name || '').trim().split(/\s+/)[0] || '';
const c = homeCache.figures;
const parkEmpty = c && c.active === 0;

const steps = [
{ n:'1', title:'Create',
text:"Add an equipment and fill in its record. Its QR code is automatically generated.",
link:'/equip-new', button:'Add equipment' },
{ n:'2', title:'Fill in',
text:"At each visit, scan the QR code and record the intervention: date, nature, technician.",
link:'/equipments', button:'View park' },
{ n:'3', title:'Print',
text:"Print the label and stick it on the equipment. The logbook is accessible in two seconds.",
link:'/equipments', button:'View park' },
];

// The

return `


Welcome${firstName ? ', ' + esc(firstName) : ''}
${esc(state.orgName || '')}
Thank you for choosing WiTracEQUIP to track your equipment. Each machine, vehicle, or device now carries its complete maintenance log — up-to-date and viewable, with a simple scan.

Your solution in three steps
${steps.map((e, i) => `
${e.n}
${e.title}
${e.text}

${e.button}
`).join('')}
${homeCache.error
? <div class="alert alert-error" style="margin-top:14px;">${esc(homeCache.error)}</div> : ''}

${navIcon('scan', 26)}
Scan an equipment
Open the camera and frame the QR code stuck on the equipment to access its record directly — without going through the phone's camera app.

Scan QR code
${parkEmpty ? `

Your park is still empty. ${canManageTypes() ? `Start by creating an equipment type — or start with a business template to create everything at once.` : `Your administrator must first create equipment types.`}
` : ''}
${scannerState.open ? renderScannerOverlay() : ''}
`;
}

function renderScannerOverlay(){
return `

✕
Frame the equipment's QR code
${scannerState.error ? `
${esc(scannerState.error)}
` : ''}
`; }
/* ---------------------------------------------------------------------- /
/ Integrated QR Scanner (home) — avoids having to open the phone's
camera app next to the app: the camera opens in a full-screen view,
each image is decoded with jsQR, and as soon as a WiTracEQUIP QR is recognized
we navigate directly to the record (same routing logic as a label scanned
with the native camera app — see publicLink() / hash-routing
above). */
let scannerState = { open:false, busy:false, error:'', stream:null, raf:null };

async function openScanner(){
if(scannerState.open || scannerState.busy) return;

if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
scannerState.open = true;
scannerState.error = "Your browser does not allow using the camera here. Scan the label with your phone's camera instead.";
render();
return;
}

scannerState.busy = true; scannerState.error = ''; scannerState.open = true;
render();

try{
const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
scannerState.busy = false;
if(!scannerState.open){ stream.getTracks().forEach(t=>t.stop()); return; } // closed during wait
scannerState.stream = stream;
render();
}catch(e){
scannerState.busy = false;
if(!scannerState.open) return;
scannerState.error = /NotAllowedError|Permission denied/i.test(e.name || e.message || '')
? "Camera access denied. Allow the camera for WiTracEQUIP in your browser settings, then try again."
: "Could not access camera: " + (e.message || e.name || 'unknown error');
render();
}
}

function closeScanner(){
if(scannerState.raf) cancelAnimationFrame(scannerState.raf);
scannerState.raf = null;
if(scannerState.stream) scannerState.stream.getTracks().forEach(t=>t.stop());
scannerState.stream = null;
scannerState.open = false;
scannerState.busy = false;
scannerState.error = '';
render();
}

// Attaches the video stream (kept in memory) to the

if(typeof jsQR === 'undefined'){
if(!scannerState.error){
scannerState.error = "QR code reader could not load. Check your connection and try again.";
render();
}
return;
}

const video = document.getElementById('scanner-video');
const canvas = document.getElementById('scanner-canvas');
if(!video || !canvas) return;

if(video.srcObject !== scannerState.stream){
video.srcObject = scannerState.stream;
video.play().catch(()=>{});
}

if(scannerState.raf) return; // decoding loop is already running

const ctx = canvas.getContext('2d', { willReadFrequently:true });

function loop(){
if(!scannerState.open || !scannerState.stream){ scannerState.raf = null; return; }

if(video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth){
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
let result = null;
try{
const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
result = jsQR(image.data, image.width, image.height, { inversionAttempts:'dontInvert' });
}catch(e){ /* image unreadable, try again next loop */ }
if(result && result.data){
scannerState.raf = null;
processScanResult(result.data);
return;
}
}
scannerState.raf = requestAnimationFrame(loop);
}
scannerState.raf = requestAnimationFrame(loop);
}

// A WiTracEQUIP QR always encodes .../#/p/ (or less often
// .../#/equip/) — see publicLink()/equipmentLink(). We only keep
// the route fragment and let the usual routing handle the rest
// (same screen as if the label had been scanned with the native camera).
function processScanResult(text){
const raw = (text || '').trim();
// QR displayed by a computer requesting access (sql/23).
if(/^WTE-COMPUTER:[0-9a-f]{20,}$/i.test(raw)){ closeScanner(); authorizeComputerFromScan(raw.slice(9)); return; }
const idx = raw.indexOf('#');
const path = idx !== -1 ? raw.slice(idx + 1) : (/^/(p|equip)//.test(raw) ? raw : '');

if(!/^/(p|equip)//.test(path)){
scannerState.error = "This QR code does not correspond to a WiTracEQUIP equipment.";
render();
setTimeout(() => { if(scannerState.open){ scannerState.error = ''; render(); } }, 1800);
return;
}

closeScanner();
nav(path);
}

/* ---------------------------------------------------------------------- /
/ View: Dashboard (equipment) /
/ ---------------------------------------------------------------------- */

/* Single initial state model: logout reuses it. (v2.14.2: reset forgot request, leading to request loops after account change — list took a long time to display.) */
function dashboardInitial(request){ return { items: null, search:'', typeId:'', showArchived:false, loading:false, error:'', sel:[], expired:false, request: request || 0 }; }
let dashboardCache = dashboardInitial();

/* Loads the list. During a reload (search, filter), the old list remains displayed — faded — instead of a blank screen: no jump. */
function loadEquipment(){
if(dashboardCache.loading) return;
dashboardCache.loading = true;
const n = ++dashboardCache.request;
// Safety net: a request that never responds should not freeze the list.
const delay = new Promise((_, reject) => setTimeout(() => reject(new Error('Loading is taking too long. Check your connection and try again.')), 20000));
const filter = (list) => {
const q = (dashboardCache.search || '').trim().toLowerCase();
return list.filter(e => (!dashboardCache.typeId || e.type_id === dashboardCache.typeId)
&& (dashboardCache.showArchived || !e.archived)
&& (!q || (e.name || '').toLowerCase().includes(q) || (e.serial_value || '').toLowerCase().includes(q)));
};
const noFilter = !dashboardCache.search && !dashboardCache.typeId && !dashboardCache.showArchived;
Promise.race([listEquipment({ search: dashboardCache.search, typeId: dashboardCache.typeId, showArchived: dashboardCache.showArchived }), delay])
.then(async items => {
if(n !== dashboardCache.request) return;
if(noFilter && !isSuperAdmin()) saveInstant({ equipment: items, equipmentLe: new Date().toISOString() });
const pending = filter(await offlineEquipmentAsLines()).filter(e => !items.some(x => x.id === e.id));
dashboardCache.items = [...pending, ...items]; dashboardCache.error = ''; dashboardCache.offlineLe = null;
dashboardCache.sel = (dashboardCache.sel || []).filter(id => items.some(e => e.id === id));
})
.catch(async e => {
if(n !== dashboardCache.request) return;
const instant = readInstant();
if(isNetworkError(e) && (instant.equipment || navigator.onLine === false)){
// Offline: the last known list + what's pending to be sent.
const pending = filter(await offlineEquipmentAsLines());
dashboardCache.items = [...pending, ...filter(instant.equipment || []).filter(x => !pending.some(y => y.id === x.id))];
dashboardCache.offlineLe = instant.equipmentLe || '';
dashboardCache.error = '';
return;
}
dashboardCache.error = e.message;
})
.finally(() => {
dashboardCache.loading = false;
// A filter changed during loading: relaunch with the correct criteria.
if(dashboardCache.expired){ dashboardCache.expired = false; loadEquipment(); }
render();
});
}

function viewDashboard(){
if(dashboardCache.items === null && !dashboardCache.loading && !dashboardCache.error) loadEquipment();

const typeOptions = state.types.map(t => <option value="${t.id}" ${dashboardCache.typeId===t.id?'selected':''}>${esc(t.name)}</option>).join('');

let list = '';
if(dashboardCache.error){
list = <div class="alert alert-error">${esc(dashboardCache.error)}</div><button class="btn" data-action="dash-reload">Retry</button>;
} else if(dashboardCache.items === null){
list = skeletonList(6);
} else if(dashboardCache.items.length === 0){
list = (dashboardCache.search || dashboardCache.typeId)
? <div class="card empty"><div class="empty-icon">${navIcon('box', 30)}</div><strong>No results</strong><br><span class="small">No equipment matches "${esc(dashboardCache.search)}". Try the serial number or plate.</span></div>
: <div class="card empty"><div class="empty-icon">${navIcon('box', 30)}</div><strong>No equipment for now</strong><br><span class="small">Add your first equipment to generate its QR code.</span></div>;
} else {
const selection = canDelete();
const sel = dashboardCache.sel;
const allChecked = dashboardCache.items.filter(e => !e.pending).every(e => sel.includes(e.id));
list = <div class="card list-select ${dashboardCache.loading ? 'refreshing' : ''}">

(selection ? <label class="select-all"> <input type="checkbox" data-action="sel-equip-all" ${allChecked ? 'checked' : ''}> <span>Select all (${dashboardCache.items.length})</span> </label> : '')
dashboardCache.items.map(eq => {
const t = state.types.find(t=>t.id===eq.type_id);
const checked = sel.includes(eq.id);
const pending = !!eq.pending;
return `
${selection ? (pending ? `` : ``) : ''}
${esc(initials(eq.name))}
${esc(eq.name)} ${eq.archived?'archived':''}${pending ? `⏳ pending sending` : ''}
${esc(t?.name || 'Unknown type')}${eq.serial_value ? ' · S/N ' + esc(eq.serial_value) : ''}
${fmtDate(eq.created_at)}
${isAdmin() && !pending ? `${navIcon('trash', 17)}` : ''}
`; }).join('') + ``; }
const selectedItems = (dashboardCache.items || []).filter(e => dashboardCache.sel.includes(e.id));
const bar = (canDelete() && selectedItems.length) ? `

${selectedItems.length} selected ${selectedItems.some(e => !e.archived) ? `Archive` : ''} ${selectedItems.some(e => e.archived) ? `Restore` : ''} ${isAdmin() ? `Delete permanently` : ''} Cancel
` : '';
return `

Equipment
${state.typesLoaded && state.types.length ? `+ New equipment` : (canManageTypes() ? `Create an equipment type first` : '')}
${esc(dashboardCache.search)}
 
All types
Show archived
${dashboardCache.offlineLe !== null && dashboardCache.offlineLe !== undefined ? <div class="alert alert-info banner-hl">${navIcon('clock',16)} <span>No network: list ${dashboardCache.offlineLe ? 'from ' + fmtDateTime(dashboardCache.offlineLe) : 'of equipment created on this phone'}. You can create equipment and enter interventions: everything will be sent upon network return.</span></div> : ''}
${bar}
${list}
`;
}

async function restoreSelection(){
const ids = (dashboardCache.items || []).filter(e => e.archived && dashboardCache.sel.includes(e.id)).map(e => e.id);
if(!ids.length) return;
if(!await confirm(Restore this equipment? It will reappear in the active list.)) return;
try{
const { error } = await sb.from('equipments')
.update({ archived:false, archived_at:null, archived_by:null, archive_reason:null }).in('id', ids);
if(error) throw error;
afterEquipmentAction();
toast(ids.length > 1 ? ids.length + ' equipment restored' : 'Equipment restored');
}catch(e){ toast('Error: ' + e.message, 'error'); }
}

function refreshDashboard(){
dashboardCache.error = '';
homeCache.figures = null; homeCache.error = ''; // home counters recalculate
founderCache.data = null; founderCache.error = '';
if(dashboardCache.items === null){ render(); return; }
if(dashboardCache.loading) dashboardCache.expired = true; else loadEquipment();
render();
}

/* ---------------------------------------------------------------------- /
/ View: Equipment types /
/ ---------------------------------------------------------------------- */

let typeForm = { open:false, id:null, name:'', fields:[], busy:false, error:'' };
let templateState = { open:false, busy:false };

async function applyTemplate(key){
const template = businessTemplates().find(m => m.key === key);
if(!template) return;

// We don't recreate what already exists: the template completes, it never overwrites.
const existing = new Set(typesFor(targetOrgTypes()).map(t => (t.name||'').trim().toLowerCase()));
const toCreate = template.types.filter(t => !existing.has(t.name.trim().toLowerCase()));

if(!toCreate.length){
toast('All types in this template are already present.', 'info');
return;
}

const summary = toCreate.map(t => ' • ' + t.name).join('\n');
const ignored = template.types.length - toCreate.length;
if(!await confirm(
Add ${toCreate.length} equipment type(s):\n\n${summary}\n\n +
(ignored ? ${ignored} type(s) already present will be ignored.\n\n : '') +
You can then rename, add, or remove fields freely.)) return;

templateState.busy = true; render();
try{
const lines = toCreate.map(t => ({
organization_id: targetOrgTypes(),
name: t.name,
fields: t.fields.map(c => ({ key: slugify(c.label), label: c.label, type: c.type })),
}));
const { error } = await sb.from('equipment_types').insert(lines);
if(error) throw error;
await loadTypes(true);
templateState = { open:false, busy:false };
dashboardCache.items = null; homeCache.figures = null;
render();
}catch(e){
templateState.busy = false; render();
toast('Error: ' + e.message, 'error');
}
}

function openTypeForm(type){
typeForm =
type
? { open:true, id:type.id, name:type.name,
// We keep the original key of each field: it links
// the field to the values already entered in existing equipment.
fields:(type.fields||[]).map(c => ({ key:c.key, label:c.label, type:c.type })),
busy:false, error:'' }
: { open:true, id:null, name:'', fields:[], busy:false, error:'' };
render();
// The form appears at the top of the page: we scroll to it, otherwise we would have
// to scroll manually from the bottom of the list.
scrollToTop();
}

function scrollToTop(){
requestAnimationFrame(() => {
window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
const m = document.querySelector('.shell-main');
if(m && m.scrollTop) m.scrollTo({ top: 0, behavior: 'smooth' });
});
}

function viewTypes(){
const target = targetOrgTypes();
const visibleTypes = typesFor(target);
const rows = visibleTypes.map(t => `

${navIcon('tag', 18)}
${esc(t.name)}
${(t.fields||[]).length} custom field(s)${(t.fields||[]).length ? ' · ' + (t.fields||[]).map(c=>esc(c.label)).join(', ') : ''}
${canManageTypes() ? `Edit` : ''}
`).join('');
return `

${isSuperAdmin() ? `
←
Equipment types
at ${esc(clientNameOf(target))}
` : `
Equipment types
`} ${canManageTypes() ? `${typeForm.open?'Cancel':'+ New type'}` : ''}
${typeForm.open && canManageTypes() ? renderTypeForm() : ''}

${(canManageTypes() && !typeForm.open) ? `

Start from a business template
Creates the typical park of a sector at once, with the fields that matter for traceability. Nothing is overwritten, everything remains editable afterwards.
${templateState.open ? 'Hide' : 'Show templates'}
${templateState.open ? `
${businessTemplates().map(m => `
${esc(m.name)}
${esc(m.description)}
${m.types.map(t => esc(t.name)).join(' · ')}
${templateState.busy ? 'Creating…' : `Add these ${m.types.length} types`}
`).join('')}
` : ''}
` : ''}
${visibleTypes.length ? rows : `
${navIcon('tag', 30)}
No equipment types.
${canManageTypes() ? 'Create one (e.g., "Vehicle", "Medical device", "Industrial equipment"…) to start adding equipment.' : 'No types have been assigned to you. Contact your administrator.'}
`}
`; } function renderTypeForm(){ const fieldsRows = typeForm.fields.map((c, i) => `
${esc(c.label)}
 
${ct.l}
 ✕
`).join('');
const modification = !!typeForm.id;

return `

${modification ? 'Edit type' : 'New type'}
${typeForm.error ? `
${esc(typeForm.error)}
` : ''}
Type name 
${esc(typeForm.name)}
Custom fields (optional)
${fieldsRows}
+ Add field
These fields will appear in the equipment addition form for this type (e.g., make, model, capacity, mileage…).
${modification ? `
Adding a field is risk-free: existing equipment will display it, empty, until it is filled in. Removing a field makes it disappear from records but erases nothing: putting it back with the same name will make the values reappear.
` : ''}
${typeForm.busy?'Saving…':(modification ? 'Save changes' : 'Save type')} Cancel
`; }
async function saveType(){
typeForm.error = '';
const name = typeForm.name.trim();
if(!name){ typeForm.error = 'Type name is required.'; render(); return; }
const fields = typeForm.fields
.filter(c => c.label.trim())
// c.key already exists for a previously created field: we keep it, otherwise
// renaming a label would detach the field from values already entered.
.map(c => ({ key: c.key || slugify(c.label), label: c.label.trim(), type: c.type }));
typeForm.busy = true; render();
try{
if(typeForm.id){
const { error } = await sb.from('equipment_types')
.update({ name, fields }).eq('id', typeForm.id);
if(error) throw error;
} else {
const { error } = await sb.from('equipment_types').insert({
organization_id: targetOrgTypes(),
name, fields
});
if(error) throw error;
}
const modified = !!typeForm.id;
typeForm = { open:false, id:null, name:'', fields:[], busy:false, error:'' };
await loadTypes(true);
dashboardCache.items = null; homeCache.figures = null;
toast(modified ? 'Type updated' : "Equipment type created");
render();
}catch(e){
typeForm.busy = false; typeForm.error = e.message; render();
}
}

function slugify(s){
return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'').replace(/^+|+$/g,'') || ('field' + Math.random().toString(36).slice(2,6));
}

/* ---------------------------------------------------------------------- /
/ Member and invitation management: see js/settings.js /
/ ---------------------------------------------------------------------- */

function viewUnauthorized(){
return <div class="alert alert-error">This section is reserved for the administrator.</div>;
}

/* ---------------------------------------------------------------------- /
/ View: Join via invitation link (without being logged in) /
/ ---------------------------------------------------------------------- */

let joinState = { token:null, loading:false, preview:null, error:'', busy:false, notice:'' };

function renderJoin(token){
if(joinState.token !== token){
joinState = { token, loading:true, preview:null, error:'', busy:false, notice:'' };
sb.rpc('invite_preview', { p_token: token })
.then(({ data, error }) => {
if(error) throw error;
joinState.preview = (data && data[0]) || null;
joinState.loading = false; render();
})
.catch(e => { joinState.error = e.message; joinState.loading = false; render(); });
}

if(joinState.loading) return <div class="center-screen"><div class="spinner"></div></div>;

const p = joinState.preview;
const invalid = !p || !p.valid;

return `

WiTracEQUIP
WiTracEQUIP
${invalid ? `

This invitation link is no longer valid: it has already been used, it has expired, or it has been cancelled.
Request a new link from your organization's administrator.
Back to login
` : `
${p.invite_role === 'admin' ? `You will create the organization ${esc(p.organization_name)} and become its administrator.` : `You are invited to join ${esc(p.organization_name)} as a ${esc(roleLabel(p.invite_role))}.`}
${joinState.error ? `
${esc(joinState.error)}
` : ''} ${joinState.notice ? `
${esc(joinState.notice)}
` : ''}
Your full name 
First Name Last Name
Email 
you@example.com
Password ${passwordField('new-password')}
${joinState.busy ? '…' : 'Create my account'}
`} ${supportFooter()}
`; }
async function handleJoinSubmit(form){
joinState.error = ''; joinState.notice = ''; joinState.busy = true; render();
const fd = new FormData(form);
try{
const { data, error } = await sb.auth.signUp({
email: fd.get('email').trim(),
password: fd.get('password'),
options: { data: { full_name: fd.get('full_name').trim(), invite_token: joinState.token } }
});
if(error) throw error;
if(!data.session){
joinState.notice = "Account created! Check your email to confirm your address, then log in.";
}
}catch(e){
joinState.error = translateAuthError(e.message || String(e));
}finally{
joinState.busy = false; render();
}
}

/* ---------------------------------------------------------------------- /
/ View: New equipment /
/ ---------------------------------------------------------------------- */

let equipForm = { typeId:'', orgId:'', name:'', serial_value:'', values:{}, busy:false, error:'' };

function viewEquipNew(){
// Super-admin: equipment is created for the client from which we came.
if(isSuperAdmin() && !equipForm.orgId) return viewSettings('clients');
const types = typesFor(equipForm.orgId);
if(!types.some(t => t.id === equipForm.typeId)) equipForm.typeId = types[0]?.id || '';
const type = types.find(t=>t.id===equipForm.typeId);
const fields = type?.fields || [];
const back = parkRoute(equipForm.orgId);

return `

←
New equipment
${isSuperAdmin() ? `
at ${esc(clientNameOf(equipForm.orgId))}
` : ''}
${equipForm.error ? `
${esc(equipForm.error)}
` : ''}
Equipment type 
${esc(t.name)}
Name / designation 
${esc(equipForm.name)}
Serial number / registration (optional) 
${esc(equipForm.serial_value)}
${fields.length ? `Specific information for the type` : ''}
${fields.map(c => `
${esc(c.label)} ${c.type==='textarea' ? `
${esc(equipForm.values[c.key]||'')}
` : `
${esc(equipForm.values[c.key]||'')}
`}
`).join('')}
${equipForm.busy?'Saving…':"Create equipment"} Cancel
`; }
async function saveEquip(){
equipForm.error = '';
const name = equipForm.name.trim();
if(!name){ equipForm.error = 'Name is required.'; render(); return; }
if(!equipForm.typeId){ equipForm.error = "Choose an equipment type."; render(); return; }
equipForm.busy = true; render();
// ID and QR link created here: without a network, the equipment already exists
// on the phone (printable label, interventions possible).
const data = {
id: randomId(),
public_token: randomId(),
organization_id: isSuperAdmin() ? equipForm.orgId : state.profile.organization_id,
type_id: equipForm.typeId,
name,
serial_value: equipForm.serial_value.trim() || null,
values: { ...equipForm.values },
archived: false
};
const pending = async () => {
await offlineEquipPutPending(data);
state.pendingCount = await offlineCountPending();
equipForm = { typeId:'', orgId:'', name:'', serial_value:'', values:{}, busy:false, error:'' };
settings.parks = {};
if(dashboardCache.items) dashboardCache.items = [...(await offlineEquipmentAsLines()).filter(e => e.id === data.id), ...dashboardCache.items];
toast("No network: equipment saved on phone. It will be sent as soon as the network returns.");
nav('/equip/' + data.id);
};
if(!navigator.onLine){
try{ await pending(); }catch(e){ equipForm.busy = false; equipForm.error = "Offline saving failed: " + e.message; render(); }
return;
}
try{
const { data, error } = await sb.from('equipments').insert(data).select('id').single();
if(error) throw error;
equipForm = { typeId:'', orgId:'', name:'', serial_value:'', values:{}, busy:false, error:'' };
settings.parks = {};
refreshDashboard();
toast('Equipment created — its QR code is ready'); loadActivity(true);
nav('/equip/' + data.id);
}catch(e){
if(isNetworkError(e)){
try{ await pending(); return; }catch(err){}
}
equipForm.busy = false; equipForm.error = e.message; render();
}
}

/* ---------------------------------------------------------------------- /
/ View: Equipment detail (QR + history) /
/ ---------------------------------------------------------------------- */

let equipDetail = { id:null, item:null, interventions:null, loading:false, error:'',
showIvForm:false, ivBusy:false, ivError:'', ivNotice:'',
showEditForm:false, editBusy:false, editError:'',
editIvId:null, editIvBusy:false, editIvError:'',
newPhotos:[], editPhotos:[], photoUrls:{}, openPhoto:null, photosBusy:false,
draft:{}, editDraft:null };

function viewEquipDetail(id){
if(isSuperAdmin()) loadClients(false); // to display client name
if(equipDetail.id !== id){
equipDetail = { id, item:null, interventions:null, loading:true, error:'',
showIvForm:false, ivBusy:false, ivError:'', ivNotice:'',
showEditForm:false, editBusy:false, editError:'',
editIvId:null, editIvBusy:false, editIvError:'',
newPhotos:[], editPhotos:[], photoUrls:{}, openPhoto:null, photosBusy:false,
draft:{}, editDraft:null };
loadPendingIv();
Promise.all([getEquipment(id), listInterventions(id)])
.then(async ([item, ivs]) => {
if(!item){
// Not yet on the server: created offline, pending sending?
item = (await offlineEquipmentAsLines()).find(e => e.id === id) || null;
}
equipDetail.item = item; equipDetail.interventions = ivs; equipDetail.loading = false; render();
loadPhotoUrls();
if(item) setTimeout(()=>drawQr(publicLink(item.public_token)), 30);
})
.catch(async e => {
if(isNetworkError(e)){
const known = (await knownEquipment()).find(x => x.id === id);
if(known && equipDetail.id === id){
equipDetail.item = known; equipDetail.interventions = []; equipDetail.offline = true;
equipDetail.loading = false; render();
return;
}
}
equipDetail.error = e.message; equipDetail.loading = false; render();
});
}

if(equipDetail.loading) return skeletonRecord((dashboardCache.items || []).find(e => e.id === id)?.name);
if(equipDetail.error) return <div class="alert alert-error">${esc(equipDetail.error)}</div>;
if(!equipDetail.item) return <div class="empty">Equipment not found.</div>;

const eq = equipDetail.item;
const type = state.types.find(t=>t.id===eq.type_id);
const fields = type?.fields || [];
const url = publicLink(eq.public_token);
const onServer = !eq.pending && !equipDetail.offline;

const infoRows = fields.map(c => {
const raw = eq.values?.[c.key];
const val = !raw ? '—' : (c.type === 'date' ? fmtDate(raw) : raw);
return <tr><td class="muted">${esc(c.label)}</td><td>${esc(val)}</td></tr>;
}).join('');

const ivRows = (equipDetail.interventions||[]).map(iv => equipDetail.editIvId === iv.id ? `

${renderIvForm(iv)}` : ` ${fmtDate(iv.date)} ${esc(iv.type)} ${esc(iv.technician)} ${esc(iv.description||'—')} ${iv.modified_at ? `
Modified on ${fmtDateTime(iv.modified_at)}${iv.modified_by ? ' by ' + esc(iv.modified_by) : ''}
` : ''} ${ivThumbnails(iv)} Edit ${isAdmin() ? `Delete` : ''} `).join('');
// The QR code is drawn in a

return `

←
${esc(eq.name)} ${eq.archived?'archived':''}
${isSuperAdmin() && clientNameOf(eq.organization_id) ? `${esc(clientNameOf(eq.organization_id))} · ` : ''}${esc(type?.name || '')}${eq.serial_value ? ' · S/N ' + esc(eq.serial_value) : ''}
${!eq.archived ? `${equipDetail.showEditForm ? 'Cancel' : 'Edit'}` : ''} ${!eq.archived && canDelete() ? `Archive` : ''} ${eq.archived && canDelete() ? `Restore` : ''} ${isAdmin() ? `Delete` : ''}
${eq.pending ? <div class="alert alert-info banner-hl">${navIcon('clock',16)} <span><strong>Created without network, pending sending.</strong> It will be automatically registered upon network return. Its QR code is already final: you can print the label and enter interventions.${eq.last_error && navigator.onLine ? 
Last attempt failed: ${esc(eq.last_error)}` : ''}

Abandon this equipment (not sent)
` : (equipDetail.offline ? `
${navIcon('clock',16)} No network: record from last consultation. You can enter an intervention, it will be sent upon network return. The full history will display upon reconnection.
` : '')} ${equipDetail.showEditForm && !eq.archived && onServer ? renderEditEquipForm(eq, fields) : ''} ${renderPhotoViewer()}
QR Code
${esc(url)}
${eq.public_sharing ? "Anyone scanning this label reads the maintenance log: controller, inspector, insurer, buyer. No account and no registration — and nothing editable." : "Public viewing closed: scanning the label shows nothing anymore."}
${canDelete() && onServer ? `

${eq.public_sharing ? 'Close public consultation' : 'Reopen public consultation'} ${isAdmin() ? `Change link` : ''}
` : ''} ${(!definitiveAddress() && isAdmin()) ? `
Temporary address: this QR code points to the application's current address. Do not print labels in bulk before the definitive domain is in place.
` : ''} 🖨️ Print label
Information
${eq.archived ? `` : ''} ${eq.archived && eq.archive_reason ? `` : ''} ${infoRows}
Created on	${fmtDateTime(eq.created_at)}
Retired on	${fmtDateTime(eq.archived_at)}${eq.archived_by ? ' by ' + esc(eq.archived_by) : ''}
Reason for retirement	${esc(eq.archive_reason)}
Intervention history
${equipDetail.showIvForm?'Cancel':'+ Add'}
${equipDetail.showIvForm ? renderIvForm(null) : ''}
${equipDetail.ivNotice ? <div class="alert alert-info" style="margin-top:10px;">${esc(equipDetail.ivNotice)}</div> : ''}

${(equipDetail.pendingIv || []).length ? `

${equipDetail.pendingIv.map(iv => `
${fmtDate(iv.date)} · ${esc(iv.type)} ⏳ pending sending
${esc(iv.technician)}${iv.description ? ' — ' + esc(iv.description) : ''}
`).join('')}
` : ''} ${equipDetail.interventions && equipDetail.interventions.length ? `
${ivRows}
Date	Type	Technician	Description	
` : ((equipDetail.pendingIv || []).length ? '' : `
${equipDetail.offline ? 'History unavailable without network.' : 'No interventions recorded.'}
`)}
`;
}

function renderIvForm(iv){
// iv provided = modification of an existing intervention; otherwise, new entry.
// Today's date in LOCAL time (toISOString would give UTC date: the next day in the Antilles).
const d = new Date();
const today = ${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')};
const modifying = !!iv;
const err = modifying ? equipDetail.editIvError : equipDetail.ivError;
// Draft: what was typed survives a re-render (adding a photo…).
const b = modifying ? (equipDetail.editDraft && equipDetail.editDraft.id === iv.id ? equipDetail.editDraft : {}) : (equipDetail.draft || {});
const v = (key, defaultValue) => b[key] !== undefined ? b[key] : defaultValue;
return `

${modifying ? `
Edit intervention
` : ''} ${err ? `
${esc(err)}
` : ''}
Date required 
jj/mm/aaaa
Intervention type required 
${esc(v('type', modifying ? iv.type : ''))}
Technician required 
${esc(v('technician', modifying ? iv.technician : (state.profile?.full_name||')))}
Name of the person who performed the intervention. This is who will appear on the logbook in case of inspection — pre-filled with yours, editable if you enter for a colleague.
Description
${esc(v('description', modifying ? (iv.description || '') : ''))}
${renderFieldPhotos(iv)} ${modifying ? `
Modification is timestamped under your name and the old version is kept in the log.
${equipDetail.editIvBusy?'Saving…':'Save changes'} Cancel
` : ` ${equipDetail.ivBusy?(equipDetail.newPhotos.length ? 'Sending photos…' : 'Saving…'):"Save intervention"}`}
`; }
async function submitIntervention(form){
// Read and validate BEFORE any re-render: an intervention record without
// technician or date has no proof value, it should not be sent.
const fd = new FormData(form);
const date = (fd.get('date') || '').trim();
const type = (fd.get('type') || '').trim();
const technician = (fd.get('technician') || '').trim();
const description = (fd.get('description') || '').trim();

if(!date){
equipDetail.ivError = "Intervention date is required.";
render(); return;
}
if(!type){
equipDetail.ivError = "Intervention type is required (maintenance, repair, inspection…).";
render(); return;
}
if(!technician){
equipDetail.ivError = "Technician's name is required: they are the one who commits to the record's traceability.";
render(); return;
}

equipDetail.ivError = ''; equipDetail.ivBusy = true; render();

const ivData = { equipment_id: equipDetail.id, date, type, technician, description: description || null };
const blobs = equipDetail.newPhotos.map(p => p.blob);
const noPhotos = blobs.length ?  Photos (${blobs.length}) could not be sent: add them using "Edit" once the connection is restored. : '';

// No known network (or equipment not yet sent): queue.
if(!navigator.onLine || equipDetail.item?.pending || equipDetail.offline){
await offlinePutPending(ivData);
state.pendingCount = await offlineCountPending();
equipDetail.showIvForm = false;
equipDetail.ivBusy = false;
equipDetail.ivNotice = "No network: intervention saved offline, it will be sent automatically upon reconnection." + noPhotos;
clearPhotos('new'); equipDetail.draft = {};
await loadPendingIv();
render();
return;
}

try{
// Photos first (intervention ID is created here), then the record.
const ivId = randomId();
let photos = [];
if(blobs.length){
try{ photos = await uploadPhotos(equipDetail.item.organization_id, equipDetail.id, ivId, blobs); }
catch(e){
if(/failed to fetch|networkerror|load failed|network request failed/i.test(e.message || '')) throw e;
equipDetail.ivBusy = false;
equipDetail.ivError = "Photos could not be sent (" + (e.message || 'error') + "). Remove them or try again.";
render(); return;
}
}
const { error } = await sb.from('interventions').insert({ id: ivId, ...ivData, photos });
if(error){ if(photos.length) deletePhotos(photos).catch(()=>{}); throw error; }
equipDetail.showIvForm = false;
clearPhotos('new'); equipDetail.draft = {};
await reloadInterventions();
equipDetail.ivBusy = false;
toast(photos.length ? Intervention saved with ${photos.length} photo${photos.length > 1 ? 's' : ''} : 'Intervention saved');
render();
}catch(e){
// Network sometimes cuts out between the navigator.onLine test and the actual send
// (basement, elevator...) : a real network error (not a business error returned by Supabase/Postgres) also switches to the queue
// rather than making the technician lose their input.
const networkMessage = /failed to fetch|networkerror|load failed|network request failed/i.test(e.message || '');
if(networkMessage){
await offlinePutPending(ivData);
state.pendingCount = await offlineCountPending();
equipDetail.showIvForm = false;
equipDetail.ivBusy = false;
equipDetail.ivNotice = "Network unavailable: intervention saved offline, it will be sent automatically upon reconnection." + noPhotos;
clearPhotos('new'); equipDetail.draft = {};
await loadPendingIv();
render();
return;
}
equipDetail.ivBusy = false; equipDetail.ivError = e.message; render();
}
}

/* Modify an intervention: open to all roles, but date and technician name
remain mandatory (the database also checks them). The database timestamps the modification under the author's name and keeps the old version in the log: you can correct an entry, not erase a trace. */
async function submitEditIntervention(form){
const id = form.dataset.id;
const fd = new FormData(form);
const date = (fd.get('date') || '').trim();
const type = (fd.get('type') || '').trim();
const technician = (fd.get('technician') || '').trim();
const description = (fd.get('description') || '').trim();
if(!date){ equipDetail.editIvError = "Intervention date is required."; render(); return; }
if(!type){ equipDetail.editIvError = "Intervention type is required."; render(); return; }
if(!technician){ equipDetail.editIvError = "Technician's name is required."; render(); return; }
if(!navigator.onLine){ equipDetail.editIvError = "No network: modifying an intervention requires a connection."; render(); return; }

equipDetail.editIvError = ''; equipDetail.editIvBusy = true; render();
let newPhotos = [];
try{
const iv = (equipDetail.interventions || []).find(x => x.id === id) || {};
const update = { date, type, technician, description: description || null };
const blobs = equipDetail.editPhotos.map(p => p.blob);
if(blobs.length){
newPhotos = await uploadPhotos(equipDetail.item.organization_id, equipDetail.id, id, blobs);
update.photos = [...(iv.photos || []), ...newPhotos];
}
const { error } = await sb.from('interventions').update(update).eq('id', id);
if(error) throw error;
newPhotos = [];
clearPhotos('edit'); equipDetail.editDraft = null;
await reloadInterventions();
equipDetail.editIvId = null;
settings.log = null;
toast('Intervention modified');
}catch(e){
if(newPhotos.length) deletePhotos(newPhotos).catch(()=>{});
equipDetail.editIvError = e.message;
}finally{
equipDetail.editIvBusy = false; render();
}
}

async function deleteIntervention(id){
const iv = (equipDetail.interventions || []).find(x => x.id === id);
if(!iv) return;
if(!await confirm("Delete the intervention “" + iv.type + "” from " + fmtDate(iv.date) + "?\n\nIt will disappear from this equipment's log. A copy is kept in the log."+(iv.photos||[]).length ? ' Its photos will be deleted.' : '')) return;
try{
const { data, error } = await sb.from('interventions').delete().eq('id', id).select('id');
if(error) throw error;
if(!data || !data.length) throw new Error("Deletion refused: only an administrator can delete an intervention.");
if((iv.photos || []).length) deletePhotos(iv.photos).catch(()=>{});
await reloadInterventions();
settings.log = null;
homeCache.figures = null;
toast('Intervention deleted');
render();
}catch(e){ toast('Error: ' + e.message, 'error'); }
}

/* Interventions entered offline for the open record (displayed at the top). */
async function loadPendingIv(){
const id = equipDetail.id;
try{
const list = await offlineListPending(id);
if(equipDetail.id !== id) return;
equipDetail.pendingIv = list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
render();
}catch(e){}
}

async function abandonPendingEquipment(id){
if(!await confirm("Abandon this equipment?\n\nIt was never sent: it will disappear from this phone, along with any interventions entered for it offline.", { danger:true, ok:'Abandon' })) return;
try{
await offlineDeleteEquipment(id);
for(const iv of await offlineListPending(id)) await offlineDelete(iv.id);
state.pendingCount = await offlineCountPending();
if(dashboardCache.items) dashboardCache.items = dashboardCache.items.filter(e => e.id !== id);
equipDetail.id = null;
toast('Equipment abandoned');
nav('/equipments');
}catch(e){ toast('Error: ' + e.message, 'error'); }
}

/* Network return: erroneous loads retry, we reload the actual profile if we started offline, then the queue sends (offline.js). */
window.addEventListener('online', async () => {
if(!state.session) return;
settings.clientsError = ''; settings.membersError = ''; settings.supportError = ''; settings.logError = '';
Object.keys(settings.parks || {}).forEach(k => { if(settings.parks[k]?.error) delete settings.parks[k]; });
founderCache.error = ''; homeCache.error = '';
if(homeCache.figures && !Object.keys(homeCache.figures).length) homeCache.figures = null;
if(dashboardCache.error || dashboardCache.offlineLe !== null && dashboardCache.offlineLe !== undefined){ dashboardCache.error = ''; refreshDashboard(); }
if(equipDetail.offline){ equipDetail.id = null; }
render();
if(!state.offline) return;
try{
await loadProfileAndOrg(); await loadSuperAdminStatus(); await loadTypes(true);
try{ await loadTemplates(); }catch(err){ console.error('[templates]', err); }
state.offline = false;
saveInstant({ profile: state.profile, orgName: state.orgName, superAdmin: state.superAdmin, types: state.types, templates: state.templates });
dashboardCache.offlineLe = null;
refreshDashboard();
}catch(e){}
});

/* ---------------------------------------------------------------------- /
/ Intervention Photos (report, replaced part, damage…) /
/ ---------------------------------------------------------------------- */
const MAX_IV_PHOTOS = 6;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

async function reloadInterventions(){
equipDetail.interventions = await listInterventions(equipDetail.id);
loadActivity(true);
loadPhotoUrls();
}

/* Temporary links (1 h) to photos: storage is private. /
async function loadPhotoUrls(){
const id = equipDetail.id;
const missing = [];
(equipDetail.interventions || []).forEach(iv => (iv.photos || []).forEach(p => { if(!equipDetail.photoUrls[p]) missing.push(p); }));
if(!missing.length) return;
try{
const urls = await photoUrls(missing);
if(equipDetail.id !== id) return;
Object.assign(equipDetail.photoUrls, urls);
render();
}catch(e){ / thumbnails left pending */ }
}

function clearPhotos(target){
const key = target === 'edit' ? 'editPhotos' : 'newPhotos';
(equipDetail[key] || []).forEach(p => URL.revokeObjectURL(p.url));
equipDetail[key] = [];
}

function memorizeDraft(form){
if(!form) return;
const fd = new FormData(form);
const b = { date: fd.get('date'), type: fd.get('type'), technician: fd.get('technician'), description: fd.get('description') };
if(form.dataset.action === 'submit-iv-edit') equipDetail.editDraft = { id: form.dataset.id, ...b };
else equipDetail.draft = b;
}

async function loadImage(file){
return new Promise((resolve, reject) => {
const url = URL.createObjectURL(file);
const img = new Image();
img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unreadable image')); };
img.src = url;
});
}

/* Reduces photo (1600 px max, JPEG): a phone photo goes from 4–8 MB to ~300 KB, sending remains fast even on weak 4G. */
async function compressPhoto(file){
try{
const img = await loadImage(file);
const max = 1600;
const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
const c = document.createElement('canvas');
c.width = Math.round(img.naturalWidth * r); c.height = Math.round(img.naturalHeight * r);
c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
const blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.82));
if(blob && blob.size) return blob;
throw new Error('compression');
}catch(e){
if(file.size <= MAX_PHOTO_BYTES && /^image/(jpeg|png|webp|heic|heif)$/.test(file.type)) return file;
throw new Error("${file.name}" is not a readable image or exceeds 5 MB.);
}
}

async function addPhotos(input){
const target = input.dataset.target === 'edit' ? 'edit' : 'new';
const form = input.closest('form');
memorizeDraft(form);
const list = target === 'edit' ? equipDetail.editPhotos : equipDetail.newPhotos;
const iv = target === 'edit' ? (equipDetail.interventions || []).find(x => x.id === equipDetail.editIvId) : null;
const existing = (iv?.photos || []).length + list.length;
let files = [...(input.files || [])];
input.value = '';
if(!files.length) return;
const availableSlots = MAX_IV_PHOTOS - existing;
if(availableSlots <= 0){ toast(${MAX_IV_PHOTOS} photos maximum per intervention, 'error'); return; }
if(files.length > availableSlots){ toast(${MAX_IV_PHOTOS} photos maximum: only the first ${availableSlots} will be kept, 'error'); files = files.slice(0, availableSlots); }
equipDetail.photosBusy = true; render();
for(const f of files){
try{
const blob = await compressPhoto(f);
list.push({ blob, url: URL.createObjectURL(blob) });
}catch(e){ toast(e.message, 'error'); }
}
equipDetail.photosBusy = false; render();
}

function renderFieldPhotos(iv){
const target = iv ? 'edit' : 'new';
const list = iv ? equipDetail.editPhotos : equipDetail.newPhotos;
const existing = iv ? (iv.photos || []) : [];
const total = existing.length + list.length;
return `

Photos (optional) ${total ? `
${existing.map(p => `${equipDetail.photoUrls[p] ? `` : ''}`).join('')} ${list.map((p, i) => `Photo ${i+1}×`).join('')}
` : ''} ${total < MAX_IV_PHOTOS ? `${equipDetail.photosBusy ? 'Preparing…' : (total ? 'Add another photo' : 'Attach a photo')} ` : ''}
Intervention report, part replaced, damage noted… ${MAX_IV_PHOTOS} photos maximum. They serve as proof and remain attached to the intervention.
`; }
function ivThumbnails(iv){
const ph = iv.photos || [];
if(!ph.length) return '';
return <div class="iv-thumbnails">${ph.map(p => { const u = equipDetail.photoUrls[p]; return u ? Intervention photo:; }).join('')}</div>;
}

function renderPhotoViewer() {
const o = equipDetail.openPhoto;
if (!o) return '';

const iv = (equipDetail.interventions || []).find(x => x.id === o.ivId);
const ph = iv?.photos || [];
const i = ph.indexOf(o.path);

if (!iv || i < 0) return '';

const u = equipDetail.photoUrls[o.path];
const urlEsc = u ? esc(u) : '';
const totalPhotos = ph.length;

return     <div class="photo-viewer" data-action="photo-close" role="dialog" aria-label="Intervention photo">       <div class="photo-viewer-top">         <div class="small">           ${esc(iv.type)} · ${fmtDate(iv.date)}${totalPhotos > 1 ? · ${i + 1}/${totalPhotos}` : ''}

×

  <div class="photo-viewer-image">
    ${totalPhotos > 1 ? `<button type="button" class="photo-viewer-nav g" data-action="photo-next" data-direction="-1" aria-label="Previous">‹</button>` : ''}
    ${u ? `<img src="${urlEsc}" alt="Photo ${i + 1} of${totalPhotos}">` : ''}
    ${totalPhotos > 1 ? `<button type="button" class="photo-viewer-nav d" data-action="photo-next" data-direction="1" aria-label="Next">›</button>` : ''}
  </div>
  
  <div class="photo-viewer-bottom">
    ${u ? `<a class="btn btn-sm" href="${urlEsc}" target="_blank" rel="noopener">Open large</a>` : ''}
    ${isAdmin() ? `<button type="button" class="btn btn-sm btn-danger" data-action="photo-delete" data-id="${iv.id}" data-path="${esc(o.path)}">Delete this photo</button>` : ''}
  </div>
</div>
`;
}

function changePhoto(direction){
const o = equipDetail.openPhoto;
const iv = (equipDetail.interventions || []).find(x => x.id === o?.ivId);
const ph = iv?.photos || [];
if(ph.length < 2) return;
const i = (ph.indexOf(o.path) + direction + ph.length) % ph.length;
equipDetail.openPhoto = { ivId: iv.id, path: ph[i] };
render();
}

async function deleteOpenPhoto(){
const o = equipDetail.openPhoto;
const iv = (equipDetail.interventions || []).find(x => x.id === o?.ivId);
if(!iv) return;
if(!await confirm("Delete this photo?\n\nIt can no longer serve as proof for this intervention.", { danger:true, ok:'Delete' })) return;
try{
const remaining = (iv.photos || []).filter(p => p !== o.path);
const { error } = await sb.from('interventions').update({ photos: remaining }).eq('id', iv.id);
if(error) throw error;
await deletePhotos([o.path]).catch(() => {});
iv.photos = remaining;
equipDetail.openPhoto = null;
toast('Photo deleted');
render();
}catch(e){ toast('Error: ' + e.message, 'error'); }
}

/* Open or close free consultation of an equipment. Closed, the label
already stuck shows nothing anymore: the record becomes internal. */
async function actionToggleSharing(){
const eq = equipDetail.item;
if(!eq) return;
const open = !eq.public_sharing;
if(!open && !await confirm("Close public consultation? Labels already stuck on this equipment will show nothing to those who scan them.")) return;
try{
const { error } = await sb.from('equipments')
.update({ public_sharing: open }).eq('id', eq.id);
if(error) throw error;
eq.public_sharing = open;
render();
}catch(e){ toast('Error: ' + e.message, 'error'); }
}

/* Change token: the old label becomes silent, the record and its history
do not move. Useful if a label goes with a sold vehicle.
Goes through the RPC regenerate_public_token (rather than a direct update()):
it re-checks the role and organization on the server side (independently
of the equipments_guard trigger, which remains a second barrier), and returns the
new token in a single round trip. The displayed QR is automatically redrawn
on the next render() (see comment above drawQr above:
it redraws on each record render from eq.public_token). */
async function actionRegeneratePublicLink(){
const eq = equipDetail.item;
if(!eq) return;
if(!await confirm("Change the public link? All labels already printed for this equipment will stop working: a new one will need to be printed. The record and its history are kept.")) return;
try{
const { data: newToken, error } = await sb.rpc('regenerate_public_token', { p_equipment_id: eq.id });
if(error) throw error;
eq.public_token = newToken;
eq.old_link_active = false;
render();
}catch(e){ toast('Error: ' + e.message, 'error'); }
}

function printQr(){
const eq = equipDetail.item;
const printArea = document.getElementById('print-area');
if(!eq || !printArea) return;

const url = publicLink(eq.public_token);

// QR generated specifically for printing, in high definition: a
// thermal printer prints at ~203 dots per inch, the 200 px QR displayed
// on screen would come out blurry and hard to scan.
let source = null;
if(typeof QRious !== 'undefined'){
const hd = document.createElement('canvas');
new QRious({ element:hd, value: url, size: 800, background:'white', foreground:'#000000', level:'M' });
source = hd;
} else {
source = document.getElementById('qr-canvas'); // fallback
}
if(!source) return;

const identifier = (eq.serial_value || '').trim();
const size = LABEL.qr_size_mm;

printArea.innerHTML = <img id="print-qr-img" alt="" style="width:${size}mm;height:${size}mm;"> ${(LABEL.show_identifier && identifier) ?

${esc(identifier)}
: ''};
const img = document.getElementById('print-qr-img');
// The image is encoded data: we must wait for it to be decoded,
// otherwise the print starts before and the label comes out blank.
img.onload = () => window.print();
img.onerror = () => window.print();
img.src = source.toDataURL('image/png');
}

/* ---------------------------------------------------------------------- /
/ Event delegation /
/ ---------------------------------------------------------------------- */

document.addEventListener('click', (e) => {
const t = e.target.closest('[data-action]');
if(!t) return;
const action = t.dataset.action;

if(action === 'go'){ nav(t.dataset.path); closeMenus(); }
else if(action === 'toggle-menu'){ e.stopPropagation(); document.getElementById('user-dropdown')?.classList.toggle('open'); }
else if(action === 'logout'){ voluntaryLogout = true; clearInstants(); sb.auth.signOut({ scope:'local' }); }
else if(action === 'dash-reload'){ dashboardCache.error = ''; dashboardCache.items = null; render(); loadEquipment(); }
else if(action === 'auth-mode'){ state.authMode = t.dataset.mode; state.authError=''; state.authNotice=''; render(); }
else if(action === 'toggle-type-form'){ typeForm.open ? (typeForm = { open:false, id:null, name:'', fields:[], busy:false, error:'' }, render()) : openTypeForm(null); }
else if(action === 'edit-type'){
const type = state.types.find(x => x.id === t.dataset.id);
if(type) openTypeForm(type);
}
else if(action === 'field-add'){ typeForm.fields.push({label:'', type:'text'}); render(); }
else if(action === 'field-remove'){ typeForm.fields.splice(+t.dataset.i, 1); render(); }
else if(action === 'save-type'){ saveType(); }
else if(action === 'save-equip'){ saveEquip(); }
else if(action === 'toggle-iv-form'){
equipDetail.showIvForm = !equipDetail.showIvForm; equipDetail.editIvId = null; equipDetail.ivNotice = '';
if(!equipDetail.showIvForm){ clearPhotos('new'); equipDetail.draft = {}; equipDetail.ivError = ''; }
render();
}
else if(action === 'iv-photo-remove'){
memorizeDraft(t.closest('form'));
const list = t.dataset.target === 'edit' ? equipDetail.editPhotos : equipDetail.newPhotos;
const [p] = list.splice(+t.dataset.i, 1);
if(p) URL.revokeObjectURL(p.url);
render();
}
else if(action === 'photo-open'){ equipDetail.openPhoto = { ivId:t.dataset.id, path:t.dataset.path }; render(); }
else if(action === 'photo-close'){ if(t.tagName === 'BUTTON' || e.target === t){ equipDetail.openPhoto = null; render(); } }
else if(action === 'photo-next'){ changePhoto(+t.dataset.direction); }
else if(action === 'photo-delete'){ deleteOpenPhoto(); }
else if(action === 'abandon-equip-pending'){ abandonPendingEquipment(t.dataset.id); }
else if(action.startsWith('mm-')){ actionModele(action, t); }
else if(action === 'archive-equip'){ openModalArchive([equipDetail.id]); }
else if(action === 'del-equip-one'){ openModalDeleteEquipment([t.dataset.id]); }
else if(action === 'equip-archive-sel'){ openModalArchive((dashboardCache.items||[]).filter(e => !e.archived && dashboardCache.sel.includes(e.id)).map(e => e.id)); }
else if(action === 'equip-delete-sel'){ openModalDeleteEquipment([...dashboardCache.sel]); }
else if(action === 'equip-restore-sel'){ restoreSelection(); }
else if(action === 'equip-deselect'){ dashboardCache.sel = []; render(); }
else if(action === 'modal-close'){ closeModal(); }
else if(action === 'modal-backdrop'){ if(e.target === t) closeModal(); }
else if(action === 'modal-validate'){ validateModal(); }
else if(action === 'iv-modify'){ equipDetail.editIvId = t.dataset.id; equipDetail.editIvError = ''; equipDetail.showIvForm = false; clearPhotos('edit'); equipDetail.editDraft = null; render(); }
else if(action === 'iv-cancel-edit'){ equipDetail.editIvId = null; equipDetail.editIvError = ''; clearPhotos('edit'); equipDetail.editDraft = null; render(); }
else if(action === 'iv-delete'){ deleteIntervention(t.dataset.id); }
else if(action === 'new-client'){ openClientForm(null); }
else if(action === 'edit-client'){ const c = (settings.clients||[]).find(x => x.id === t.dataset.id); if(c) openClientForm(c); }
else if(action === 'close-client-form'){ settings.clientForm = null; render(); }
else if(action === 'clients-status'){ actionClientsStatus(t.dataset.id ? [t.dataset.id] : [...settings.selClients], t.dataset.active === '1'); }
else if(action === 'clients-delete'){ actionClientsDelete(t.dataset.id ? [t.dataset.id] : [...settings.selClients]); }
else if(action === 'clients-deselect'){ settings.selClients = []; render(); }
else if(action === 'members-active'){ actionMembersActive([...settings.selMembers], t.dataset.active === '1'); }
else if(action === 'members-delete'){ actionMembersDelete([...settings.selMembers]); }
else if(action === 'members-deselect'){ settings.selMembers = []; render(); }
else if(action === 'log-refresh'){ settings.log = null; render(); }
else if(action === 'log-delete'){ actionDeleteLog(t.dataset.id); }
else if(action === 'log-clear'){ actionClearLog(); }
else if(action === 'activity-refresh'){ activity.error = ''; loadActivity(true); }
else if(action === 'activity-filter'){ activity.filter = t.dataset.filter; render(); }
else if(action === 'activity-archive'){ toggleActivityArchive(t.dataset.key, t.dataset.archive === '1'); }
else if(action === 'activity-archive-all'){ archiveAllActivity(); }
else if(action === 'support-refresh'){ settings.support = null; render(); }
else if(action === 'support-status'){
setSupportStatus(t.dataset.id, t.dataset.status)
.then(() => {
const d = (settings.support || []).find(x => x.id === t.dataset.id);
if(d) d.status = t.dataset.status;
toast(t.dataset.status === 'processed' ? 'Request moved to "Processed" in "History"' : (t.dataset.status === 'new' ? 'Request marked for processing' : 'Request marked as in progress'));
render();
})
.catch(err => toast('Error: ' + err.message, 'error'));
}
else if(action === 'support-delete'){ actionDeleteRequest(t.dataset.id); }
else if(action === 'rename-member'){ openRenameMember(t.dataset.id); }
else if(action === 'rename-me'){ renameMe(); }
else if(action === 'change-pwd'){ closeMenus(); changeMyPassword(); }
else if(action === 'reset-pwd'){ resetMemberPassword(t.dataset.id); }
else if(action === 'liberate-device'){ actionLiberateDevice(t.dataset.id); }
else if(action === 'new-equip-client'){
equipForm = { typeId:'', orgId:t.dataset.id, name:'', serial_value:'', values:{}, busy:false, error:'' };
nav('/equip-new');
}
else if(action === 'cancel-rename'){ settings.rename = null; render(); }
else if(action === 'support-filter'){ settings.supportFilter = t.dataset.filter; render(); }
else if(action === 'toggle-invite-client'){ settings.inviteOpen = !settings.inviteOpen; render(); }
else if(action === 'restore-equip'){ restoreEquipement(); }
else if(action === 'toggle-edit-equip'){ equipDetail.showEditForm = !equipDetail.showEditForm; equipDetail.editError=''; render(); }
else if(action === 'print-qr'){ printQr(); }
else if(action === 'open-scanner'){ openScanner(); }
else if(action === 'open-on-computer'){ actionOpenOnComputer(); }
else if(action === 'computer-new-code'){ newComputerCode(); }
else if(action === 'resume-mobile'){ actionResumeMobile(); }
else if(action === 'return-phone-control'){ actionReturnPhoneControl(); }
else if(action === 'close-scanner'){ closeScanner(); }
else if(action === 'connection-from-scan'){ connectionFromScan(); }
else if(action === 'toggle-sharing'){ actionToggleSharing(); }
else if(action === 'regen-token'){ actionRegeneratePublicLink(); }
else if(action === 'create-invite'){ actionCreateInvite(); }
else if(action === 'cancel-invite'){ actionCancelInvite(t.dataset.id); }
else if(action === 'toggle-templates'){ templateState.open = !templateState.open; render(); }
else if(action === 'apply-template'){ applyTemplate(t.dataset.key); }
else if(action === 'copy-link'){ copyToClipboard(inviteUrl(t.dataset.token), t); }
else if(action === 'toggle-pw'){
// Direct DOM manipulation: absolutely no render(), which would erase the input.
const input = t.parentElement && t.parentElement.querySelector('input');
if(input){
const wasVisible = input.type === 'text';
input.type = wasVisible ? 'password' : 'text';
t.innerHTML = wasVisible ? EYE_ICON : EYE_SLASH_ICON;
const label = wasVisible ? 'Show password' : 'Hide password';
t.setAttribute('aria-label', label);
t.setAttribute('title', label);
input.focus();
}
}
});

document.addEventListener('input', (e) => {
const t = e.target.closest('[data-action]');
if(!t) return;
const action = t.dataset.action;
if(action === 'dash-search'){ dashboardCache.search = t.value; debounce(refreshDashboard); }
else if(action === 'dash-filter-type'){ dashboardCache.typeId = t.value; refreshDashboard(); }
else if(action === 'dash-archived'){ dashboardCache.showArchived = t.checked; refreshDashboard(); }
else if(action === 'type-name'){ typeForm.name = t.value; }
else if(action === 'field-label'){ typeForm.fields[+t.dataset.i].label = t.value; }
else if(action === 'field-type'){ typeForm.fields[+t.dataset.i].type = t.value; }
else if(action === 'equip-name'){ equipForm.name = t.value; }
else if(action === 'equip-serial'){ equipForm.serial_value = t.value; verifySerial(t.value, null); }
else if(action === 'edit-serial'){ verifySerial(t.value, t.dataset.exclude || null); }
else if(action === 'equip-type'){ equipForm.typeId = t.value; render(); }
else if(action === 'equip-value'){ equipForm.values[t.dataset.key] = t.value; }
else if(action === 'invite-org'){
settings.invite = { orgId:t.value, role:settings.invite.role, label:settings.invite.label, allTypes:true, types:[], busy:false, error:'', lastToken:null };
render();
}
else if(action === 'invite-role'){ settings.invite.role = t.value; render(); }
else if(action === 'invite-label'){ settings.invite.label = t.value; }
else if(action === 'invite-all-types'){
settings.invite.allTypes = t.checked;
if(t.checked) settings.invite.types = [];
settings.invite.error = ''; render();
}
else if(action === 'invite-type'){
const id = t.dataset.type;
settings.invite.types = t.checked
? [...new Set([...settings.invite.types, id])]
: settings.invite.types.filter(x => x !== id);
settings.invite.error = ''; render();
}
else if(action === 'sel-equip'){ toggle(dashboardCache, 'sel', t.dataset.id, t.checked); render(); }
else if(action === 'sel-equip-all'){ dashboardCache.sel = t.checked ? (dashboardCache.items||[]).filter(e => !e.pending).map(e => e.id) : []; render(); }
else if(action === 'sel-client'){ toggle(settings, 'selClients', t.dataset.id, t.checked); render(); }
else if(action === 'sel-clients-all'){ settings.selClients = t.checked ? (t.dataset.ids || '').split(',').filter(Boolean) : []; render(); }
else if(action === 'search-client'){ settings.searchClient = t.value; settings.selClients = []; render(); }
else if(action === 'search-profile'){ settings.searchProfile = t.value; settings.selMembers = []; render(); }
else if(action === 'sort-clients'){ settings.sortClients = t.value; render(); }
else if(action === 'search-park'){ settings.searchPark = t.value; render(); }
else if(action === 'park-archives'){ settings.parkArchives = t.checked; render(); }
else if(action === 'sel-member'){ toggle(settings, 'selMembers', t.dataset.id, t.checked); render(); }
else if(action === 'sel-members-all'){
const ids = (t.dataset.ids || '').split(',').filter(Boolean);
settings.selMembers = t.checked ? [...new Set([...settings.selMembers, ...ids])] : settings.selMembers.filter(x => !ids.includes(x));
render();
}
else if(action === 'filter-client-members'){ settings.filterClient = t.value; settings.selMembers = []; render(); }
else if(action === 'modal-choice'){ modal.choice = t.value; modal.error = ''; render(); }
else if(action === 'modal-precision'){ modal.precision = t.value; }
else if(action === 'client-template'){ settings.clientForm.template = t.value; updateClientFormFromDom(); render(); }
else if(action === 'member-role'){ actionMemberRole(t.dataset.id, t.value); }
else if(action === 'move-member'){ actionMoveMember(t.dataset.id, t.value); }
else if(action === 'access-all'){ actionAccessAll(t.dataset.id, t.checked); }
else if(action === 'access-type'){ actionAccessType(t.dataset.id, t.dataset.type, t.checked); }
else if(action.startsWith('mm-')){ modelInput(action, t); }
});

document.addEventListener('submit', (e) => {
const t = e.target.closest('[data-action]');
if(!t) return;
e.preventDefault();
const action = t.dataset.action;
if(action === 'submit-auth') handleAuthSubmit(t);
else if(action === 'submit-iv') submitIntervention(t);
else if(action === 'submit-join') handleJoinSubmit(t);
else if(action === 'submit-edit-equip') submitEditEquip(t);
else if(action === 'submit-iv-edit') submitEditIntervention(t);
else if(action === 'submit-client') submitClientForm(t);
else if(action === 'submit-support') submitSupport(t);
else if(action === 'submit-rename') submitRename(t);
});

document.addEventListener('click', (e) => {
if(!e.target.closest('.user-menu')) closeMenus();
});
function closeMenus(){ document.getElementById('user-dropdown')?.classList.remove('open'); }

/* Adds / removes an ID from a selection list. */
function toggle(obj, key, id, checked){
const list = obj[key] || [];
obj[key] = checked ? [...new Set([...list, id])] : list.filter(x => x !== id);
}

/* Before re-rendering the client form, copy the current input
(otherwise changing the business template would erase what was just typed). */
function updateClientFormFromDom(){
const form = document.querySelector('form[data-action="submit-client"]');
if(!form || !settings.clientForm) return;
const fd = new FormData(form);
for(const k of ['name','address','phone','email','contact','notes']) settings.clientForm[k] = (fd.get(k) || '').toString();
}

/* Escape closes the modal window. */
document.addEventListener('keydown', (e) => {
if(e.key === 'Escape' && modal && !modal.busy) closeModal();
else if(e.key === 'Escape' && equipDetail.openPhoto){ equipDetail.openPhoto = null; render(); }
});

/* Photos chosen (camera or gallery): the "change" event is
the only reliable one for a file field on all phones. */
document.addEventListener('change', (e) => {
const t = e.target;
if(t && t.dataset && t.dataset.action === 'iv-photos') addPhotos(t);
});

/* Intervention form input memorized on the fly. */
document.addEventListener('input', (e) => {
const f = e.target.form;
if(f && e.target.name && (f.dataset.action === 'submit-iv' || f.dataset.action === 'submit-iv-edit')) memorizeDraft(f);
});

let debounceTimer;
function debounce(fn, ms=250){ clearTimeout(debounceTimer); debounceTimer = setTimeout(fn, ms); }

/* ---------------------------------------------------------------------- /
/ Auth bootstrap /
/ ---------------------------------------------------------------------- */

/* IMPORTANT: never await a Supabase call IN this callback.
supabase-js triggers it while holding its authentication lock; a request
launched within waits for the same lock → permanent block of ALL requests
(symptom: lists not loading after returning to the app, e.g., Equipment tab
frozen). Just note the session, then work outside the callback (setTimeout 0),
as recommended by Supabase. */
sb.auth.onAuthStateChange((event, session) => {
// Logout not from button: session closed elsewhere
// (account opened on another device, password reset…).
if(event === 'SIGNED_OUT' && state.profile && !voluntaryLogout && !state.authError) state.authError = MSG_SESSION_CLOSED;
if(event === 'SIGNED_OUT') voluntaryLogout = false;
const sameUser = !!(session && state.session && state.profile && state.profile.id === session.user.id);
state.session = session;
// Token refresh, return to foreground: same user, nothing to reload.
if(session && sameUser && event !== 'INITIAL_SESSION') return;
setTimeout(() => applySession(session), 0);
});

/* ---------------------------------------------------------------------- /
/ An account = one person /
/ ---------------------------------------------------------------------- /
/ The last login wins: the device that was connected before
loses access to data (checked on server side, sql/19) and we inform it. */
let voluntaryLogout = false;
const MSG_SESSION_CLOSED = "You have been logged out remotely by WiDIAG MQ. Log back in with your email and password.";
const MSG_DEVICE_REFUSED = "This account is already in use on another device. One account = one person = one device. To use it on this one, ask WiDIAG MQ to re-grant access (widiagmq@gmail.com · 06 96 20 93 19).";

/* Identifier for THIS device (browser), created once and kept.
The server only keeps its fingerprint. See sql/20. /
function deviceId(){
let id = null;
try{ id = localStorage.getItem('wte_device'); }catch(e){}
if(!id || id.length < 16){
id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()) + '-' + Math.random().toString(36).slice(2, 10);
try{ localStorage.setItem('wte_device', id); }catch(e){}
}
return id;
}
function deviceInfo(){
const ua = navigator.userAgent || '';
const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
: /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Device';
const nav = /Edg//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox|FxiOS/.test(ua) ? 'Firefox'
: /CriOS|Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'browser';
const app = matchMedia('(display-mode: standalone)').matches || navigator.standalone ? ' (installed app)' : '';
return ${os} · ${nav}${app};
}
/ 'ok' | 'refused' | null (no response: network) /
/ Phone/tablet or computer: only used to require the first
connection (the account's "key") to be on a phone. Security, however,
relies on the server (sql/23), not this test. */
function deviceType(){
const ua = navigator.userAgent || '';
const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
return mobile ? 'mobile' : 'computer';
}
async function linkDevice(){
try{
const { data, error } = await sb.rpc('link_device', { p_device: deviceId(), p_info: deviceInfo(), p_type: deviceType() });
if(error) return null;
return data;
}catch(e){ return null; }
}
async function refuseDevice(message){
state.authError = message || MSG_DEVICE_REFUSED;
voluntaryLogout = true;
clearInstants();
try{ await sb.auth.signOut({ scope:'local' }); }catch(e){}
nav('/');
}
let sessionVerificationInProgress = false;

async function verifySession(){
if(sessionVerificationInProgress || !state.session || !state.profile || state.superAdmin || !navigator.onLine) return;
sessionVerificationInProgress = true;
try{
const { data, error } = await sb.rpc('my_active_session');
if(!error && data === false){
const state = await readComputerState();
if(state && state.device === 'mobile' && state.computer_expires_at){ pauseSession(state); }
else if(state && state.device === 'computer'){ await endComputerSession("The session on the computer has ended. To continue, scan again with your phone."); }
else if(state && !state.device && computerState.mode === 'computer'){ await endComputerSession("The phone has regained control: the session on the computer is closed."); }
else await forcedLogout();
}
}catch(e){ /* network: will retry */ }
finally{ sessionVerificationInProgress = false; }
}

async function forcedLogout(){
state.authError = MSG_SESSION_CLOSED;
voluntaryLogout = true; // message already set
clearInstants();
if(dialogueOpen) dialogueOpen.close(null);
try{ await sb.auth.signOut({ scope:'local' }); }catch(e){}
nav('/');
}

setInterval(verifySession, 60000);
// On computer, tighter control: phone takeover is seen quickly.
setInterval(() => { if(computerState.mode === 'computer') verifySession(); }, 15000);
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible'){ verifySession(); if(state.profile && !state.superAdmin) loadActivity(true); } });
window.addEventListener('online', () => setTimeout(verifySession, 1500));

/* ---------------------------------------------------------------------- /
/ Computer authorized by phone (v2.17.5, sql/23) /
/ ---------------------------------------------------------------------- /
/ The phone linked to the account is the key. A computer displays a QR code;
the phone scans it → the computer is opened for 45 minutes and the phone
goes into pause (computer OR phone, never both). The phone can regain control
at any time. Everything is verified by the server. */
const MSG_FIRST_MOBILE = "First connection: use your phone. It will then open the computer by scanning a QR code.";
function computerStateInitial(){ return { mode:null, code:null, codeLe:0, error:'', message:'', expires:null, info:'', offset:0, busy:false, warned:false }; }
let computerState = computerStateInitial();
let computerTimers = [];
function stopComputerTimers(){ computerTimers.forEach(t => clearInterval(t)); computerTimers = []; }

async function readComputerState(){
try{ const { data, error } = await sb.rpc('computer_state'); return error ? null : data; }catch(e){ return null; }
}
function shortTime(iso){
try{ return new Date(iso).toLocaleTimeString('en-FR', { hour:'2-digit', minute:'2-digit' }); }catch(e){ return ''; }
}

/* --- Computer side: waiting for scan --- */
function enterComputerWaiting(message){
stopComputerTimers();
computerState = { ...computerStateInitial(), mode:'waiting', message: message || '' };
state.loading = false;
newComputerCode();
computerTimers.push(setInterval(monitorWaiting, 3000));
render();
}
async function newComputerCode(){
computerState.busy = true; computerState.error = '';
try{
const { data, error } = await sb.rpc('request_computer_access', { p_device: deviceId(), p_info: deviceInfo() });
if(error) throw error;
computerState.code = data; computerState.codeLe = Date.now();
}catch(e){ computerState.code = null; computerState.error = (e && e.message) || String(e); }
computerState.busy = false;
render();
}
async function monitorWaiting(){
if(computerState.mode !== 'waiting' || !state.session) return;
if(!computerState.busy && (!computerState.code || Date.now() - computerState.codeLe > 4.5 * 60000)){ if(computerState.code) newComputerCode(); return; }
const state = await readComputerState();
if(computerState.mode === 'waiting' && state && state.valid && state.device === 'computer'){
stopComputerTimers();
computerState = { ...computerStateInitial(), mode:'computer' };
state.loading = true; render();
applySession(state.session);
}
}
function renderComputerWaiting(){
const p = computerState;
return `

WiTracEQUIP
Open on this computer
One account = one person: the computer opens with your phone.
${p.message ? `
${esc(p.message)}
` : ''}
${p.error ? `
${esc(p.error)}
` : p.code ? `` : `
`}
On your phone, open WiTracEQUIP.
Tap "Scan QR code" and aim at this code.
Confirm: this computer opens for 45 minutes.
During this time, your phone is paused; you can regain control at any time. The code renews itself.
New code Log out
`; } function drawComputerQr(){ const c = document.getElementById('computer-qr'); if(c && computerState.code && typeof QRious !== 'undefined') new QRious({ element:c, value:'WTE-COMPUTER:' + computerState.code, size:220, background:'white', foreground:'#141b1e', level:'M' }); }
/* --- Computer side: session open (45 min) --- */
async function startComputerTimer(){
const state = await readComputerState();
if(state && state.computer_expires_at){
computerState.expires = state.computer_expires_at;
computerState.offset = state.now ? new Date(state.now).getTime() - Date.now() : 0;
}
stopComputerTimers();
computerTimers.push(setInterval(tickComputer, 1000));
tickComputer();
}
function remainingComputerTime(){ return computerState.expires ? new Date(computerState.expires).getTime() - (Date.now() + (computerState.offset || 0)) : null; }
function computerBannerText(){
const remaining = remainingComputerTime();
if(remaining === null) return 'Computer session';
const min = Math.max(0, Math.ceil(remaining / 60000));
return remaining <= 120000
? Session on this computer closes in ${min} min: save your current entry.
: Computer open until ${shortTime(computerState.expires)} (still ${min} min);
}
function renderComputerBanner(){
if(computerState.mode !== 'computer') return '';
const remaining = remainingComputerTime();
return `


${navIcon('clock',15)} ${esc(computerBannerText())}
Return control to phone
`; } function tickComputer(){ if(computerState.mode !== 'computer' || !computerState.expires) return; const remaining = remainingComputerTime(); const el = document.getElementById('computer-banner'); if(el){ el.classList.toggle('alert', remaining <= 120000); const t = document.getElementById('computer-banner-text'); if(t) t.textContent = computerBannerText(); } if(remaining <= 120000 && !computerState.warned){ computerState.warned = true; confirm("Session on this computer closes in 2 minutes.\n\nSave your current entry. To continue afterwards, scan the QR code again with your phone.", { info:true, ok:'Understood' }); } if(remaining <= 0) endComputerSession("45 minutes on the computer have elapsed. To continue, scan again with your phone."); } async function endComputerSession(message){ if(computerState.mode === 'waiting') return; stopComputerTimers(); computerState.mode = 'waiting'; try{ await sb.rpc('close_computer'); }catch(e){} if(dialogueOpen) dialogueOpen.close(null); clearInstants(); dashboardCache = dashboardInitial(dashboardCache.request + 1); enterComputerWaiting(message); } async function returnPhoneControl(){ if(!await confirm("Close session on this computer?\n\nYour phone will become active immediately. Remember to save any current entry.", { ok:'Close session', danger:false })) return; await endComputerSession("Session closed: your phone is now active."); }
/* --- Phone side: authorize, pause, resume --- */
async function authorizeComputerFromScan(code){
if(!await confirm("Open your account on this computer?\n\nThe computer can be used for 45 minutes. During this time, this phone is paused; you can regain control at any time.", { ok:"Authorize computer", danger:false })) return;
try{
const { error } = await sb.rpc('authorize_computer', { p_code: code });
if(error) throw error;
pauseSession(await readComputerState());
}catch(e){ toast((e && e.message) || String(e), 'error'); }
}
function pauseSession(state){
stopComputerTimers();
computerState = { ...computerStateInitial(), mode:'paused', expires: state && state.computer_expires_at || null, info: state && state.computer_info || '' };
if(dialogueOpen) dialogueOpen.close(null);
if(scannerState.open) closeScanner();
state.loading = false;
computerTimers.push(setInterval(async () => {
if(computerState.mode !== 'paused' || !navigator.onLine) return;
const state = await readComputerState();
if(computerState.mode !== 'paused' || !state) return;
if(state.valid) resumeAfterPause();
else if(state.computer_expires_at !== computerState.expires){ computerState.expires = state.computer_expires_at; render(); }
}, 20000));
render();
}
function resumeAfterPause(){
stopComputerTimers();
computerState = computerStateInitial();
state.loading = true; render();
applySession(state.session);
}
async function actionResumeMobile(){
if(!await confirm("Resume on this phone?\n\nThe session open on the computer will close immediately.", { ok:'Resume here', danger:false })) return;
try{
const { error } = await sb.rpc('resume_mobile');
if(error) throw error;
resumeAfterPause();
}catch(e){ toast(((e && e.message) || e), 'error'); }
}
function renderMobilePaused(){
const p = computerState;
return `

WiTracEQUIP
Account open on a computer
${navIcon('smartphone', 34)}
Your account is used on ${esc(p.info || 'a computer')}${p.expires ? ` until ${esc(shortTime(p.expires))}` : ''}.

This phone is paused: one account can only be used on one device at a time. It will become active again automatically at the end of the computer session.

Resume on this phone Log out
`; } async function actionOpenOnComputer(){ closeMenus(); if(!await confirm("Open your account on a computer\n\n1. On the computer, open WiTracEQUIP and log in with your email and password.\n2. A QR code will appear: scan it with this phone.\n\nThe computer will then be open for 45 minutes and this phone will pause.", { ok:'Scan QR code', danger:false })) return; openScanner(); }
async function applySession(session){
if(session !== state.session) return; // another session arrived in the meantime
state.accessError = '';
if(session){
// One account = one device: check BEFORE loading anything.
if(navigator.onLine){
const link = await linkDevice();
if(session !== state.session) return;
if(link === 'refused'){ await refuseDevice(); return; }
if(link === 'first_mobile'){ await refuseDevice(MSG_FIRST_MOBILE); return; }
if(link === 'authorization_required'){ enterComputerWaiting(); return; }
if(link === 'mobile_blocked'){ pauseSession(await readComputerState()); return; }
computerState = { ...computerStateInitial(), mode: link === 'computer_ok' ? 'computer' : 'mobile' };
if(link === 'computer_ok') startComputerTimer();
}
try{
await loadProfileAndOrg();
await loadSuperAdminStatus();
await loadTypes(true);
try{ await loadTemplates(); }catch(err){ console.error('[templates]', err); }
state.offline = false;
saveInstant({ profile: state.profile, orgName: state.orgName, superAdmin: state.superAdmin, types: state.types, templates: state.templates });
if(state.profile?.password_to_change) setTimeout(imposeNewPassword, 400);
setTimeout(verifySession, 2000);
if(!state.superAdmin) setTimeout(() => loadActivity(true), 1200);
returnAfterLogin();
// Preload: equipment list is ready before opening it.
if(dashboardCache.items === null) setTimeout(() => { if(state.session && dashboardCache.items === null) loadEquipment(); }, 300);
try{
state.pendingCount = await offlineCountPending();
if(navigator.onLine) syncPendingInterventions();
}catch(e){ console.error('[offline]', e); }
}catch(e){
console.error(e);
const instant = readInstant();
if(isNetworkError(e) && inst.profile && inst.profile.id === session.user.id && (deviceType() === 'mobile' || inst.superAdmin)){
// No network: start with last known state.
state.profile = inst.profile; state.orgName = inst.orgName || ''; state.superAdmin = !!inst.superAdmin;
state.types = inst.types || []; state.typesLoaded = true; state.offline = true;
state.templates = inst.templates || null;
returnAfterLogin();
try{ state.pendingCount = await offlineCountPending(); }catch(err){}
state.loading = false;
render();
return;
}
state.accessError = (e && e.message) ? e.message : 'Error loading profile.';
}
} else {
state.profile = null; state.orgName = ''; state.superAdmin = false;
stopComputerTimers(); computerState = computerStateInitial();
activity = { items:null, loading:false, error:'', filter:'recent' };
dashboardCache = dashboardInitial(dashboardCache.request + 1); // invalidate any ongoing response
resetSettings();
modal = null;
supportState = { category:'question', subject:'', message:'', email:'', busy:false, error:'', ok:'', myRequests:null };
homeCache = { figures: null, loading: false, error: '' };
founderCache = { data:null, loading:false, error:'' };
joinState = { token:null, loading:false, preview:null, error:'', busy:false, notice:'' };
state.typesLoaded = false; state.types = [];
}
state.loading = false;
render();
}

render(); // first render (spinner) while session loads
// Function to display the Intervention Report page
function displayInterventionReport() {
const app = document.getElementById('app');
if (app && typeof loadInterventionForm === 'function') {
loadInterventionForm(app);
}
