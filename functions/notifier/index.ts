// WiTracEQUIP — fonction « notifier » (v10)
// Envoie par Brevo l'alerte e-mail correspondant à une ligne qui vient d'être créée :
//   - demandes_support   → e-mail au support (comportement inchangé)
//   - demandes_contact   → e-mail au support + accusé de réception au visiteur (inchangé)
//   - signalements_panne → e-mail aux responsables / administrateurs actifs de l'organisation
//                          (+ l'adresse e-mail de l'organisation si elle est renseignée ;
//                          à défaut de destinataire, l'alerte part au support)
// Déclenchée par les triggers de la base (pg_net). Idempotente grâce à « notifie_le ».
// v10 : mode {"rappels":true} — e-mail aux responsables des échéances (révision, contrôle…) des 30 prochains jours,
//       lancé chaque jour par pg_cron ; chaque rappel n'est envoyé qu'une fois (table rappels_envoyes).
// v9 : l'appel doit porter l'en-tête x-notifier-secret (secret stocké dans reglages_plateforme).

const K = Deno.env.get("WitracEquip");
const U = Deno.env.get("SUPABASE_URL");
const S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const SUPPORT = "contact-support@witracequip.fr";
const APP = "https://witracequip.fr/";

const esc = (t: unknown) =>
  String(t ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]);

const H = { apikey: S!, Authorization: "Bearer " + S, "Content-Type": "application/json" };

async function rest(path: string) {
  const r = await fetch(U + "/rest/v1/" + path, { headers: H });
  return r.json();
}

