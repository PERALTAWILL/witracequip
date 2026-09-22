/* =========================================================================
   WiTracEQUIP — QR code et impression d'étiquette
   -------------------------------------------------------------------------
   Le QR code est le point d'entrée physique du produit : on le colle sur
   l'appareil, on le scanne avec n'importe quel téléphone, la fiche s'ouvre.
   Aucune application à installer côté technicien — c'est une simple adresse
   web, ouverte par l'appareil photo.

   Il encode donc l'adresse publique de la fiche, telle que la calcule
   js/modules/routing.js à partir de APP_BASE_URL. Une étiquette est collée
   pour la durée de vie de l'appareil : l'adresse qu'elle porte ne doit
   jamais changer.
   ========================================================================= */

import { ETIQUETTE } from '../config.js';
import { esc } from '../core/dom.js';
import { lienEquipement } from './routing.js';

/** Vrai si la bibliothèque de génération est disponible. */
function qriousDisponible() {
  return typeof window.QRious !== 'undefined';
}

/**
 * Dessine le QR code d'une fiche dans le canevas de la page.
 *
 * À appeler après CHAQUE rendu de la fiche : le canevas est recréé vide à
 * chaque passage dans innerHTML, donc ouvrir un simple formulaire effacerait
 * le QR — et « Imprimer l'étiquette » sortirait une étiquette vierge.
 */
export function drawQr(id) {
  const canvas = document.getElementById('qr-canvas');
  if (!canvas || !qriousDisponible()) return;

  new window.QRious({
    element: canvas,
    value: lienEquipement(id),
    size: 200,
    background: 'white',
    foreground: '#141b1e',
    level: 'M',
  });
}

/**
 * Lance l'impression de l'étiquette d'un équipement.
 *
 * L'étiquette ne porte que le QR code et l'identifiant physique de
 * l'appareil (numéro de série ou immatriculation). Rien d'autre : elle est
 * destinée à une imprimante thermique d'étiquettes, où chaque millimètre
 * compte, et tout texte supplémentaire réduirait la taille du QR donc sa
 * lisibilité au scan.
 *
 * Le QR d'impression est régénéré à 800 pixels plutôt que réutilisé depuis
 * l'écran : une imprimante thermique tire à environ 203 points par pouce, et
 * le QR de 200 pixels affiché sortirait baveux, difficile à scanner sur un
 * appareil mal éclairé.
 */
export function printQr(equipement) {
  const printArea = document.getElementById('print-area');
  if (!equipement || !printArea) return;

  const url = lienEquipement(equipement.id);

  let source = null;
  if (qriousDisponible()) {
    const hd = document.createElement('canvas');
    new window.QRious({
      element: hd, value: url, size: 800,
      background: 'white', foreground: '#000000', level: 'M',
    });
    source = hd;
  } else {
    source = document.getElementById('qr-canvas'); // repli sur celui de l'écran
  }
  if (!source) return;

  const ident = String(equipement.serial_value || '').trim();
  const cote = ETIQUETTE.taille_qr_mm;

  printArea.innerHTML = `
    <img id="print-qr-img" alt="" style="width:${cote}mm;height:${cote}mm;">
    ${(ETIQUETTE.afficher_identifiant && ident) ? `<div class="etiquette-id">${esc(ident)}</div>` : ''}
  `;

  const img = document.getElementById('print-qr-img');
  // L'image est une donnée encodée : il faut attendre qu'elle soit décodée,
  // sinon l'impression part avant et l'étiquette sort vide.
  img.onload = () => window.print();
  img.onerror = () => window.print();
  img.src = source.toDataURL('image/png');
}
