// Replace with your Supabase keys
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

function loadInterventionReportForm(container) {
  container.innerHTML = `
    <div class="card" style="max-w-3xl; margin: 20px auto; padding: 20px;">
      <h2 style="margin-bottom: 20px;">Intervention Report</h2>
      <form id="report-form" style="display: flex; flex-direction: column; gap: 15px;">
        <div style="display: flex; gap: 10px;">
          <input type="text" id="supportName" placeholder="Support Name" required style="flex:1; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
          <input type="date" id="interventionDate" required style="flex:1; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
        </div>
        <div style="display: flex; gap: 10px;">
          <input type="text" id="clientName" placeholder="Client Name" required style="flex:1; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
          <input type="email" id="clientEmail" placeholder="Client Email" required style="flex:1; padding: 10px; border: 1px solid #ccc; border-radius: 6px;">
        </div>
        <textarea id="interventionReason" placeholder="Reason for intervention..." rows="3" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px;"></textarea>
        
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <label><strong>Client Signature</strong></label>
            <button type="button" id="btn-clear-sig" style="color: red; background: none; border: none; cursor: pointer;">Clear</button>
          </div>
          <canvas id="sig-canvas" width="600" height="150" style="border: 1px dashed #ccc; background: #fafafa; width: 100%; touch-action: none; cursor: crosshair;"></canvas>
        </div>

        <div>
          <label><strong>Photo (optional)</strong></label>
          <input type="file" id="interventionPhoto" accept="image/*" style="display: block; margin-top: 5px;">
        </div>

        <button type="submit" id="btn-submit" class="btn btn-primary" style="padding: 12px; font-weight: bold;">Submit and Save</button>
      </form>
    </div>
  `;

  // Canvas signature handling
  const canvas = document.getElementById('sig-canvas');
  const ctx = canvas.getContext('2d');
  let isDrawing = false;

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000000';

  function getCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  canvas.addEventListener('mousedown', (e) => { isDrawing = true; const p = getCoords(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
  canvas.addEventListener('mousemove', (e) => { if (!isDrawing) return; e.preventDefault(); const p = getCoords(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  canvas.addEventListener('mouseup', () => isDrawing = false);
  canvas.addEventListener('touchstart', (e) => { isDrawing = true; const p = getCoords(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); });
  canvas.addEventListener('touchmove', (e) => { if (!isDrawing) return; e.preventDefault(); const p = getCoords(e); ctx.lineTo(p.x, p.y); ctx.stroke(); });
  canvas.addEventListener('touchend', () => isDrawing = false);

  document.getElementById('btn-clear-sig').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // Form submission
  document.getElementById('report-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
      const signatureBase64 = canvas.toDataURL('image/png');
      const photoInput = document.getElementById('interventionPhoto');
      let photoUrl = null;

      // Upload photo to Supabase Storage if one exists
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

      // Insert into Supabase database
      const resDb = await fetch(`${SUPABASE_URL}/rest/v1/rapports_intervention`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          nom_support: document.getElementById('supportName').value,
          date_intervention: document.getElementById('interventionDate').value,
          nom_client: document.getElementById('clientName').value,
          email_client: document.getElementById('clientEmail').value,
          raison_intervention: document.getElementById('interventionReason').value,
          signature_base64: signatureBase64,
          photo_url: photoUrl
        })
      });

      if (!resDb.ok) throw new Error("Error saving to database.");

      if (typeof toast === 'function') {
        toast('Intervention report saved!', 'ok');
      } else {
        alert('Report saved successfully!');
      }

      loadInterventionReportForm(container); // Reset the form
    } catch (err) {
      console.error(err);
      if (typeof toast === 'function') toast('Error: ' + err.message, 'error');
      else alert('Error: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit and Save';
    }
  });
}