async function brevo(payload: unknown) {
  return fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": K!, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const validMail = (m: unknown) => typeof m === "string" && /^[^@\s]+@[^@\s]+\.\w+$/.test(m);

// Comparaison en temps constant (évite de révéler le secret par le temps de réponse).
function egal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Refuse tout appel sans le bon secret. Si le secret est introuvable : on refuse aussi.
async function appelAutorise(req: Request): Promise<boolean> {
  const recu = req.headers.get("x-notifier-secret") ?? "";
  if (!recu) return false;
  const lignes = await rest("reglages_plateforme?cle=eq.notifier_secret&select=valeur");
  const attendu = Array.isArray(lignes) ? String(lignes[0]?.valeur ?? "") : "";
  if (!attendu) return false;
  return egal(recu, attendu);
}

// Destinataires d'une alerte de panne : responsables + administrateurs actifs de l'organisation,
// puis l'adresse e-mail de l'organisation. Doublons retirés.
async function destinatairesPanne(orgId: string): Promise<string[]> {
  const mails = new Set<string>();
  const profils = await rest(
    "profiles?organization_id=eq." + orgId +
      "&active=eq.true&role=in.(admin,responsable)&select=id",
  );
  if (Array.isArray(profils)) {
    for (const p of profils) {
      try {
        const r = await fetch(U + "/auth/v1/admin/users/" + p.id, { headers: H });
        const u = await r.json();
        if (validMail(u?.email)) mails.add(String(u.email).toLowerCase());
      } catch (_e) { /* on passe au suivant */ }
    }
  }
  const org = await rest("organizations?id=eq." + orgId + "&select=email");
  if (Array.isArray(org) && validMail(org[0]?.email)) mails.add(String(org[0].email).toLowerCase());
  return [...mails];
}

async function alertePanne(d: any) {
  const eq = (await rest("equipements?id=eq." + d.equipement_id + "&select=id,nom,serial_value"))[0] || {};
  const org = (await rest("organizations?id=eq." + d.organization_id + "&select=nom,code_client"))[0] || {};
  let to = await destinatairesPanne(d.organization_id);
  const sansDestinataire = to.length === 0;
  if (sansDestinataire) to = [SUPPORT];

  const heure = new Date(d.created_at).toLocaleString("fr-FR", {
    timeZone: "America/Martinique",
    dateStyle: "short",
    timeStyle: "short",
  });
  const lignes: string[][] = [
    ["Equipement", eq.nom + (eq.serial_value ? " (" + eq.serial_value + ")" : "")],
    ["Etablissement", org.nom],
    ["Signale par", d.auteur],
    ["Heure (Martinique)", heure],
  ];
  const html =
    "<h2>Panne signalee</h2>" +
    (sansDestinataire
      ? "<p><b>Aucun responsable n'a d'adresse e-mail pour cet etablissement : alerte envoyee au support.</b></p>"
      : "") +
    "<table cellpadding='4'>" +
    lignes.map(([a, b]) => "<tr><td><b>" + a + "</b></td><td>" + esc(b) + "</td></tr>").join("") +
    "</table><p style='white-space:pre-wrap'>" + esc(d.description) + "</p>" +
    (d.photo ? "<p><b>Photo jointe.</b></p>" : "") +
    "<p><a href='" + APP + "#/equip/" + esc(d.equipement_id) + "'>Ouvrir la fiche dans WiTracEQUIP</a></p>";

  return brevo({
    sender: { name: "WiTracEQUIP", email: SUPPORT },
    to: to.map((email) => ({ email })),
    replyTo: { email: SUPPORT },
    subject: "[Panne] " + (eq.nom || "Equipement") + (org.nom ? " - " + org.nom : ""),
    htmlContent: html,
    attachment: photoJointe(d.photo),
  });
}


// Rappels d'échéance : un e-mail par organisation, 30 jours avant chaque date butoir.
async function rpc(fn: string, args: unknown) {
  const r = await fetch(U + "/rest/v1/rpc/" + fn, { method: "POST", headers: H, body: JSON.stringify(args ?? {}) });
  return r.ok ? r.json().catch(() => null) : null;
}

async function envoyerRappels(): Promise<string> {
  const lignes = await rpc("echeances_a_rappeler", {});
  if (!Array.isArray(lignes) || !lignes.length) return "aucun rappel";
  const parOrg = new Map<string, any[]>();
  for (const l of lignes) {
    if (!parOrg.has(l.organization_id)) parOrg.set(l.organization_id, []);
    parOrg.get(l.organization_id)!.push(l);
  }
  let envoyes = 0;
  for (const [orgId, items] of parOrg) {
    let to = await destinatairesPanne(orgId);
    const sansDestinataire = to.length === 0;
    if (sansDestinataire) to = [SUPPORT];
    const date = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { dateStyle: "long" });
    const html =
      "<h2>Echeances a venir</h2>" +
      (sansDestinataire
        ? "<p><b>Aucun responsable n'a d'adresse e-mail pour cet etablissement : rappel envoye au support.</b></p>"
        : "") +
      "<p>Les echeances suivantes arrivent dans moins de 30 jours (" + esc(items[0].organisation) + ") :</p>" +
      "<table cellpadding='6' border='0'>" +
      items.map((l) =>
        "<tr><td><b>" + esc(l.nom) + "</b></td><td>" + esc(l.label) + "</td><td>" + esc(date(l.echeance)) +
        "</td><td><a href='" + APP + "#/equip/" + esc(l.equipement_id) + "'>Ouvrir la fiche</a></td></tr>"
      ).join("") +
      "</table>";
    const b = await brevo({
      sender: { name: "WiTracEQUIP", email: SUPPORT },
      to: to.map((email) => ({ email })),
      replyTo: { email: SUPPORT },
      subject: "[Echeance] " + items.length + " echeance" + (items.length > 1 ? "s" : "") + " a venir - " + items[0].organisation,
      htmlContent: html,
    });
    if (!b.ok) continue; // on réessaiera demain : rien n'est noté comme envoyé
    for (const l of items) await rpc("noter_rappel_envoye", { p_equipement: l.equipement_id, p_echeance: l.echeance });
    envoyes++;
  }
  return "rappels: " + envoyes + "/" + parOrg.size;
}

