/* Annuaire Téléphonique – version robuste
   - Garde-fous pour éviter qu'une erreur casse toute l'app
   - Délégation des événements pour fiabilité
   - Import/Export/Images en async/await avec try/catch
*/

(() => {
  const log = (...a) => console.log('[Annuaire]', ...a);
  const err = (...a) => console.error('[Annuaire]', ...a);
  const uid = () => 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  // Sélecteurs sécurisés
  const $ = (id) => {
    const el = document.getElementById(id);
    if (!el) err(`Élément #${id} introuvable`);
    return el;
  };

  // Éléments
  let E = {};
  function cacheElements() {
    E = {
      contactsList: $('contactsList'),
      contactsCount: $('contactsCount'),
      searchInput: $('searchInput'),
      btnAdd: $('btnAdd'),
      btnExport: $('btnExport'),
      importFile: $('importFile'),
      modal: $('modal'),
      modalClose: $('modalClose'),
      contactForm: $('contactForm'),
      contactId: $('contactId'),
      lastName: $('lastName'),
      firstName: $('firstName'),
      phone: $('phone'),
      email: $('email'),
      address: $('address'),
      photoInput: $('photoInput'),
      photoPreview: $('photoPreview'),
      clearPhoto: $('clearPhoto'),
      cancelBtn: $('cancelBtn'),
      contactCardTemplate: $('contactCardTemplate'),
      modalTitle: $('modalTitle'),
    };
  }

  // State
  let contacts = [];
  const STORAGE_KEY = 'contacts_v1';

  // Utils
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Erreur lecture image'));
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
  const readFileAsText = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Erreur lecture fichier'));
    r.onload = () => resolve(r.result);
    r.readAsText(file, 'utf-8');
  });

  const initialsDataURL = (firstName, lastName) => {
    const name = `${firstName || ''} ${lastName || ''}`.trim();
    const initials = name ? name.split(' ').filter(Boolean).slice(0,2).map(n => n[0].toUpperCase()).join('') : '?';
    const c = document.createElement('canvas');
    c.width = 200; c.height = 200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ecf0f1'; ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials, c.width/2, c.height/2);
    return c.toDataURL('image/png');
  };

  // Storage
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      contacts = raw ? JSON.parse(raw) : [];
    } catch (e) {
      err('Lecture storage', e);
      contacts = [];
    }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
    } catch (e) {
      err('Écriture storage', e);
    }
  }

  // Rendu
  function render(filter = '') {
    if (!E.contactsList) return;
    const q = (filter || '').trim().toLowerCase();
    E.contactsList.innerHTML = '';

    const list = contacts.filter(c => {
      if (!q) return true;
      return (
        (c.firstName || '').toLowerCase().includes(q) ||
        (c.lastName || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
      );
    });

    if (E.contactsCount) {
      E.contactsCount.textContent = `${contacts.length} contact(s) — affichés: ${list.length}`;
    }

    if (list.length === 0) {
      E.contactsList.innerHTML = `<div class="card" style="grid-column:1/-1"><p style="margin:0;color:var(--muted)">Aucun contact trouvé. Ajoutez-en avec «Ajouter».</p></div>`;
      return;
    }

    const tpl = E.contactCardTemplate?.content;
    if (!tpl) return;

    list.forEach(c => {
      const node = tpl.cloneNode(true);
      const root = node.querySelector('.contact-card');
      root.dataset.id = c.id;

      const avatar = node.querySelector('.avatar');
      avatar.src = c.photo || initialsDataURL(c.firstName, c.lastName);
      avatar.alt = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Photo';

      node.querySelector('.contact-name').textContent = `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—';
      node.querySelector('.contact-phone').textContent = c.phone || '';
      node.querySelector('.contact-email').textContent = c.email || '';
      node.querySelector('.contact-address').textContent = c.address || '';

      E.contactsList.appendChild(node);
    });
  }

  // CRUD
  function addContact(data) {
    const contact = { id: uid(), createdAt: new Date().toISOString(), photo: null, ...data };
    contacts.unshift(contact);
    save(); render(E.searchInput?.value);
  }
  function updateContact(id, data) {
    const i = contacts.findIndex(c => c.id === id);
    if (i === -1) return;
    contacts[i] = { ...contacts[i], ...data, updatedAt: new Date().toISOString() };
    save(); render(E.searchInput?.value);
  }
  function removeContact(id) {
    contacts = contacts.filter(c => c.id !== id);
    save(); render(E.searchInput?.value);
  }

  // Modal helpers
  function openModal(title = 'Ajouter un contact') {
    if (!E.modal) return;
    E.modalTitle.textContent = title;
    E.modal.setAttribute('aria-hidden', 'false');
    E.modal.style.display = 'flex';
  }
  function closeModal() {
    if (!E.modal) return;
    E.modal.setAttribute('aria-hidden', 'true');
    E.modal.style.display = 'none';
    resetForm();
  }
  function fillForm(c) {
    E.contactId.value = c.id;
    E.firstName.value = c.firstName || '';
    E.lastName.value  = c.lastName || '';
    E.phone.value     = c.phone || '';
    E.email.value     = c.email || '';
    E.address.value   = c.address || '';
    if (c.photo) {
      E.photoPreview.src = c.photo;
      E.photoPreview.hidden = false;
      E.clearPhoto.hidden = false;
    } else {
      clearPhotoPreview();
    }
  }
  function resetForm() {
    E.contactForm.reset();
    E.contactId.value = '';
    clearPhotoPreview();
  }
  function clearPhotoPreview() {
    E.photoPreview.src = '';
    E.photoPreview.hidden = true;
    E.clearPhoto.hidden = true;
    E.photoInput.value = '';
  }

  // Import/Export
  async function exportContacts() {
    try {
      await sleep(50);
      const data = JSON.stringify(contacts, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      a.href = url; a.download = `contacts-${date}.json`;
      document.body.appendChild(a);
      a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      err(e); alert('Impossible d’exporter les contacts.');
    }
  }

  async function importContacts(file, replace = true) {
    try {
      const text = await readFileAsText(file);
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error('JSON invalide (tableau attendu).');

      if (replace) {
        contacts = arr.map(x => ({
          id: x.id || uid(),
          firstName: x.firstName || '',
          lastName:  x.lastName  || '',
          phone:     x.phone     || '',
          email:     x.email     || '',
          address:   x.address   || '',
          photo:     x.photo     || null,
        }));
      } else {
        const seen = new Set(contacts.map(c => c.id));
        arr.forEach(x => {
          const c = {
            id: x.id && !seen.has(x.id) ? x.id : uid(),
            firstName: x.firstName || '',
            lastName:  x.lastName  || '',
            phone:     x.phone     || '',
            email:     x.email     || '',
            address:   x.address   || '',
            photo:     x.photo     || null,
          };
          contacts.push(c);
        });
      }
      save(); render(E.searchInput?.value);
      alert(`Import réussi : ${arr.length} contact(s)`);
    } catch (e) {
      err(e); alert('Erreur lors de l’import (format ou lecture).');
    }
  }

  // Événements (version robuste)
  function bindEvents() {
    if (!E.contactsList) return;

    // Recherche
    E.searchInput?.addEventListener('input', e => render(e.target.value));

    // Boutons header
    E.btnAdd?.addEventListener('click', () => {
      resetForm(); openModal('Ajouter un contact');
    });
    E.btnExport?.addEventListener('click', () => exportContacts());
    E.importFile?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const replace = confirm('OK = Remplacer totalement. Annuler = Fusionner.');
      await importContacts(file, replace);
      e.target.value = '';
    });

    // Modal
    E.modalClose?.addEventListener('click', () => closeModal());
    E.cancelBtn?.addEventListener('click', () => closeModal());
    E.modal?.addEventListener('click', (e) => {
      if (e.target === E.modal) closeModal();
    });

    // Form
    E.photoInput?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return clearPhotoPreview();
      try {
        const dataURL = await readFileAsDataURL(f);
        E.photoPreview.src = dataURL;
        E.photoPreview.hidden = false;
        E.clearPhoto.hidden = false;
      } catch (e2) {
        err(e2); alert('Impossible de charger l’image.');
      }
    });
    E.clearPhoto?.addEventListener('click', () => clearPhotoPreview());

    E.contactForm?.addEventListener('submit', async (e) => {
      e.preventDefault();

      // validation minimale
      if (!E.firstName.value.trim() && !E.lastName.value.trim() && !E.phone.value.trim()) {
        alert('Au moins un nom/prénom ou un téléphone.');
        return;
      }

      const id = E.contactId.value || null;
      const data = {
        firstName: E.firstName.value.trim(),
        lastName:  E.lastName.value.trim(),
        phone:     E.phone.value.trim(),
        email:     E.email.value.trim(),
        address:   E.address.value.trim(),
      };

      // si une nouvelle image a été choisie, on lit le fichier
      const file = E.photoInput.files?.[0];
      if (file) {
        try { data.photo = await readFileAsDataURL(file); }
        catch(e2){ err(e2); alert('Image invalide'); return; }
      } else if (!E.photoPreview.hidden && E.photoPreview.src) {
        data.photo = E.photoPreview.src; // garder l’existante
      } else {
        data.photo = null;
      }

      if (id) updateContact(id, data);
      else addContact(data);

      closeModal();
    });

    // Délégation d’événements sur la liste (Modifier / Supprimer / Ouvrir)
    E.contactsList.addEventListener('click', (e) => {
      const btnEdit = e.target.closest('.btn-edit');
      const btnDelete = e.target.closest('.btn-delete');
      const card = e.target.closest('.contact-card');
      if (!card) return;

      const id = card.dataset.id;
      const c = contacts.find(x => x.id === id);
      if (!c) return;

      if (btnEdit) {
        fillForm(c); openModal('Modifier le contact');
        return;
      }
      if (btnDelete) {
        const label = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.phone || 'ce contact';
        if (confirm(`Supprimer définitivement ${label} ?`)) {
          removeContact(id);
        }
        return;
      }
      // clic sur la carte = éditer
      if (e.currentTarget && !btnEdit && !btnDelete) {
        fillForm(c); openModal('Modifier le contact');
      }
    });
  }

  // Bootstrap
  async function init() {
    try {
      cacheElements();
      load();

      // Seed si vide (démo)
      if (contacts.length === 0) {
        contacts = [
          { id: uid(), firstName: 'Amina', lastName: 'N’Dongo', phone: '+237 6 77 11 22 33', email: 'amina@example.com', address: 'Douala, Cameroun', photo: null },
          { id: uid(), firstName: 'Jean',  lastName: 'Mbella',  phone: '+237 6 99 44 55 66', email: 'jean@example.com',  address: 'Yaoundé, Cameroun', photo: null },
        ];
        save();
      }

      bindEvents();
      render();
      log('Application initialisée ✅');
    } catch (e) {
      err('Échec init', e);
      alert('Une erreur a empêché l’interface d’être interactive. Ouvre la console (F12) pour les détails.');
    }
  }

  // Lance init quand le DOM est prêt (et au cas où, tente immédiatement si déjà prêt)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();