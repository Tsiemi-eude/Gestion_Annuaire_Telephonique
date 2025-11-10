/* script.js
   Annuaire Téléphonique - JavaScript pur
   - Stockage localStorage
   - Import / Export JSON (async/await)
   - Upload image via FileReader (base64)
   - Ajout / Édition / Suppression / Recherche
*/

/* Utilitaires */
const uid = () => 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

/* Encapsulation de la logique dans une classe */
class ContactManager {
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'contacts_v1';
    this.contacts = [];
    this.elements = this._cacheElements();
    this._bindEvents();
    this.loadFromStorage();
    this.render();
  }

  _cacheElements() {
    return {
      contactsList: document.getElementById('contactsList'),
      contactsCount: document.getElementById('contactsCount'),
      searchInput: document.getElementById('searchInput'),
      btnAdd: document.getElementById('btnAdd'),
      btnExport: document.getElementById('btnExport'),
      importFile: document.getElementById('importFile'),
      modal: document.getElementById('modal'),
      modalClose: document.getElementById('modalClose'),
      contactForm: document.getElementById('contactForm'),
      contactId: document.getElementById('contactId'),
      lastName: document.getElementById('lastName'),
      firstName: document.getElementById('firstName'),
      phone: document.getElementById('phone'),
      email: document.getElementById('email'),
      address: document.getElementById('address'),
      photoInput: document.getElementById('photoInput'),
      photoPreview: document.getElementById('photoPreview'),
      clearPhoto: document.getElementById('clearPhoto'),
      cancelBtn: document.getElementById('cancelBtn'),
      contactCardTemplate: document.getElementById('contactCardTemplate'),
      modalTitle: document.getElementById('modalTitle'),
    };
  }

  _bindEvents() {
    const el = this.elements;
    el.btnAdd.addEventListener('click', () => this.openModalForCreate());
    el.modalClose.addEventListener('click', () => this.closeModal());
    el.cancelBtn.addEventListener('click', () => this.closeModal());
    el.contactForm.addEventListener('submit', (e) => this._onFormSubmit(e));
    el.searchInput.addEventListener('input', (e) => this.render(e.target.value));
    el.photoInput.addEventListener('change', (e) => this._onPhotoSelected(e));
    el.clearPhoto.addEventListener('click', () => this._clearPhotoPreview());
    el.btnExport.addEventListener('click', () => this.exportContacts());
    el.importFile.addEventListener('change', (e) => this.importContactsFromInput(e));
    // close modal on outside click
    el.modal.addEventListener('click', (e) => {
      if (e.target === el.modal) this.closeModal();
    });
  }

  /* STORAGE */
  loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      this.contacts = raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Erreur lecture storage', err);
      this.contacts = [];
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.contacts));
    } catch (err) {
      console.error('Erreur écriture storage', err);
    }
  }

  /* RENDER */
  render(filter = '') {
    const container = this.elements.contactsList;
    container.innerHTML = '';
    const q = (filter || '').trim().toLowerCase();

    const list = this.contacts.filter(c => {
      if (!q) return true;
      return (
        (c.firstName && c.firstName.toLowerCase().includes(q)) ||
        (c.lastName && c.lastName.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    });

    // Update count
    this.elements.contactsCount.textContent = `${this.contacts.length} contact(s) — affichés: ${list.length}`;

    if (list.length === 0) {
      container.innerHTML = `<div class="card" style="grid-column:1/-1"><p style="margin:0;color:var(--muted)">Aucun contact trouvé. Ajoutez-en avec le bouton «Ajouter».</p></div>`;
      return;
    }

    const template = this.elements.contactCardTemplate.content;
    list.forEach(contact => {
      const node = template.cloneNode(true);
      const card = node.querySelector('.contact-card');
      card.dataset.id = contact.id;

      const avatar = node.querySelector('.avatar');
      avatar.src = contact.photo || this._generateInitialsDataURL(contact);
      avatar.alt = `${contact.firstName || ''} ${contact.lastName || ''}`;

      node.querySelector('.contact-name').textContent = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '—';
      node.querySelector('.contact-phone').textContent = contact.phone || '';
      node.querySelector('.contact-email').textContent = contact.email || '';
      node.querySelector('.contact-address').textContent = contact.address || '';

      // Edit button
      node.querySelector('.btn-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openModalForEdit(contact.id);
      });

      // Delete button with confirmation
      node.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteContactWithConfirm(contact.id);
      });

      // Click on card opens edit
      card.addEventListener('click', () => this.openModalForEdit(contact.id));

      container.appendChild(node);
    });
  }

  /* Helper: create initials image (dataURL) for placeholder avatar */
  _generateInitialsDataURL(contact) {
    const name = (contact.firstName || '') + ' ' + (contact.lastName || '');
    const initials = name.split(' ').filter(Boolean).slice(0,2).map(n => n[0].toUpperCase()).join('') || '?';

    // Create a small canvas and draw initials
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ecf0f1';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#2C3E50';
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, canvas.width/2, canvas.height/2);
    return canvas.toDataURL('image/png');
  }

  /* MODAL / FORM */
  openModalForCreate() {
    this._resetForm();
    this.elements.modalTitle.textContent = 'Ajouter un contact';
    this.elements.modal.setAttribute('aria-hidden', 'false');
    this.elements.modal.style.display = 'flex';
  }

  openModalForEdit(contactId) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (!contact) return alert("Contact introuvable");
    this._fillForm(contact);
    this.elements.modalTitle.textContent = 'Modifier le contact';
    this.elements.modal.setAttribute('aria-hidden', 'false');
    this.elements.modal.style.display = 'flex';
  }

  closeModal() {
    this.elements.modal.setAttribute('aria-hidden', 'true');
    this._resetForm();
    this.elements.modal.style.display = 'none';
  }

  _resetForm() {
    this.elements.contactForm.reset();
    this.elements.contactId.value = '';
    this._clearPhotoPreview();
  }

  _fillForm(contact) {
    this.elements.contactId.value = contact.id;
    this.elements.firstName.value = contact.firstName || '';
    this.elements.lastName.value = contact.lastName || '';
    this.elements.phone.value = contact.phone || '';
    this.elements.email.value = contact.email || '';
    this.elements.address.value = contact.address || '';
    if (contact.photo) {
      this.elements.photoPreview.src = contact.photo;
      this.elements.photoPreview.hidden = false;
      this.elements.clearPhoto.hidden = false;
    } else {
      this._clearPhotoPreview();
    }
  }

  async _onFormSubmit(e) {
    e.preventDefault();
    // Gather form data
    const id = this.elements.contactId.value;
    const data = {
      firstName: this.elements.firstName.value.trim(),
      lastName: this.elements.lastName.value.trim(),
      phone: this.elements.phone.value.trim(),
      email: this.elements.email.value.trim(),
      address: this.elements.address.value.trim(),
    };

    // If user selected a file via file input, read it (async)
    const fileInput = this.elements.photoInput;
    if (fileInput.files && fileInput.files[0]) {
      try {
        data.photo = await this._readFileAsDataURL(fileInput.files[0]);
      } catch (err) {
        console.error('Erreur lecture image', err);
        alert('Impossible de lire l\'image');
      }
    } else {
      // If preview exists (from editing existing), use it; otherwise null
      if (this.elements.photoPreview && !this.elements.photoPreview.hidden) {
        data.photo = this.elements.photoPreview.src;
      } else {
        data.photo = null;
      }
    }

    if (id) {
      // Edit existing
      this.updateContact(id, data);
    } else {
      // Create new
      this.addContact(data);
    }

    this.closeModal();
    this.render(this.elements.searchInput.value);
  }

  addContact(data) {
    const contact = Object.assign({ id: uid(), createdAt: new Date().toISOString() }, data);
    this.contacts.unshift(contact); // push to top
    this.saveToStorage();
    this.render(this.elements.searchInput.value);
  }

  updateContact(id, data) {
    const idx = this.contacts.findIndex(c => c.id === id);
    if (idx === -1) return;
    this.contacts[idx] = Object.assign({}, this.contacts[idx], data, { updatedAt: new Date().toISOString() });
    this.saveToStorage();
    this.render(this.elements.searchInput.value);
  }

  deleteContactWithConfirm(id) {
    const c = this.contacts.find(c => c.id === id);
    if (!c) return;
    const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.phone || 'ce contact';
    if (confirm(`Supprimer définitivement ${name} ?`)) {
      this.contacts = this.contacts.filter(x => x.id !== id);
      this.saveToStorage();
      this.render(this.elements.searchInput.value);
    }
  }

  /* File reading helpers - use async/await */
  _readFileAsDataURL(file) {
    // Wrap FileReader into Promise so we can await it
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => {
        reader.abort();
        reject(new Error('Erreur lecture fichier'));
      };
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  _onPhotoSelected(e) {
    const file = e.target.files[0];
    if (!file) return this._clearPhotoPreview();
    // Read and display preview asynchronously
    this._readFileAsDataURL(file).then(dataURL => {
      this.elements.photoPreview.src = dataURL;
      this.elements.photoPreview.hidden = false;
      this.elements.clearPhoto.hidden = false;
    }).catch(err => {
      console.error(err);
      alert('Impossible de charger l\'image');
    });
  }

  _clearPhotoPreview() {
    this.elements.photoPreview.src = '';
    this.elements.photoPreview.hidden = true;
    this.elements.clearPhoto.hidden = true;
    this.elements.photoInput.value = '';
  }

  /* IMPORT / EXPORT */
  async exportContacts() {
    try {
      // Simulate async operation
      await new Promise(r => setTimeout(r, 100));
      const data = JSON.stringify(this.contacts, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
      a.download = `contacts-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
      alert('Impossible d\'exporter les contacts');
    }
  }

  async importContactsFromInput(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!confirm('Importer ce fichier JSON remplacera ou fusionnera selon votre choix. OK = Remplacer, Annuler = Fusionner')) {
      // Merge with existing
      try {
        const text = await this._readFileAsText(file);
        const imported = JSON.parse(text);
        if (!Array.isArray(imported)) throw new Error('Format JSON invalide (doit être un tableau).');
        // merge: append those not already present (by id), create new id if missing
        const existingIds = new Set(this.contacts.map(c => c.id));
        imported.forEach(c => {
          if (!c.id || existingIds.has(c.id)) {
            c.id = uid();
          }
          this.contacts.push(c);
        });
        this.saveToStorage();
        this.render(this.elements.searchInput.value);
        alert(`Import fusion réussi : ${imported.length} contact(s) ajoutés.`);
      } catch (err) {
        console.error(err);
        alert('Erreur lors de l\'import (fusion)');
      } finally {
        event.target.value = ''; // clear file input
      }
      return;
    }

    // Replace existing
    try {
      const text = await this._readFileAsText(file);
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Format JSON invalide (doit être un tableau).');
      // Basic validation: each object should at least have a phone or name
      this.contacts = data.map(item => {
        return Object.assign({
          id: item.id || uid(),
          firstName: item.firstName || '',
          lastName: item.lastName || '',
          phone: item.phone || '',
          email: item.email || '',
          address: item.address || '',
          photo: item.photo || null,
        }, item);
      });
      this.saveToStorage();
      this.render(this.elements.searchInput.value);
      alert(`Import remplacé : ${this.contacts.length} contact(s) chargés.`);
    } catch (err) {
      console.error('Import failed', err);
      alert('Erreur lors de l\'import : format invalide.');
    } finally {
      event.target.value = ''; // reset input
    }
  }

  _readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => {
        reader.abort();
        reject(new Error('Erreur lecture fichier'));
      };
      reader.onload = () => resolve(reader.result);
      reader.readAsText(file, 'utf-8');
    });
  }
}

/* Instanciation et données de démonstration (si vide) */
document.addEventListener('DOMContentLoaded', () => {
  const manager = new ContactManager();

  // If empty, seed a couple of contacts for first-time demo
  if (manager.contacts.length === 0) {
    const demo = [
      {
        id: uid(),
        firstName: 'Amina',
        lastName: 'N’Dongo',
        phone: '+237 6 77 11 22 33',
        email: 'amina@example.com',
        address: 'Douala, Cameroun',
        photo: null
      },
      {
        id: uid(),
        firstName: 'Jean',
        lastName: 'Mbella',
        phone: '+237 6 99 44 55 66',
        email: 'jean@example.com',
        address: 'Yaoundé, Cameroun',
        photo: null
      }
    ];
    manager.contacts = demo;
    manager.saveToStorage();
    manager.render();
  }
});