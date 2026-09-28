/* WiTracEQUIP — page vitrine affichée à l'ouverture, avant la connexion.
   Le rendu est une simple chaîne HTML (comme les autres vues). Les liens internes
   n'utilisent PAS d'ancres # (le routage de l'appli repose sur le hash) : ils passent
   par data-action="vitrine-scroll". Le formulaire écrit dans public.demandes_contact
   (voir sql/11-demandes-contact.sql) et, si la base refuse, ouvre un e-mail prérempli. */

function renderVitrine(){
const b = (cible, txt) => `<button type="button" data-action="vitrine-scroll" data-cible="${cible}">${txt}</button>`;
return `
<div class="vt">
<header><div class="vt-wrap">
<button type="button" class="vt-logo" data-action="vitrine-scroll" data-cible="haut"><img src="assets/icons/logo-mark.png" alt="">WiTrac<b>EQUIP</b></button>
<nav>${b('solution','Solution')}${b('equipe','Équipe')}${b('securite','Sécurité')}${b('tarifs','Tarifs')}${b('contact','Contact')}</nav>
<button type="button" class="vt-btn vt-gold vt-sm" data-action="vitrine-connexion">Se connecter</button>
</div></header>

<div class="vt-hero" id="vt-haut"><div class="vt-wrap">
<div class="vt-eyebrow">Le carnet d'entretien numérique de vos équipements</div>
<h1>La traçabilité de votre parc, <em>maîtrisée en temps réel.</em></h1>
<p class="vt-lead">Un QR code sur chaque équipement : vos équipes consultent et complètent l'historique en 2 secondes, photos à l'appui, même sans réseau. Mise en service et SAV assurés aux Antilles.</p>
<div class="vt-access">
<div><b>Déjà client ?</b><br><span>Retrouvez votre parc et vos équipes.</span></div>
<button type="button" class="vt-btn vt-gold" data-action="vitrine-connexion">Se connecter →</button>
</div>
<button type="button" class="vt-interest" data-action="vitrine-scroll" data-cible="contact">Intéressé par cette solution ? Demandez votre démonstration →</button>
<div class="vt-stats">
<div><b>2 s</b><small>pour ouvrir l'historique d'un équipement</small></div>
<div><b>24/7</b><small>information disponible, même hors réseau</small></div>
<div><b>UE</b><small>données hébergées en Union européenne</small></div>
<div><b>0 €</b><small>de matériel à acheter : vos appareils suffisent</small></div>
</div>
</div></div>

<section id="vt-solution"><div class="vt-wrap">
<div class="vt-kicker">Pourquoi WiTracEQUIP</div>
<h2>Ce que l'absence de traçabilité vous coûte déjà.</h2>
<p class="vt-sub">Un contrôle, un sinistre, le départ d'un technicien : c'est là qu'on mesure la valeur d'un historique fiable.</p>
<div class="vt-grid vt-g3">
<div class="vt-card"><div class="vt-ico">01</div><h3>Contrôles sans stress</h3><p>Un historique complet, daté et documenté, présenté en quelques secondes.</p></div>
<div class="vt-card"><div class="vt-ico">02</div><h3>Responsabilité protégée</h3><p>Chaque intervention est horodatée et appuyée par des photos : votre diligence est démontrée.</p></div>
<div class="vt-card"><div class="vt-ico">03</div><h3>Du temps retrouvé</h3><p>Un scan ouvre la fiche, l'intervention se saisit sur place. Fini les ressaisies et les appels.</p></div>
<div class="vt-card"><div class="vt-ico">04</div><h3>Une mémoire durable</h3><p>L'historique appartient à l'établissement, quel que soit l'intervenant ou le prestataire.</p></div>
<div class="vt-card"><div class="vt-ico">05</div><h3>Budget maîtrisé</h3><p>Pannes récurrentes repérées, statistiques et export Excel pour justifier vos décisions.</p></div>
<div class="vt-card"><div class="vt-ico">06</div><h3>Patrimoine valorisé</h3><p>Un carnet consultable en lecture seule qui rassure experts, assureurs et acheteurs.</p></div>
</div>
</div></section>

<section class="vt-alt"><div class="vt-wrap">
<div class="vt-kicker">Simple comme un scan</div>
<h2>Opérationnel en trois gestes.</h2>
<div class="vt-grid vt-steps vt-g3" style="margin-top:28px">
<div class="vt-step"><div><h3>Scannez</h3><p>Le QR code de l'équipement ouvre sa fiche instantanément, depuis l'application ou l'appareil photo.</p></div></div>
<div class="vt-step"><div><h3>Saisissez</h3><p>Date, type, description et jusqu'à 6 photos. Sans réseau, tout est envoyé au retour de la connexion.</p></div></div>
<div class="vt-step"><div><h3>Partagez</h3><p>Toute l'équipe voit la même information, à jour, au moment où elle en a besoin.</p></div></div>
</div>
<div class="vt-chips"><span>Téléphone ou ordinateur</span><span>Statistiques &amp; export Excel</span><span>Journal d'activité</span><span>Modèles métier : hôtellerie, santé, BTP, industrie, flotte</span></div>
</div></section>

<section id="vt-equipe"><div class="vt-wrap">
<div class="vt-grid vt-g2" style="align-items:center;gap:30px">
<div>
<div class="vt-kicker">Le travail d'équipe</div>
<h2>Plusieurs intervenants, une seule information à jour.</h2>
<p class="vt-sub" style="margin-bottom:0">Le technicien intervient, le responsable valide, la direction pilote. Chaque compte est personnel : chaque action est attribuée à son auteur et inscrite au journal.</p>
</div>
<div class="vt-quote"><p>« Technicien de terrain depuis plus de dix ans, j'ai partout rencontré le même problème : qu'a-t-on fait sur cet équipement, et quand ? »</p><small>Willem Leplé — fondateur de WiDIAG MQ</small></div>
</div>
</div></section>

<section id="vt-securite" class="vt-alt"><div class="vt-wrap">
<div class="vt-kicker">Sécurité &amp; confiance</div>
<h2>Vos données restent les vôtres.</h2>
<div class="vt-grid vt-g2" style="margin-top:26px">
<div class="vt-card"><h3>Hébergé en Union européenne</h3><p>Infrastructure professionnelle, échanges chiffrés, cadre RGPD.</p></div>
<div class="vt-card"><h3>Cloisonnement strict</h3><p>Chaque établissement ne voit que son propre parc, vérifié par la base de données elle-même.</p></div>
<div class="vt-card"><h3>Droits par rôle</h3><p>Utilisateur, responsable, administrateur : chacun agit dans son périmètre. Accès sur invitation uniquement.</p></div>
<div class="vt-card"><h3>Réversible</h3><p>Vos données vous appartiennent : export complet sur simple demande.</p></div>
</div>
</div></section>

<section id="vt-tarifs"><div class="vt-wrap">
<div class="vt-kicker">Tarifs</div>
<h2>Une offre claire, sans engagement caché.</h2>
<p class="vt-sub">Toutes les fonctionnalités sont incluses : photos, hors réseau, journal, accès ordinateur, statistiques, mises à jour et SAV.</p>
<div class="vt-grid vt-g3">
<div class="vt-card vt-price vt-rec"><span class="vt-tag">Tout compris</span><h3>Abonnement</h3><div class="vt-big">89 €<small> / mois</small></div><ul class="vt-ok"><li>Équipements et QR codes illimités</li><li>Travail simultané, historique partagé</li><li>Rôles et accès par métier</li><li>Support et évolutions inclus</li></ul></div>
<div class="vt-card vt-price"><h3>Mise en place</h3><div class="vt-big">495 €<small> une fois</small></div><ul class="vt-ok"><li>Visite sur site et recensement du parc</li><li>Création de l'espace, des comptes et des rôles</li><li>Formation et prise en main du personnel</li><li>Réunion mensuelle de suivi</li><li>Support 24h/24, 7j/7</li></ul></div>
<div class="vt-card vt-price"><h3>À la carte</h3><div class="vt-big">25 €<small> / compte</small></div><ul class="vt-ok"><li>Nouveau compte personnel et sécurisé</li><li>QR codes clé en main : 3,99 € par équipement, générés et posés par nos soins</li></ul></div>
</div>
</div></section>

<section class="vt-alt"><div class="vt-wrap">
<div class="vt-kicker">Un accompagnement de bout en bout</div>
<h2>Nous restons à vos côtés, longtemps après le premier scan.</h2>
<div class="vt-grid vt-g3" style="margin-top:26px">
<div class="vt-card"><h3>Mise en service sur site</h3><p>Cadrage, paramétrage, étiquettes, formation : tout est préparé pour vous, aux Antilles.</p></div>
<div class="vt-card"><h3>SAV rapide et humain</h3><p>Réponse dans la journée, par téléphone, e-mail ou depuis l'application.</p></div>
<div class="vt-card"><h3>Un outil qui progresse</h3><p>Nouveautés déployées automatiquement, vos idées intégrées, un point de suivi régulier.</p></div>
</div>
</div></section>

<section id="vt-contact"><div class="vt-wrap">
<div class="vt-card vt-formbox">
<div class="vt-kicker">Intéressé par cette solution ?</div>
<h2>Demandez votre démonstration.</h2>
<p class="vt-sub">Nous scannons un de vos équipements, chez vous, pour vous montrer concrètement. Réponse rapide.</p>
<form data-action="submit-vitrine-contact" id="vt-form">
<div class="vt-row"><label>Nom et prénom<input name="nom" required maxlength="120" autocomplete="name"></label><label>Établissement<input name="etablissement" required maxlength="120" autocomplete="organization"></label></div>
<div class="vt-row"><label>E-mail<input type="email" name="email" required maxlength="200" autocomplete="email"></label><label>Téléphone<input type="tel" name="telephone" maxlength="40" autocomplete="tel"></label></div>
<label>Votre secteur<select name="secteur"><option>Hôtellerie</option><option>Santé</option><option>BTP</option><option>Industrie</option><option>Flotte / location</option><option>Autre</option></select></label>
<label>Votre besoin<textarea name="message" rows="4" maxlength="2000" placeholder="Nombre approximatif d'équipements, contrôles à suivre…"></textarea></label>
<label class="vt-hp" aria-hidden="true">Site<input name="site" tabindex="-1" autocomplete="off"></label>
<label class="vt-chk"><input type="checkbox" name="rgpd" required> J'accepte que mes informations soient utilisées pour répondre à ma demande (RGPD).</label>
<div class="vt-err" id="vt-err"></div>
<button class="vt-btn vt-gold" type="submit" id="vt-envoi" style="font-size:17px;padding:16px">Envoyer ma demande</button>
</form>
<div class="vt-done" id="vt-done"><h2>Merci !</h2><p class="vt-sub" style="margin:0 auto" id="vt-done-txt">Votre demande est bien partie. Nous vous recontactons très vite.</p></div>
</div>
</div></section>

<footer><div class="vt-wrap"><b>WiDIAG MQ</b> · Habitation Gondeau, Le Lamentin — Martinique<br>${esc(SUPPORT_EMAIL)} · 06 96 20 93 19<br>SIRET 841 516 800 00031<br><br><i>Vos équipements ont une histoire. Gardez-en la trace.</i></div></footer>

<div class="vt-dock"><button type="button" class="vt-btn vt-gold" data-action="vitrine-connexion">Se connecter</button><button type="button" class="vt-btn vt-ghost" data-action="vitrine-scroll" data-cible="contact">Demander une démo</button></div>
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
message: String(fd.get('message') || '').trim(),
};
const btn = document.getElementById('vt-envoi'); if(btn) btn.disabled = true;
let texte = 'Votre demande est bien partie. Nous vous recontactons très vite.';
try{
const { error } = await sb.from('demandes_contact').insert(d);
if(error) throw error;
}catch(e){
// Base indisponible ou table pas encore créée : on n'abandonne pas le prospect.
const corps = `Nom : ${d.nom}\nÉtablissement : ${d.etablissement}\nE-mail : ${d.email}\nTéléphone : ${d.telephone}\nSecteur : ${d.secteur}\n\n${d.message}`;
window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Demande de démonstration WiTracEQUIP')}&body=${encodeURIComponent(corps)}`;
texte = 'Votre application de messagerie s’ouvre pour finaliser l’envoi. Merci !';
}
form.style.display = 'none';
const t = document.getElementById('vt-done-txt'); if(t) t.textContent = texte;
document.getElementById('vt-done')?.classList.add('on');
}
