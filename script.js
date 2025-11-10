async function importContacts(file, replace = true) {
  try {
    const text = await readFileAsText(file);

    // Empêche les prototypes malicieux (sécurité)
    const json = JSON.parse(text, (key, value) => {
      if (key === "__proto__") return undefined;
      return value;
    });

    if (!Array.isArray(json)) throw new Error("Format invalide : un tableau de contacts est attendu.");

    // Normalisation des contacts
    const imported = json.map((x) => {
      const safe = {
        id: typeof x.id === "string" ? x.id : uid(),
        firstName: x.firstName?.toString().trim() || "",
        lastName: x.lastName?.toString().trim() || "",
        phone: x.phone?.toString().trim() || "",
        email: x.email?.toString().trim() || "",
        address: x.address?.toString().trim() || "",
        photo: typeof x.photo === "string" && x.photo.startsWith("data:image")
          ? x.photo
          : null,
      };

      // Photo par défaut si absente
      if (!safe.photo) {
        safe.photo = initialsDataURL(safe.firstName, safe.lastName);
      }
      return safe;
    });

    if (replace) {
      contacts = imported;
    } else {
      const seen = new Set(contacts.map((c) => c.id));
      imported.forEach((x) => {
        if (!seen.has(x.id)) contacts.push(x);
      });
    }

    save();
    render(E.searchInput?.value);
    alert(`✅ Import réussi : ${imported.length} contact(s) traités.`);
  } catch (e) {
    console.error("Erreur import JSON:", e);
    alert("❌ Échec de l’import : vérifie le format du fichier JSON.");
  }
}
