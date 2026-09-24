// Remplacez avec vos clés Supabase
const SUPABASE_URL = 'https://VOTRE_PROJET.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_CLE_ANON_SUPABASE';

function chargerFormulaireRapport(conteneur) {
  conteneur.innerHTML = `
    <div class="card" style="max-w-3xl; margin: 20px auto; padding: 20px;">
      <h2 style="margin-bottom: 20px;">Rapport d'Intervention</h2>
      <form id="form-rapport" style="display: flex; flex-direction: column; gap: 15px;">
        <div style="display: flex; gap: 10px;">
          <input type="text" id="nomSupport" placeholder="Nom du Support" required style="flex:1; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
          <input type="date" id="dateIntervention" required style="flex:1; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
        </div>
        <div style="display: flex; gap: 10px;">
          <input type="text" id="nomClient" placeholder="Nom du Client" required style="flex:1; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
          <input type="email" id="emailClient" placeholder="Email du Client" required style="flex:1; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
        </div>
        <textarea id="raisonIntervention" placeholder="Raison de l'intervention..." rows="3" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;"></textarea>
        
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <label><strong>Signature du client</strong></label>
            <button type="button" id="btn-effacer-sig" style="color: red; background: none; border: none; cursor: pointer;">Effacer</button>
          </div>
          <canvas id="canvas-sig" width="600" height="150" style="border: 1px dashed #ccc; background: #fafafa; width: 100%; touch-action: none; cursor: crosshair;"></canvas>
        </div>

        <div>
          <label><strong>Photo (optionnel)</strong></label>
          <input type="file" id="photoIntervention" accept="image/*" style="display: block; margin-top: 5px;">
        </div>

        <button type="submit" id="btn-soumettre" class="btn btn-primary" style="padding: 12px; font-weight: bold;">Valider et enregistrer</button>
      </form>
    </div>
  `;

  // Gestion de la signature Canvas
  const canvas = document.getElementById('canvas-sig');
  const ctx = canvas.getContext('2d');
  let estEnDessin = false;

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000000';

  function obtnCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  canvas.addEventListener('mousedown', (e) => { estEnDessin = true; const p = obtnCoords(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
  canvas.addEventListener('mousemove', (e) => { if (!estEnDessin) return; e.preventDefault(); const p = obtnCoords(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  canvas.addEventListener('mouseup', () => estEnDessin = false);
  canvas.addEventListener('touchstart', (e) => { estEnDessin = true; const p = obtnCoords(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
  canvas.addEventListener('touchmove', (e) => { if (!estEnDessin) return; e.preventDefault(); const p = obtnCoords(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  canvas.addEventListener('touchend', () => estEnDessin = false);

  document.getElementById('btn-effacer-sig').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // Soumission du formulaire
  document.getElementById('form-rapport').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-soumettre');
    btn.disabled = true;
    btn.textContent = 'Enregistrement...';

    try {
      const signatureBase64 = canvas.toDataURL('image/png');
      const photoInput = document.getElementById('photoIntervention');
      let photoUrl = null;

      // Upload de la photo sur Supabase Storage s'il y en a une
      if (photoInput.files.length > 0) {
        const file = photoInput.files[0];
        const fileName = `${Date.now()}.${file.name.split('.').pop()}`;
        const resPhoto = await fetch(`${SUPABASE_URL}/storage/v1/object/interventions-photos/${fileName}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': file.type
          },
          body: file
        });
        if (resPhoto.ok) {
          photoUrl = `${SUPABASE_URL}/storage/v1/object/public/interventions-photos/${fileName}`;
        }
      }

      // Insertion dans la base de données Supabase
      const resDb = await fetch(`${SUPABASE_URL}/rest/v1/rapports_intervention`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          nom_support: document.getElementById('nomSupport').value,
          date_intervention: document.getElementById('dateIntervention').value,
          nom_client: document.getElementById('nomClient').value,
          email_client: document.getElementById('emailClient').value,
          raison_intervention: document.getElementById('raisonIntervention').value,
          signature_base64: signatureBase64,
          photo_url: photoUrl
        })
      });

      if (!resDb.ok) throw new Error("Erreur lors de la sauvegarde dans la base.");

      if (typeof toast === 'function') {
        toast('Rapport d\'intervention enregistré !', 'ok');
      } else {
        alert('Rapport enregistré avec succès !');
      }

      chargerFormulaireRapport(conteneur); // Réinitialiser le formulaire
    } catch (err) {
      console.error(err);
      if (typeof toast === 'function') toast('Erreur : ' + err.message, 'erreur');
      else alert('Erreur : ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Valider et enregistrer';
    }
  });
}
