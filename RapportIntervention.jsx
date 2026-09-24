import React, { useRef, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// ==========================================
// CONFIGURATION DE VOS CLÉS
// Remplacez ces valeurs par vos vraies clés
// ==========================================
const SUPABASE_URL = 'https://VOTRE_PROJET.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_CLE_ANON_SUPABASE';
const RESEND_API_KEY = 'VOTRE_CLE_API_RESEND';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function RapportIntervention({ currentUser, setTab }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState(null);
  
  const [formData, setFormData] = useState({
    nomSupport: currentUser?.full_name || '',
    date: new Date().toISOString().split('T')[0],
    raison: '',
    nomClient: '',
    emailClient: ''
  });

  // Initialisation du pinceau sur le canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
  }, []);

  // Gestion des coordonnées (Souris + Ecran Tactile)
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Vérifie si le client a signé
  const isCanvasEmpty = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pixelBuffer = new Uint32Array(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !pixelBuffer.some(color => color !== 0);
  };

  // Soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isCanvasEmpty()) {
      alert("Veuillez faire signer le client dans la zone prévue à cet effet.");
      return;
    }

    setLoading(true);

    try {
      // 1. Récupération de la signature en image Base64
      const signatureBase64 = canvasRef.current.toDataURL('image/png');

      // 2. Upload de la photo jointe si elle existe
      let photoUrl = null;
      if (photo) {
        const fileExt = photo.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('interventions-photos')
          .upload(fileName, photo);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('interventions-photos')
          .getPublicUrl(fileName);

        photoUrl = publicUrlData.publicUrl;
      }

      // 3. Enregistrement dans Supabase
      const { data: rapport, error: dbError } = await supabase
        .from('rapports_intervention')
        .insert([{
          nom_support: formData.nomSupport,
          date_intervention: formData.date,
          raison_intervention: formData.raison,
          nom_client: formData.nomClient,
          email_client: formData.emailClient,
          signature_base64: signatureBase64,
          photo_url: photoUrl
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      // 4. Envoi de l'e-mail de confirmation avec Resend
      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2>Rapport d'Intervention - WiTracEQUIP</h2>
          <p>Bonjour <strong>${formData.nomClient}</strong>,</p>
          <p>Voici le récapitulatif de l'intervention réalisée le <strong>${formData.date}</strong> par <strong>${formData.nomSupport}</strong>.</p>
          <p><strong>Raison de l'intervention :</strong></p>
          <blockquote style="background: #f8fafc; padding: 10px; border-left: 4px solid #3b82f6;">
            ${formData.raison}
          </blockquote>
          ${photoUrl ? `<p><strong>Photo jointe :</strong> <a href="${photoUrl}" target="_blank">Consulter la photo</a></p>` : ''}
          <p><strong>Signature du client :</strong></p>
          <img src="${signatureBase64}" alt="Signature" style="border: 1px solid #ccc; width: 250px;" />
          <hr style="margin-top: 20px;" />
          <p style="font-size: 12px; color: #64748b;">Ce document fait foi de confirmation de réalisation de l'intervention.</p>
        </div>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'WiTracEQUIP Support <onboarding@resend.dev>',
          to: [formData.emailClient],
          subject: `Rapport d'intervention du ${formData.date}`,
          html: emailHtml
        })
      });

      alert("Rapport enregistré et e-mail transmis au client avec succès !");

      // Réinitialisation du formulaire
      setFormData({
        nomSupport: currentUser?.full_name || '',
        date: new Date().toISOString().split('T')[0],
        raison: '',
        nomClient: '',
        emailClient: ''
      });
      setPhoto(null);
      clearCanvas();

    } catch (err) {
      console.error(err);
      alert("Une erreur s'est produite lors de la soumission du rapport.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-8 p-6 bg-white rounded-xl shadow-lg border border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Rapport d'Intervention</h2>
        {setTab && (
          <button 
            type="button"
            onClick={() => setTab('demandes-clients')}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Retour
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nom du Support</label>
            <input 
              type="text" 
              required
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.nomSupport}
              onChange={(e) => setFormData({...formData, nomSupport: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Date d'intervention</label>
            <input 
              type="date" 
              required
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Nom du Client</label>
            <input 
              type="text" 
              required
              placeholder="Ex: Jean Dupont"
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.nomClient}
              onChange={(e) => setFormData({...formData, nomClient: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email du Client</label>
            <input 
              type="email" 
              required
              placeholder="jean.dupont@email.com"
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={formData.emailClient}
              onChange={(e) => setFormData({...formData, emailClient: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Raison de l'intervention</label>
          <textarea 
            rows="3"
            required
            placeholder="Description détaillée de l'intervention..."
            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.raison}
            onChange={(e) => setFormData({...formData, raison: e.target.value})}
          />
        </div>

        {/* Zone de Signature Tactile / Souris */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-semibold text-slate-700">Signature du Client</label>
            <button 
              type="button" 
              onClick={clearCanvas}
              className="text-xs font-medium text-red-500 hover:text-red-700"
            >
              Effacer la signature
            </button>
          </div>
          <div className="border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 touch-none overflow-hidden">
            <canvas 
              ref={canvasRef}
              width={650}
              height={160}
              className="w-full h-40 cursor-crosshair"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
        </div>

        {/* Import Photo */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Joindre une photo d'intervention (optionnel)</label>
          <input 
            type="file" 
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files[0])}
            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50"
        >
          {loading ? "Enregistrement et envoi de l'e-mail..." : "Valider et envoyer le rapport"}
        </button>
      </form>
    </div>
  );
}
