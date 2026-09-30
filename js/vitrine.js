/* WiTracEQUIP — page vitrine affichée à l'ouverture, avant la connexion.
   Le rendu est une simple chaîne HTML (comme les autres vues). Les liens internes
   n'utilisent PAS d'ancres # (le routage de l'appli repose sur le hash) : ils passent
   par data-action="vitrine-scroll". Le formulaire écrit dans public.demandes_contact
   (voir sql/11-demandes-contact.sql) et, si la base refuse, ouvre un e-mail prérempli. */

/* Langue de la vitrine : FR par défaut, EN si le navigateur est en anglais ou si le visiteur
   a choisi EN (choix mémorisé). vt('français','english') renvoie le texte de la langue active. */
function vtLang(){
try{ const m = localStorage.getItem('wte_vt_lang'); if(m === 'en' || m === 'fr') return m; }catch(e){}
return /^en/i.test(navigator.language || '') ? 'en' : 'fr';
}
function vtToggleLang(){
const n = vtLang() === 'en' ? 'fr' : 'en';
try{ localStorage.setItem('wte_vt_lang', n); }catch(e){}
document.documentElement.lang = n;
if(typeof render === 'function') render();
}
const vt = (fr, en) => (vtLang() === 'en' ? en : fr);

function renderVitrine(){
document.documentElement.lang = vtLang();
const b = (cible, txt) => `<button type="button" data-action="vitrine-scroll" data-cible="${cible}">${txt}</button>`;
return `
<div class="vt">
<header><div class="vt-wrap">
<button type="button" class="vt-logo" data-action="vitrine-scroll" data-cible="haut"><img src="assets/icons/logo-mark.png" alt="">WiTrac<b>EQUIP</b></button>
<nav>${b('solution',vt('Solution','Solution'))}${b('equipe',vt('Équipe','Team'))}${b('securite',vt('Sécurité','Security'))}${b('tarifs',vt('Tarifs','Pricing'))}${b('contact',vt('Contact','Contact'))}</nav>
<button type="button" class="vt-lang" data-action="vitrine-lang" aria-label="${vt('Switch to English','Passer en français')}">${vt('EN','FR')}</button>
<button type="button" class="vt-btn vt-gold vt-sm" data-action="vitrine-connexion">${vt('Se connecter','Log in')}</button>
</div></header>

<div class="vt-hero" id="vt-haut"><div class="vt-wrap">
<div class="vt-eyebrow">${vt(`Le carnet d'entretien numérique de vos équipements`,`The digital maintenance logbook for your equipment`)}</div>
<h1>${vt(`La traçabilité de votre parc, <em>maîtrisée en temps réel.</em>`,`Your equipment fleet, fully traceable <em>in real time.</em>`)}</h1>
<p class="vt-lead">${vt(`Un QR code sur chaque équipement : vos équipes consultent et complètent l'historique en 2 secondes, photos à l'appui, même sans réseau. Mise en service et SAV assurés aux Antilles.`,`A QR code on every piece of equipment: your teams view and update its history in 2 seconds, with photos, even without a network. On-site setup and after-sales support across the French West Indies.`)}</p>
<div class="vt-access">
<div>${vt(`<b>Déjà client ?</b><br><span>Retrouvez votre parc et vos équipes.</span>`,`<b>Already a customer?</b><br><span>Find your fleet and your teams.</span>`)}</div>
<button type="button" class="vt-btn vt-gold" data-action="vitrine-connexion">${vt(`Se connecter →`,`Log in →`)}</button>
</div>
<button type="button" class="vt-interest" data-action="vitrine-scroll" data-cible="contact">${vt(`Intéressé par cette solution ? Demandez votre démonstration →`,`Interested in this solution? Request your demo →`)}</button>
<div class="vt-stats">
<div><b>2 s</b>${vt(`<small>pour ouvrir l'historique d'un équipement</small>`,`<small>to open an equipment's history</small>`)}</div>
<div><b>24/7</b>${vt(`<small>information disponible, même hors réseau</small>`,`<small>information available, even offline</small>`)}</div>
<div>${vt(`<b>UE</b><small>données hébergées en Union européenne</small>`,`<b>EU</b><small>data hosted in the European Union</small>`)}</div>
<div><b>0 €</b>${vt(`<small>de matériel à acheter : vos appareils suffisent</small>`,`<small>of hardware to buy: your own devices are enough</small>`)}</div>
</div>
</div></div>

<section id="vt-solution"><div class="vt-wrap">
<div class="vt-kicker">${vt(`Pourquoi WiTracEQUIP`,`Why WiTracEQUIP`)}</div>
<h2>${vt(`Ce que l'absence de traçabilité vous coûte déjà.`,`What a lack of traceability is already costing you.`)}</h2>
<p class="vt-sub">${vt(`Un contrôle, un sinistre, le départ d'un technicien : c'est là qu'on mesure la valeur d'un historique fiable.`,`An inspection, an incident, a technician leaving: that is when a reliable history proves its worth.`)}</p>
<div class="vt-grid vt-g3">
<div class="vt-card"><div class="vt-ico">01</div><h3>${vt(`Contrôles sans stress`,`Stress-free inspections`)}</h3><p>${vt(`Un historique complet, daté et documenté, présenté en quelques secondes.`,`A complete, dated and documented history, shown in seconds.`)}</p></div>
<div class="vt-card"><div class="vt-ico">02</div><h3>${vt(`Responsabilité protégée`,`Liability protected`)}</h3><p>${vt(`Chaque intervention est horodatée et appuyée par des photos : votre diligence est démontrée.`,`Every intervention is time-stamped and backed by photos: your due diligence is proven.`)}</p></div>
<div class="vt-card"><div class="vt-ico">03</div><h3>${vt(`Du temps retrouvé`,`Time saved`)}</h3><p>${vt(`Un scan ouvre la fiche, l'intervention se saisit sur place. Fini les ressaisies et les appels.`,`One scan opens the record and the work is logged on the spot. No more re-typing or phone calls.`)}</p></div>
<div class="vt-card"><div class="vt-ico">04</div><h3>${vt(`Une mémoire durable`,`A lasting record`)}</h3><p>${vt(`L'historique appartient à l'établissement, quel que soit l'intervenant ou le prestataire.`,`The history belongs to your organisation, whoever the technician or contractor is.`)}</p></div>
<div class="vt-card"><div class="vt-ico">05</div><h3>${vt(`Budget maîtrisé`,`Budget under control`)}</h3><p>${vt(`Pannes récurrentes repérées, statistiques et export Excel pour justifier vos décisions.`,`Recurring failures spotted, statistics and Excel export to back your decisions.`)}</p></div>
<div class="vt-card"><div class="vt-ico">06</div><h3>${vt(`Patrimoine valorisé`,`Asset value protected`)}</h3><p>${vt(`Un carnet consultable en lecture seule qui rassure experts, assureurs et acheteurs.`,`A read-only logbook that reassures experts, insurers and buyers.`)}</p></div>
</div>
</div></section>

<section class="vt-alt"><div class="vt-wrap">
<div class="vt-kicker">${vt(`Simple comme un scan`,`As simple as a scan`)}</div>
<h2>${vt(`Opérationnel en trois gestes.`,`Up and running in three steps.`)}</h2>
<div class="vt-grid vt-steps vt-g3" style="margin-top:28px">
<div class="vt-step"><div>${vt(`<h3>Scannez</h3><p>Le QR code de l'équipement ouvre sa fiche instantanément, depuis l'application ou l'appareil photo.</p>`,`<h3>Scan</h3><p>The equipment's QR code opens its record instantly, from the app or the phone camera.</p>`)}</div></div>
<div class="vt-step"><div>${vt(`<h3>Saisissez</h3><p>Date, type, description et jusqu'à 6 photos. Sans réseau, tout est envoyé au retour de la connexion.</p>`,`<h3>Record</h3><p>Date, type, description and up to 6 photos. Offline, everything is sent as soon as the connection returns.</p>`)}</div></div>
<div class="vt-step"><div>${vt(`<h3>Partagez</h3><p>Toute l'équipe voit la même information, à jour, au moment où elle en a besoin.</p>`,`<h3>Share</h3><p>The whole team sees the same up-to-date information, exactly when they need it.</p>`)}</div></div>
</div>
<div class="vt-chips">${vt(`<span>Téléphone ou ordinateur</span><span>Statistiques &amp; export Excel</span><span>Journal d'activité</span><span>Modèles métier : hôtellerie, santé, BTP, industrie, flotte</span>`,`<span>Phone or computer</span><span>Statistics &amp; Excel export</span><span>Activity log</span><span>Industry templates: hospitality, healthcare, construction, industry, fleet</span>`)}</div>
</div></section>

<section id="vt-equipe"><div class="vt-wrap">
<div class="vt-grid vt-g2" style="align-items:center;gap:30px">
<div>
<div class="vt-kicker">${vt(`Le travail d'équipe`,`Teamwork`)}</div>
<h2>${vt(`Plusieurs intervenants, une seule information à jour.`,`Several people, one up-to-date source of truth.`)}</h2>
<p class="vt-sub" style="margin-bottom:0">${vt(`Le technicien intervient, le responsable valide, la direction pilote. Chaque compte est personnel : chaque action est attribuée à son auteur et inscrite au journal.`,`The technician works, the manager validates, the management steers. Every account is personal: each action is attributed to its author and recorded in the log.`)}</p>
</div>
<div class="vt-quote"><p>${vt(`« Technicien de terrain depuis plus de dix ans, j'ai partout rencontré le même problème : qu'a-t-on fait sur cet équipement, et quand ? »`,`“A field technician for over ten years, I ran into the same problem everywhere: what was done on this equipment, and when?”`)}</p><small>${vt(`Willem Leplé — fondateur de WiDIAG MQ`,`Willem Leplé — founder of WiDIAG MQ`)}</small></div>
</div>
</div></section>

<section id="vt-securite" class="vt-alt"><div class="vt-wrap">
<div class="vt-kicker">${vt(`Sécurité &amp; confiance`,`Security &amp; trust`)}</div>
<h2>${vt(`Vos données restent les vôtres.`,`Your data stays yours.`)}</h2>
<div class="vt-grid vt-g2" style="margin-top:26px">
<div class="vt-card"><h3>${vt(`Hébergé en Union européenne`,`Hosted in the European Union`)}</h3><p>${vt(`Infrastructure professionnelle, échanges chiffrés, cadre RGPD.`,`Professional infrastructure, encrypted exchanges, GDPR compliant.`)}</p></div>
<div class="vt-card"><h3>${vt(`Cloisonnement strict`,`Strict separation`)}</h3><p>${vt(`Chaque établissement ne voit que son propre parc, vérifié par la base de données elle-même.`,`Each organisation only sees its own equipment, enforced by the database itself.`)}</p></div>
<div class="vt-card"><h3>${vt(`Droits par rôle`,`Role-based permissions`)}</h3><p>${vt(`Utilisateur, responsable, administrateur : chacun agit dans son périmètre. Accès sur invitation uniquement.`,`User, manager, administrator: everyone acts within their own scope. Access by invitation only.`)}</p></div>
<div class="vt-card"><h3>${vt(`Réversible`,`Reversible`)}</h3><p>${vt(`Vos données vous appartiennent : export complet sur simple demande.`,`Your data belongs to you: full export on request.`)}</p></div>
</div>
</div></section>

<section id="vt-tarifs"><div class="vt-wrap">
<div class="vt-kicker">Tarifs</div>
<h2>${vt(`Une offre claire, sans engagement caché.`,`A clear offer, no hidden commitments.`)}</h2>
<p class="vt-sub">${vt(`Toutes les fonctionnalités sont incluses : photos, hors réseau, journal, accès ordinateur, statistiques, mises à jour et SAV.`,`All features are included: photos, offline mode, activity log, computer access, statistics, updates and support.`)}</p>
<div class="vt-grid vt-g3">
<div class="vt-card vt-price vt-rec"><span class="vt-tag">${vt(`Tout compris`,`All inclusive`)}</span>${vt(`<h3>Abonnement</h3>`,`<h3>Subscription</h3>`)}<div class="vt-big">89 €${vt(`<small> / mois</small>`,`<small> / month</small>`)}</div><ul class="vt-ok">${vt(`<li>Équipements et QR codes illimités</li><li>Travail simultané, historique partagé</li><li>Rôles et accès par métier</li><li>Support et évolutions inclus</li>`,`<li>Unlimited equipment and QR codes</li><li>Simultaneous work, shared history</li><li>Roles and access by job</li><li>Support and updates included</li>`)}</ul></div>
<div class="vt-card vt-price">${vt(`<h3>Mise en place</h3>`,`<h3>Setup</h3>`)}<div class="vt-big">495 €${vt(`<small> une fois</small>`,`<small> one-off</small>`)}</div><ul class="vt-ok">${vt(`<li>Visite sur site et recensement du parc</li><li>Création de l'espace, des comptes et des rôles</li><li>Formation et prise en main du personnel</li><li>Réunion mensuelle de suivi</li><li>Support 24h/24, 7j/7</li>`,`<li>On-site visit and equipment inventory</li><li>Workspace, accounts and roles created for you</li><li>Staff training and onboarding</li><li>Monthly follow-up meeting</li><li>Support 24/7</li>`)}</ul></div>
<div class="vt-card vt-price">${vt(`<h3>À la carte</h3>`,`<h3>Add-ons</h3>`)}<div class="vt-big">25 €${vt(`<small> / compte</small>`,`<small> / account</small>`)}</div><ul class="vt-ok">${vt(`<li>Nouveau compte personnel et sécurisé</li><li>QR codes clé en main : 3,99 € par équipement, générés et posés par nos soins</li>`,`<li>Additional personal, secure account</li><li>Turnkey QR codes: €3.99 per item, generated and fitted by us</li>`)}</ul></div>
</div>
</div></section>

<section class="vt-alt"><div class="vt-wrap">
<div class="vt-kicker">${vt(`Un accompagnement de bout en bout`,`End-to-end support`)}</div>
<h2>${vt(`Nous restons à vos côtés, longtemps après le premier scan.`,`We stay by your side, long after the first scan.`)}</h2>
<div class="vt-grid vt-g3" style="margin-top:26px">
<div class="vt-card">${vt(`<h3>Mise en service sur site</h3><p>Cadrage, paramétrage, étiquettes, formation : tout est préparé pour vous, aux Antilles.</p>`,`<h3>On-site commissioning</h3><p>Scoping, configuration, labels, training: everything is prepared for you, in the French West Indies.</p>`)}</div>
<div class="vt-card">${vt(`<h3>SAV rapide et humain</h3><p>Réponse dans la journée, par téléphone, e-mail ou depuis l'application.</p>`,`<h3>Fast, human support</h3><p>Same-day answer, by phone, email or from within the app.</p>`)}</div>
<div class="vt-card">${vt(`<h3>Un outil qui progresse</h3><p>Nouveautés déployées automatiquement, vos idées intégrées, un point de suivi régulier.</p>`,`<h3>A tool that keeps improving</h3><p>New features rolled out automatically, your ideas built in, a regular check-in.</p>`)}</div>
</div>
</div></section>

<section id="vt-contact"><div class="vt-wrap">
<div class="vt-card vt-formbox">
<div class="vt-kicker">${vt(`Intéressé par cette solution ?</div>`,`Interested in this solution?</div>`)}
<h2>${vt(`Demandez votre démonstration.`,`Request your demo.`)}</h2>
<p class="vt-sub">${vt(`Nous scannons un de vos équipements, chez vous, pour vous montrer concrètement. Réponse rapide.`,`We scan one of your pieces of equipment, at your site, to show you how it works in practice. Quick reply.`)}</p>
<form data-action="submit-vitrine-contact" id="vt-form">
<div class="vt-row"><label>${vt(`Nom et prénom`,`Full name`)}<input name="nom" required maxlength="120" autocomplete="name"></label><label>${vt(`Établissement`,`Organisation`)}<input name="etablissement" required maxlength="120" autocomplete="organization"></label></div>
<div class="vt-row"><label>${vt(`E-mail`,`Email`)}<input type="email" name="email" required maxlength="200" autocomplete="email"></label><label>${vt(`Téléphone`,`Phone`)}<input type="tel" name="telephone" maxlength="40" autocomplete="tel"></label></div>
<label>${vt(`Votre secteur`,`Your sector`)}<select name="secteur"><option value="Hôtellerie">${vt(`Hôtellerie`,`Hospitality`)}</option><option value="Santé">${vt(`Santé`,`Healthcare`)}</option><option value="BTP">${vt(`BTP`,`Construction`)}</option><option value="Industrie">${vt(`Industrie`,`Industry`)}</option><option value="Flotte / location">${vt(`Flotte / location`,`Fleet / rental`)}</option><option value="Autre">${vt(`Autre`,`Other`)}</option></select></label>
<label>${vt(`Votre besoin`,`Your needs`)}<textarea name="message" rows="4" maxlength="2000" placeholder="${vt(`Nombre approximatif d'équipements, contrôles à suivre…`,`Approximate number of items, inspections to track…`)}"></textarea></label>
<label class="vt-hp" aria-hidden="true">Site<input name="site" tabindex="-1" autocomplete="off"></label>
<label class="vt-chk"><input type="checkbox" name="rgpd" required> ${vt(`J'accepte que mes informations soient utilisées pour répondre à ma demande (<a href="confidentialite.html" target="_blank" rel="noopener">RGPD</a>).`,`I agree that my information may be used to answer my request (<a href="confidentialite.html" target="_blank" rel="noopener">GDPR</a>).`)}</label>
<div class="vt-err" id="vt-err"></div>
<button class="vt-btn vt-gold" type="submit" id="vt-envoi" style="font-size:17px;padding:16px">${vt(`Envoyer ma demande`,`Send my request`)}</button>
</form>
<div class="vt-done" id="vt-done">${vt(`<h2>Merci !</h2><p class="vt-sub" style="margin:0 auto" id="vt-done-txt">Votre demande est bien partie. Nous vous recontactons très vite.</p>`,`<h2>Thank you!</h2><p class="vt-sub" style="margin:0 auto" id="vt-done-txt">Your request has been sent. We will get back to you very soon.</p>`)}</div>
</div>
</div></section>

<a class="vt-wa" target="_blank" rel="noopener" aria-label="WhatsApp" href="https://wa.me/596696209319?text=${encodeURIComponent(vt(`Bonjour, je souhaite en savoir plus sur cette solution WiTracEQUIP.`,`Hello, I would like to know more about the WiTracEQUIP solution.`))}"><svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true"><path fill="#fff" d="M16 3C9 3 3.4 8.6 3.4 15.5c0 2.3.6 4.4 1.7 6.3L3 29l7.4-1.9c1.8 1 3.8 1.5 5.6 1.5 7 0 12.6-5.6 12.6-12.5S23 3 16 3zm0 22.9c-1.8 0-3.5-.5-5-1.4l-.4-.2-4.4 1.1 1.2-4.2-.3-.4a10 10 0 0 1-1.6-5.3C5.5 9.9 10.2 5.3 16 5.3S26.500 9.900 26.500 15.500 21.800 25.900 16 25.900zm5.700-7.500c-.3-.2-1.900-.9-2.200-1-.3-.1-.5-.2-.7.200-.2.300-.8 1-.9 1.200-.2.200-.3.200-.6.100-.3-.2-1.300-.5-2.500-1.500-.9-.8-1.500-1.800-1.700-2.100-.2-.3 0-.5.100-.6l.5-.5c.1-.2.200-.3.300-.5.100-.2.100-.4 0-.5-.1-.2-.7-1.700-1-2.300-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.100-.8.400-.3.300-1 1-1 2.500s1.100 2.900 1.200 3.100c.2.200 2.100 3.300 5.200 4.500.7.300 1.300.5 1.700.6.700.2 1.400.2 1.900.1.600-.1 1.900-.8 2.100-1.500.3-.7.300-1.400.2-1.500-.1-.1-.3-.2-.6-.3z"/></svg></a>
<footer><div class="vt-wrap"><b>WiDIAG MQ</b> · Habitation Gondeau, Le Lamentin — Martinique<br>${esc(SUPPORT_EMAIL)} · 06 96 20 93 19<br>SIRET 841 516 800 00031<br><a href="mentions.html">${vt(`Mentions légales`,`Legal notice`)}</a> · <a href="confidentialite.html">${vt(`Confidentialité`,`Privacy`)}</a><br><br>${vt(`<i>Vos équipements ont une histoire. Gardez-en la trace.</i>`,`<i>Your equipment has a story. Keep track of it.</i>`)}</div></footer>

<div class="vt-dock"><button type="button" class="vt-btn vt-gold" ${vt(`data-action="vitrine-connexion">Se connecter</button><button type="button" class="vt-btn vt-ghost" data-action="vitrine-scroll" data-cible="contact">Demander une démo</button>`,`data-action="vitrine-connexion">Log in</button><button type="button" class="vt-btn vt-ghost" data-action="vitrine-scroll" data-cible="contact">Request a demo</button>`)}</div>
</div>`;
}

function vitrineScroll(cible){
if(cible === 'haut'){ window.scrollTo({ top:0, behavior:'smooth' }); return; }
document.getElementById('vt-' + cible)?.scrollIntoView({ behavior:'smooth', block:'start' });
}

async function submitVitrineContact(form){
const fd = new FormData(form);
if(fd.get('site')) return; // champ piège : un humain ne le voit pas
const d = {
nom: String(fd.get('nom') || '').trim(),
etablissement: String(fd.get('etablissement') || '').trim(),
email: String(fd.get('email') || '').trim(),
telephone: String(fd.get('telephone') || '').trim(),
secteur: String(fd.get('secteur') || ''),
message: String(fd.get('message') || '').trim() + (vtLang() === 'en' ? '\n\n[Langue du visiteur : anglais]' : ''),
};
const btn = document.getElementById('vt-envoi'); if(btn) btn.disabled = true;
let texte = vt('Votre demande est bien partie. Nous vous recontactons très vite.', 'Your request has been sent. We will get back to you very soon.');
try{
const { error } = await sb.from('demandes_contact').insert(d);
if(error) throw error;
}catch(e){
// Base indisponible ou table pas encore créée : on n'abandonne pas le prospect.
const corps = `Nom : ${d.nom}\nÉtablissement : ${d.etablissement}\nE-mail : ${d.email}\nTéléphone : ${d.telephone}\nSecteur : ${d.secteur}\n\n${d.message}`;
window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Demande de démonstration WiTracEQUIP')}&body=${encodeURIComponent(corps)}`;
texte = vt('Votre application de messagerie s’ouvre pour finaliser l’envoi. Merci !', 'Your email app is opening so you can finish sending. Thank you!');
}
form.style.display = 'none';
const dt = document.getElementById('vt-done-txt'); if(dt) dt.textContent = texte;
document.getElementById('vt-done')?.classList.add('on');
}