// Photo facultative (data URL JPEG) -> pièce jointe Brevo.
function photoJointe(photo: unknown) {
  const m = typeof photo === "string" ? photo.match(/^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/) : null;
  return m ? [{ name: "photo-panne.jpg", content: m[1] }] : undefined;
}

Deno.serve(async (req) => {
  try {
    if (!(await appelAutorise(req))) return new Response("unauthorized", { status: 401 });

    const corps = await req.json();
    if (corps && corps.rappels === true) return new Response(await envoyerRappels());
    const { id } = corps;
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("bad", { status: 400 });

    let t = "demandes_support";
    let d: any = (await rest(t + "?id=eq." + id + "&select=*"))[0];
    if (!d) {
      t = "demandes_contact";
      d = (await rest(t + "?id=eq." + id + "&select=*"))[0];
    }
    if (!d) {
      t = "signalements_panne";
      d = (await rest(t + "?id=eq." + id + "&select=*"))[0];
    }
    if (!d || d.notifie_le) return new Response("skip");

    const panne = t === "signalements_panne";
    const sup = t === "demandes_support";

    let b: Response;
    if (panne) {
      b = await alertePanne(d);
    } else {
      const lignes: string[][] = sup
        ? [["Etablissement", d.organisation_nom], ["Code client", d.code_client], ["Auteur", d.auteur_nom],
           ["Email", d.auteur_email], ["Categorie", d.categorie], ["Sujet", d.sujet]]
        : [["Nom", d.nom], ["Etablissement", d.etablissement], ["Email", d.email],
           ["Telephone", d.telephone], ["Secteur", d.secteur]];
      const from = sup ? d.auteur_email : d.email;
      const fromName = sup ? d.auteur_nom : d.nom;
      const html = "<h2>" + (sup ? "Demande de support" : "Demande de contact") +
        "</h2><table cellpadding='4'>" +
        lignes.map(([a, c]) => "<tr><td><b>" + a + "</b></td><td>" + esc(c) + "</td></tr>").join("") +
        "</table><p style='white-space:pre-wrap'>" + esc(d.message) + "</p>";
      b = await brevo({
        sender: { name: "WiTracEQUIP", email: SUPPORT },
        to: [{ email: SUPPORT }],
        replyTo: from ? { email: from, name: fromName || undefined } : undefined,
        subject: (sup ? "[Support] " : "[Contact] ") + (d.sujet || d.etablissement || d.organisation_nom || "Nouvelle demande"),
        htmlContent: html,
      });
    }

    if (!b.ok) return new Response("brevo " + b.status + " " + (await b.text()).slice(0, 150), { status: 502 });

    await fetch(U + "/rest/v1/" + t + "?id=eq." + id, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({ notifie_le: new Date().toISOString() }),
    });

    // Accusé de réception au visiteur pour une demande de démonstration (comportement inchangé).
    if (!panne && !sup) {
      const from = d.email;
      if (from && validMail(from)) {
        const en = /anglais/.test(d.message || "");
        await brevo({
          sender: { name: "WiTracEQUIP", email: SUPPORT },
          to: [{ email: from }],
          replyTo: { email: SUPPORT },
          subject: en ? "We received your request - WiTracEQUIP" : "Nous avons bien reçu votre demande - WiTracEQUIP",
          htmlContent: en
            ? "<p>Hello,</p><p>Thank you for your interest in WiTracEQUIP. We have received your demo request and will get back to you very soon.</p><p>Best regards,<br>Willem Leplé<br>https://witracequip.fr</p>"
            : "<p>Bonjour,</p><p>Merci de votre intérêt pour WiTracEQUIP. Nous avons bien reçu votre demande de démonstration et nous vous recontactons très vite.</p><p>Cordialement,<br>Willem Leplé<br>https://witracequip.fr</p>",
        }).catch(() => {});
      }
    }
    return new Response("ok");
  } catch (_e) {
    return new Response("err", { status: 500 });
  }
});
