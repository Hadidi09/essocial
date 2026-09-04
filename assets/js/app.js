/* ES Doubs Studio Communication — app.js v2 — Direction artistique refondée */
(function () {
  "use strict";

  // ── DATA & STATE ────────────────────────────────────────────
  const data = window.ESD_APP_DATA;
  const STORAGE_KEY = "esd-studio-saved-designs";
  const BRAND_KEY = "esd-studio-brand";
  const DRAFT_KEY = "esd-studio-drafts";
  const LOGO_SRC = "assets/images/esd_logo.png";
  const ELLIPSIS = "\u2026";

  const canvas = document.getElementById("designCanvas");
  const ctx = canvas.getContext("2d");

  const imageCache = new Map();
  let selectedCategory = data.categories[0].id;
  let searchTerm = "";
  let renderFrame = 0;
  let renderVersion = 0;
  let selectedTemplateIndex = 0;
  let currentTemplateList = [];
  let hasUnsavedChanges = false;

  const state = {
    templateId: data.templates[0].id,
    formatId: data.templates[0].defaultFormat || data.formats[0].id,
    fields: {},
    imageSrc: data.templates[0].defaultImage || data.media[0].src,
    homeLogoSrc: "",
    awayLogoSrc: "",
    partnerLogos: [],
    iconId: data.templates[0].defaultIcon || data.icons[0].id,
    partnerLogoSize: 120,
    partnerLogoPosition: "bottom-left",
    partnerLogoStyle: "badge",
    brand: { ...data.brandDefaults },
  };

  const els = {
    templateSearch: document.getElementById("templateSearch"),
    categoryTabs: document.getElementById("categoryTabs"),
    templateGrid: document.getElementById("templateGrid"),
    templateCount: document.getElementById("templateCount"),
    currentCategory: document.getElementById("currentCategory"),
    currentTemplateName: document.getElementById("currentTemplateName"),
    formatSelect: document.getElementById("formatSelect"),
    formatMeta: document.getElementById("formatMeta"),
    autosaveState: document.getElementById("autosaveState"),
    fieldEditor: document.getElementById("fieldEditor"),
    dropZone: document.getElementById("dropZone"),
    imageUpload: document.getElementById("imageUpload"),
    homeLogoUpload: document.getElementById("homeLogoUpload"),
    awayLogoUpload: document.getElementById("awayLogoUpload"),
    partnerUpload:  document.getElementById("partnerUpload"),
    partnerBank:    document.getElementById("partnerBank"),
    partnerSize:    document.getElementById("partnerSize"),
    partnerPosition: document.getElementById("partnerPosition"),
    partnerStyle: document.getElementById("partnerStyle"),
    mediaBank: document.getElementById("mediaBank"),
    iconBank: document.getElementById("iconBank"),
    adminToggle: document.getElementById("adminToggle"),
    adminPanel: document.getElementById("adminPanel"),
    brandRed: document.getElementById("brandRed"),
    brandBlue: document.getElementById("brandBlue"),
    brandGold: document.getElementById("brandGold"),
    brandDark: document.getElementById("brandDark"),
    brandTitleFont: document.getElementById("brandTitleFont"),
    brandBodyFont: document.getElementById("brandBodyFont"),
    resetBrand: document.getElementById("resetBrand"),
    saveDesign: document.getElementById("saveDesign"),
    clearSaved: document.getElementById("clearSaved"),
    savedList: document.getElementById("savedList"),
    exportPng: document.getElementById("exportPng"),
    exportJpg: document.getElementById("exportJpg"),
    exportPdf: document.getElementById("exportPdf"),
    resetTemplate: document.getElementById("resetTemplate"),
    shortcutsToggle: document.getElementById("shortcutsToggle"),
    shortcutsOverlay: document.getElementById("shortcutsOverlay"),
    closeShortcuts: document.getElementById("closeShortcuts"),
  };

  function debounce(fn, ms) {
    let t = null;
    return function (...a) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), ms);
    };
  }

  function saveDraft() {
    try {
      const drafts = readJson(DRAFT_KEY, {});
      drafts[state.templateId] = {
        templateId: state.templateId,
        formatId: state.formatId,
        fields: { ...state.fields },
        imageSrc: state.imageSrc,
        homeLogoSrc: state.homeLogoSrc,
        awayLogoSrc: state.awayLogoSrc,
        partnerLogos: state.partnerLogos,
        iconId: state.iconId,
        brand: { ...state.brand },
        updatedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
      setStatusState("success", "Brouillon sauvegardé");
      hasUnsavedChanges = false;
      clearModified();
    } catch (e) {
      console.warn(e);
    }
  }
  const saveDraftDebounced = debounce(saveDraft, 700);

  // ── EVENTS ──────────────────────────────────────────────────
  function bindEvents() {
    els.templateSearch.addEventListener("input", (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      renderTemplateList();
    });
    els.formatSelect.addEventListener("change", (e) => {
      state.formatId = e.target.value;
      requestRender();
    });
    els.imageUpload.addEventListener("change", (e) =>
      handleUpload(e.target.files[0], "main"),
    );
    els.homeLogoUpload.addEventListener("change", (e) =>
      handleUpload(e.target.files[0], "homeLogo"),
    );
    els.awayLogoUpload.addEventListener("change", (e) =>
      handleUpload(e.target.files[0], "awayLogo"),
    );
    els.partnerUpload.addEventListener("change", (e) =>
      handleUpload(e.target.files, "partner"),
    );
    if (els.partnerSize) {
      els.partnerSize.addEventListener("input", (e) => {
        state.partnerLogoSize = Number(e.target.value) || 120;
        requestRender();
      });
      els.partnerSize.value = state.partnerLogoSize;
    }
    if (els.partnerPosition) {
      els.partnerPosition.addEventListener("change", (e) => {
        state.partnerLogoPosition = e.target.value || "bottom-left";
        requestRender();
      });
      els.partnerPosition.value = state.partnerLogoPosition;
    }
    if (els.partnerStyle) {
      els.partnerStyle.addEventListener("change", (e) => {
        state.partnerLogoStyle = e.target.value || "badge";
        requestRender();
      });
      els.partnerStyle.value = state.partnerLogoStyle;
    }
    ["dragenter", "dragover"].forEach((t) =>
      els.dropZone.addEventListener(t, (e) => {
        e.preventDefault();
        els.dropZone.classList.add("dragover");
      }),
    );
    ["dragleave", "drop"].forEach((t) =>
      els.dropZone.addEventListener(t, (e) => {
        e.preventDefault();
        els.dropZone.classList.remove("dragover");
      }),
    );
    els.dropZone.addEventListener("drop", (e) =>
      handleUpload(e.dataTransfer.files && e.dataTransfer.files[0], "main"),
    );
    els.adminToggle.addEventListener("click", () => {
      const v = els.adminPanel.hasAttribute("hidden");
      els.adminPanel.toggleAttribute("hidden", !v);
      els.adminToggle.classList.toggle("active", v);
    });
    els.shortcutsToggle.addEventListener("click", toggleShortcuts);
    els.closeShortcuts.addEventListener("click", (e) => {
      e.stopPropagation();
      closeShortcuts();
    });
    els.shortcutsOverlay.addEventListener("click", (e) => {
      if (e.target === els.shortcutsOverlay) closeShortcuts();
    });
    [
      "brandRed",
      "brandBlue",
      "brandGold",
      "brandDark",
      "brandTitleFont",
      "brandBodyFont",
    ].forEach((id) =>
      els[id].addEventListener("input", updateBrandFromControls),
    );
    els.resetBrand.addEventListener("click", () => {
      state.brand = { ...data.brandDefaults };
      try {
        localStorage.removeItem(BRAND_KEY);
      } catch (e) {}
      applyBrandToUi();
      requestRender();
    });
    if (els.resetTemplate)
      els.resetTemplate.addEventListener("click", () => {
        selectTemplate(state.templateId);
        setStatus("Modèle réinitialisé");
      });
    els.saveDesign.addEventListener("click", saveCurrentDesign);
    els.clearSaved.addEventListener("click", () => {
      if (!confirm("Supprimer toutes les sauvegardes locales ?")) return;
      try {
        localStorage.removeItem(STORAGE_KEY);
        setStatus("Sauvegardes supprimées");
      } catch (e) {}
      renderSavedList();
    });
    els.exportPng.addEventListener("click", () =>
      exportImage("image/png", "png"),
    );
    els.exportJpg.addEventListener("click", () =>
      exportImage("image/jpeg", "jpg"),
    );
    els.exportPdf.addEventListener("click", exportPdf);
  }

  // ── UI BUILDERS ─────────────────────────────────────────────
  function buildFormatSelect() {
    els.formatSelect.innerHTML = "";
    data.formats.forEach((f) => {
      const o = document.createElement("option");
      o.value = f.id;
      o.textContent = `${f.name} · ${f.width}×${f.height}`;
      els.formatSelect.appendChild(o);
    });
  }

  function renderCategoryTabs() {
    els.categoryTabs.innerHTML = "";
    data.categories.forEach((cat) => {
      const count = data.templates.filter((t) => t.category === cat.id).length;
      const active = cat.id === selectedCategory;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = active ? "active" : "";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(active));
      btn.setAttribute("aria-label", `${cat.name} (${count} modèles)`);
      btn.innerHTML = `<span>${escapeHtml(cat.name)}</span><strong>${count}</strong>`;
      btn.addEventListener("click", () => {
        selectedCategory = cat.id;
        renderCategoryTabs();
        renderTemplateList();
      });
      els.categoryTabs.appendChild(btn);
    });
  }

  function renderTemplateList() {
    renderCategoryTabs();
    const templates = data.templates.filter(
      (t) =>
        t.category === selectedCategory &&
        (!searchTerm ||
          `${t.name} ${t.description}`.toLowerCase().includes(searchTerm)),
    );
    currentTemplateList = templates;
    els.templateCount.textContent = String(templates.length);
    els.templateGrid.innerHTML = "";
    if (!templates.length) {
      const p = document.createElement("p");
      p.className = "preview-meta";
      p.textContent = "Aucun modèle trouvé.";
      els.templateGrid.appendChild(p);
      return;
    }
    templates.forEach((t, idx) => {
      const active = t.id === state.templateId;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `template-card${active ? " active" : ""}`;
      btn.dataset.templateId = t.id;
      btn.dataset.index = idx;
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", String(active));
      btn.setAttribute("aria-label", `${t.name}, ${t.description}`);
      btn.tabIndex = active ? 0 : -1;
      btn.innerHTML = `<strong>${escapeHtml(t.name)}</strong><span>${escapeHtml(t.description)}</span>`;
      btn.addEventListener("click", () => selectTemplate(t.id));
      els.templateGrid.appendChild(btn);
    });
    if (!selectedTemplateIndex || selectedTemplateIndex >= templates.length)
      selectedTemplateIndex = 0;
  }

  function selectTemplate(templateId, restoredState) {
    const tmpl = getTemplate(templateId);
    state.templateId = tmpl.id;
    state.formatId =
      restoredState?.formatId || tmpl.defaultFormat || data.formats[0].id;
    state.fields =
      restoredState?.fields ||
      Object.fromEntries(tmpl.fields.map((f) => [f.key, f.value]));
    state.imageSrc =
      restoredState?.imageSrc || tmpl.defaultImage || data.media[0].src;
    state.homeLogoSrc = restoredState?.homeLogoSrc || "";
    state.awayLogoSrc = restoredState?.awayLogoSrc || "";
    state.partnerLogos = restoredState?.partnerLogos || [];
    state.iconId =
      restoredState?.iconId || tmpl.defaultIcon || data.icons[0].id;
    if (restoredState?.brand) {
      state.brand = { ...data.brandDefaults, ...restoredState.brand };
      applyBrandToUi();
    }
    if (!restoredState) {
      try {
        const draft = readJson(DRAFT_KEY, {})[tmpl.id];
        if (draft) {
          state.fields = {
            ...Object.fromEntries(tmpl.fields.map((f) => [f.key, f.value])),
            ...draft.fields,
          };
          state.imageSrc = draft.imageSrc || state.imageSrc;
          state.homeLogoSrc = draft.homeLogoSrc || state.homeLogoSrc;
          state.awayLogoSrc = draft.awayLogoSrc || state.awayLogoSrc;
          state.partnerLogos = draft.partnerLogos || state.partnerLogos;
          state.formatId = draft.formatId || state.formatId;
          state.iconId = draft.iconId || state.iconId;
          state.brand = { ...state.brand, ...(draft.brand || {}) };
          setStatus("Brouillon restauré");
        }
      } catch (e) {
        console.warn(e);
      }
    }
    selectedCategory = tmpl.category;
    els.formatSelect.value = state.formatId;
    els.currentTemplateName.textContent = tmpl.name;
    els.currentCategory.textContent = getCategory(tmpl.category).name;
    clearModified();
    renderTemplateList();
    renderFieldEditor();
    renderMediaBank();
    renderPartnerBank();
    renderIconBank();
    requestRender();
  }

  function renderFieldEditor() {
    const tmpl = getTemplate(state.templateId);
    els.fieldEditor.innerHTML = "";
    tmpl.fields.forEach((item) => {
      const label = document.createElement("label");
      label.textContent = item.label;
      const input = document.createElement(
        item.type === "textarea" ? "textarea" : "input",
      );
      input.id = `field-${item.key}`;
      input.dataset.key = item.key;
      const lim = fieldUiLimits(item);
      input.value = state.fields[item.key] || "";
      input.placeholder = item.value || "";
      input.maxLength = lim.maxLength;
      if (input.tagName === "TEXTAREA") {
        input.rows = lim.rows;
        input.style.minHeight = `${lim.rows * 28}px`;
      }
      input.addEventListener("input", (e) => {
        state.fields[e.target.dataset.key || item.key] = e.target.value;
        markModified(label);
        requestRender();
        saveDraftDebounced();
      });
      input.addEventListener("blur", () => {
        if (!input.value) label.classList.remove("modified");
      });
      label.appendChild(input);
      els.fieldEditor.appendChild(label);
    });
  }

  function fieldUiLimits(item) {
    const k = item.key.toLowerCase();
    if (k === "items") return { maxLength: 900, rows: 8 };
    if (["details", "quote"].includes(k)) return { maxLength: 420, rows: 5 };
    if (["title", "subtitle", "competition"].includes(k))
      return { maxLength: 90, rows: 2 };
    return { maxLength: 140, rows: 3 };
  }

  function renderMediaBank() {
    els.mediaBank.innerHTML = "";
    data.media.forEach((m) => {
      const active = state.imageSrc === m.src;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = m.name;
      btn.className = active ? "active" : "";
      btn.setAttribute("aria-pressed", String(active));
      btn.setAttribute("aria-label", `Image : ${m.name}`);
      const img = document.createElement("img");
      img.src = m.src;
      img.alt = m.name;
      btn.appendChild(img);
      btn.addEventListener("click", () => {
        state.imageSrc = m.src;
        renderMediaBank();
        requestRender();
      });
      els.mediaBank.appendChild(btn);
    });
  }

  /**
   * renderPartnerBank — affiche les logos partenaires chargés
   * avec un bouton × pour supprimer chaque logo individuellement.
   * Limite visuelle : max 3 logos.
   */
  function renderPartnerBank() {
    if (!els.partnerBank) return;
    els.partnerBank.innerHTML = "";

    if (!state.partnerLogos.length) {
      // Message discret quand vide
      const empty = document.createElement("p");
      empty.className = "partner-bank-empty";
      empty.textContent = "Aucun logo partenaire chargé.";
      els.partnerBank.appendChild(empty);
      return;
    }

    state.partnerLogos.forEach((src, index) => {
      // Carte logo
      const card = document.createElement("div");
      card.className = "partner-bank-card";
      card.setAttribute("aria-label", `Logo partenaire ${index + 1}`);

      // Miniature
      const img = document.createElement("img");
      img.src = src;
      img.alt = `Logo partenaire ${index + 1}`;
      card.appendChild(img);

      // Badge numéro
      const num = document.createElement("span");
      num.className = "partner-bank-num";
      num.textContent = String(index + 1);
      card.appendChild(num);

      // Bouton supprimer
      const del = document.createElement("button");
      del.type = "button";
      del.className = "partner-bank-del";
      del.setAttribute("aria-label", `Supprimer le logo partenaire ${index + 1}`);
      del.textContent = "×";
      del.addEventListener("click", () => {
        state.partnerLogos = state.partnerLogos.filter((_, i) => i !== index);
        renderPartnerBank();
        requestRender();
        saveDraftDebounced();
      });
      card.appendChild(del);

      els.partnerBank.appendChild(card);
    });

    // Compteur
    const counter = document.createElement("p");
    counter.className = "partner-bank-count";
    counter.textContent = `${state.partnerLogos.length} / 3 logo${state.partnerLogos.length > 1 ? "s" : ""}`;
    els.partnerBank.appendChild(counter);
  }

  function renderIconBank() {
    els.iconBank.innerHTML = "";
    data.icons.forEach((ic) => {
      const active = state.iconId === ic.id;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = ic.name;
      btn.className = active ? "active" : "";
      btn.setAttribute("aria-pressed", String(active));
      btn.setAttribute("aria-label", `Icône : ${ic.name}`);
      const img = document.createElement("img");
      img.src = ic.src;
      img.alt = ic.name;
      btn.appendChild(img);
      btn.addEventListener("click", () => {
        state.iconId = ic.id;
        renderIconBank();
        requestRender();
      });
      els.iconBank.appendChild(btn);
    });
  }

  // ── BRAND ───────────────────────────────────────────────────
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleUpload(file, target) {
    if (!file) return;
    setLoading(true);
    try {
      if (target === "partner") {
        const files  = file.length !== undefined ? Array.from(file) : [file];
        const images = files.filter((f) => f.type?.startsWith("image/"));
        if (!images.length) { setLoading(false); return; }
        const dataUrls = await Promise.all(images.map(fileToDataUrl));
        // Limite à 3 logos partenaires au total
        const merged = [...state.partnerLogos, ...dataUrls];
        state.partnerLogos = merged.slice(0, 3);
        if (merged.length > 3) {
          setStatusState("info", `Max 3 logos — ${merged.length - 3} ignoré(s)`);
        }
        renderPartnerBank();
      } else {
        if (!file.type?.startsWith("image/")) return;
        const dataUrl = await fileToDataUrl(file);
        if (target === "homeLogo") state.homeLogoSrc = dataUrl;
        else if (target === "awayLogo") state.awayLogoSrc = dataUrl;
        else {
          state.imageSrc = dataUrl;
          renderMediaBank();
        }
      }
      setStatusState("success", "Image chargée");
      requestRender();
      saveDraftDebounced();
    } catch (e) {
      setStatusState("error", "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }

  function applyBrandToUi() {
    const root = document.documentElement;
    root.style.setProperty("--red", state.brand.red);
    root.style.setProperty("--blue", state.brand.blue);
    root.style.setProperty("--gold", state.brand.gold);
    els.brandRed.value = state.brand.red;
    els.brandBlue.value = state.brand.blue;
    els.brandGold.value = state.brand.gold;
    els.brandDark.value = state.brand.dark;
    els.brandTitleFont.value = state.brand.titleFont;
    els.brandBodyFont.value = state.brand.bodyFont;
  }

  function updateBrandFromControls() {
    state.brand = {
      ...state.brand,
      red: els.brandRed.value,
      blue: els.brandBlue.value,
      gold: els.brandGold.value,
      dark: els.brandDark.value,
      titleFont:
        els.brandTitleFont.value.trim() || data.brandDefaults.titleFont,
      bodyFont: els.brandBodyFont.value.trim() || data.brandDefaults.bodyFont,
    };
    try {
      localStorage.setItem(BRAND_KEY, JSON.stringify(state.brand));
    } catch (e) {
      console.warn(e);
    }
    applyBrandToUi();
    requestRender();
    saveDraftDebounced();
  }

  // ── SAVE / LOAD ─────────────────────────────────────────────
  function saveCurrentDesign() {
    const saved = readJson(STORAGE_KEY, []);
    const tmpl = getTemplate(state.templateId);
    const item = {
      id: `${Date.now()}`,
      label: tmpl.name,
      savedAt: new Date().toLocaleString("fr-FR"),
      templateId: state.templateId,
      formatId: state.formatId,
      fields: { ...state.fields },
      imageSrc: state.imageSrc,
      homeLogoSrc: state.homeLogoSrc,
      awayLogoSrc: state.awayLogoSrc,
      partnerLogos: state.partnerLogos,
      iconId: state.iconId,
      brand: { ...state.brand },
    };
    try {
      saved.unshift(item);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.slice(0, 15)));
      renderSavedList();
      setStatusState("success", "Design enregistré");
      hasUnsavedChanges = false;
      clearModified();
    } catch (e) {
      console.error(e);
      setStatusState("error", "Sauvegarde trop lourde");
    }
  }

  function renderSavedList() {
    const saved = readJson(STORAGE_KEY, []);
    els.savedList.innerHTML = "";
    if (!saved.length) {
      const s = document.createElement("small");
      s.textContent = "Aucune sauvegarde locale.";
      els.savedList.appendChild(s);
      return;
    }
    saved.forEach((item) => {
      const row = document.createElement("div");
      row.className = "saved-item";
      row.style.gridTemplateColumns = "1fr auto auto";
      row.innerHTML = `<div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.savedAt)}</small></div>`;
      const load = document.createElement("button");
      load.type = "button";
      load.title = "Charger";
      load.textContent = "↺";
      load.addEventListener("click", () =>
        selectTemplate(item.templateId, item),
      );
      const del = document.createElement("button");
      del.type = "button";
      del.title = "Supprimer";
      del.setAttribute("aria-label", "Supprimer cette sauvegarde");
      del.textContent = "×";
      del.addEventListener("click", () => deleteSavedDesign(item.id));
      row.appendChild(load);
      row.appendChild(del);
      els.savedList.appendChild(row);
    });
  }

  function deleteSavedDesign(id) {
    const saved = readJson(STORAGE_KEY, []);
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(saved.filter((i) => i.id !== id)),
      );
      setStatus("Sauvegarde supprimée");
    } catch (e) {
      console.warn(e);
    }
    renderSavedList();
  }

  // ── RENDER PIPELINE ─────────────────────────────────────────
  function requestRender() {
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(renderCurrent);
  }

  async function renderCurrent() {
    const version = ++renderVersion;
    setLoading(true);
    try {
      const tmpl = getTemplate(state.templateId);
      const format = getFormat(state.formatId);
      const icon =
        data.icons.find((i) => i.id === state.iconId) || data.icons[0];
      const gallerySrcs =
        tmpl.layout === "gallery"
          ? data.media.slice(0, 5).map((m) => m.src)
          : [];
      canvas.width = format.width;
      canvas.height = format.height;
      els.formatMeta.textContent = `${format.width} × ${format.height} px`;
      setStatus("Rendu…");
      const [
        photo,
        logo,
        iconImg,
        homeLogo,
        awayLogo,
      ] = await Promise.all([
        loadImage(state.imageSrc),
        loadImage(LOGO_SRC),
        loadImage(icon.src),
        state.homeLogoSrc
          ? loadImage(state.homeLogoSrc)
          : Promise.resolve(null),
        state.awayLogoSrc
          ? loadImage(state.awayLogoSrc)
          : Promise.resolve(null),
      ]);
      const partnerLogos = state.partnerLogos.length
        ? await Promise.all(state.partnerLogos.map(loadImage))
        : [];
      const gallery = await Promise.all(gallerySrcs.map(loadImage));
      if (version !== renderVersion) {
        setLoading(false);
        return;
      }
      renderDesign({
        tmpl,
        format,
        photo,
        logo,
        icon: iconImg,
        homeLogo,
        awayLogo,
        partnerLogos: partnerLogos.filter(Boolean),
        gallery: gallery.filter(Boolean),
      });
      setLoading(false);
      setStatus("Aperçu à jour");
    } catch (e) {
      setLoading(false);
      console.error(e);
      setStatus("Erreur de rendu");
    }
  }

  function renderDesign(assets) {
    const { tmpl, format } = assets;
    ctx.clearRect(0, 0, format.width, format.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const renderers = {
      match: renderMatch,
      "match-vs": renderMatchVs,
      result: renderResult,
      list: renderList,
      table: renderTable,
      roster: renderRoster,
      event: renderEvent,
      "convivial-event": renderConvivialEvent,
      portrait: renderPortrait,
      transfer: renderTransfer,
      sponsor: renderSponsor,
      info: renderInfo,
      gallery: renderGallery,
      quote: renderQuote,
      celebration: renderCelebration,
      recruitment: renderRecruitment,
    };
    (renderers[tmpl.layout] || renderInfo)(assets);
    if (assets.partnerLogos?.length && tmpl.layout !== "sponsor")
      drawPartnerBadge(
        assets.partnerLogos,
        format.width,
        format.height,
        unit(format.width, format.height),
      );
  }

  // ═══════════════════════════════════════════════════════════
  //  PRIMITIVES PARTAGÉES
  // ═══════════════════════════════════════════════════════════

  function drawBg(photo, w, h, overlayAlpha) {
    drawCover(photo, 0, 0, w, h, state.brand.dark);
    if (overlayAlpha > 0)
      drawOverlay(0, 0, w, h, `rgba(0,0,0,${overlayAlpha})`);
  }

  function drawDiagonalSplit(
    w,
    h,
    leftColor,
    rightColor,
    topRatio,
    splitRatio,
    angle,
  ) {
    const sy = h * topRatio,
      sx = w * splitRatio,
      diag = angle != null ? angle : 80;
    ctx.fillStyle = leftColor;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(sx - diag, sy);
    ctx.lineTo(sx + diag, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rightColor;
    ctx.beginPath();
    ctx.moveTo(sx - diag, sy);
    ctx.lineTo(w, sy);
    ctx.lineTo(w, h);
    ctx.lineTo(sx + diag, h);
    ctx.closePath();
    ctx.fill();
  }

  // ── Constantes de mise en page (base 1080 px, multipliées par u) ──
  const L = {
    PAD: 52, // marge latérale générale
    HDR_H: 148, // hauteur de la zone en-tête (logo + icône)
    FOOT_H: 132, // hauteur banderole bas
    PILL_H: 48, // hauteur pill/capsule
    ICON: 80, // taille badge icône HG
    LOGO: 104, // taille badge logo HD
    GAP: 24, // espacement entre blocs
    SAFE: 20, // zone de sécurité supplémentaire texte-bord
    FACE_SAFE: 0.34, // ratio hauteur zone sécurité visage (34% du haut)
    COACH: 108, // hauteur zone coach (roster)
    TOPBAR: 20, // barre haute info
    RIBBON: 148, // hauteur bandeau convivial-event
    TOPH: 136, // hauteur bande haute recruitment
    BOTH: 136, // hauteur bande basse recruitment
  };

  function drawHeader(icon, logo, w, h) {
    const u = unit(w, h);
    const pad = L.PAD * u;
    const topY = L.PAD * u;
    const iconSz = L.ICON * u;
    const logoSz = L.LOGO * u;
    // ombre portée globale pour les badges
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 14 * u;
    ctx.shadowOffsetY = 4 * u;
    drawIconBadge(icon, pad, topY, iconSz, "#ffffff", state.brand.red);
    drawLogo(logo, w - logoSz - pad, topY, logoSz);
    ctx.restore();
  }

  function drawCompPill(value, x, y, maxW, pillH) {
    if (!value) return;
    const u = unit(canvas.width, canvas.height);
    const ph = pillH || L.PILL_H * u;
    const pw = Math.min(maxW, 560 * u);
    drawPill(value, x, y, pw, ph, state.brand.red, "#ffffff");
  }

  function drawFooterBand(lineArr, w, h, color) {
    const u = unit(w, h),
      b = state.brand;
    const bandH = L.FOOT_H * u;
    const y = h - bandH;
    const pad = L.PAD * u;
    const bg = color || b.dark;

    // Fond uni solide
    ctx.fillStyle = bg;
    ctx.fillRect(0, y, w, bandH);

    // Liseré or haut (3-5 px selon résolution)
    const lH = Math.max(3, Math.round(4 * u));
    ctx.fillStyle = b.gold;
    ctx.fillRect(0, y, w, lH);

    const main = (lineArr[0] || "").toUpperCase();
    const sub = lineArr[1] || "";

    if (main) {
      drawFitText(main, pad, y + bandH * 0.5, w - pad * 2, {
        size: bandH * 0.33,
        min: 16 * u,
        color: "#ffffff",
        weight: 900,
        align: "center",
        family: b.accentFont,
        maxHeight: bandH * 0.42,
      });
    }
    if (sub) {
      drawFitText(sub, pad, y + bandH * 0.82, w - pad * 2, {
        size: bandH * 0.22,
        min: 12 * u,
        color: "rgba(255,255,255,0.75)",
        weight: 600,
        align: "center",
        family: b.bodyFont,
        maxHeight: bandH * 0.28,
      });
    }
  }

  function drawVsBrush(cx, cy, w, h) {
    const u = unit(w, h),
      b = state.brand;
    const size = (Math.min(w, h) > 900 ? 200 : 160) * u;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 28 * u;
    ctx.shadowOffsetY = 6 * u;
    ctx.font = `900 ${Math.round(size)}px ${b.accentFont}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(6, 10 * u);
    ctx.strokeStyle = rgba(b.dark, 0.7);
    ctx.strokeText("VS", cx, cy);
    const stops = [b.goldLight || "#f7e7ad", b.gold, b.goldDeep || "#a9781f"];
    const grad = ctx.createLinearGradient(
      cx - size * 0.5,
      cy - size * 0.5,
      cx + size * 0.5,
      cy + size * 0.5,
    );
    stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillText("VS", cx, cy);
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════
  //  RENDERERS
  // ═══════════════════════════════════════════════════════════

  function renderMatch({ format, photo, logo, icon, homeLogo, awayLogo }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      p = h >= w;
    drawBg(photo, w, h, 0.22);
    drawDiagonalSplit(
      w,
      h,
      rgba(b.red, 0.94),
      rgba(b.blue, 0.9),
      p ? 0.5 : 0.46,
      0.5,
      88 * u,
    );
    drawBottomFade(w, h, 0.5);
    drawHeader(icon, logo, w, h);
    const gap = L.GAP * u;

    // Badge icône : x=[PAD..PAD+ICON] = [52..132]u, y=[PAD..PAD+ICON] = [52..132]u
    // Titre placé à droite du badge sur la même ligne → zéro chevauchement
    const iconRight = (L.PAD + L.ICON) * u + 12 * u;   // 144u
    const badgeMidY = (L.PAD + L.ICON * 0.70) * u;     // ~108u (baseline centrée)
    const iconBot   = (L.PAD + L.ICON) * u + 10 * u;   // 142u (bas badge + gap)

    // titleW : de iconRight jusqu'au logo ESD (w - LOGO - PAD) moins une marge
    const titleW = w - iconRight - (L.LOGO + L.PAD + 8) * u;

    drawFitText(text("title").toUpperCase(), iconRight, badgeMidY, titleW, {
      size: p ? 84 * u : 68 * u,
      min: 36 * u,
      maxHeight: L.ICON * u * 0.80,   // ne dépasse pas la hauteur du badge
      color: "#fff",
      weight: 900,
      align: "left",
      stroke: "rgba(0,0,0,0.45)",
    });

    // Pill compétition : démarre sous le bas du badge, à L.PAD
    // Largeur limitée à 38% pour ne pas déborder sur la photo
    const pillW = Math.min(w * 0.38, 380 * u);
    const pillY = iconBot;
    ctx.save();
    ctx.shadowColor   = "rgba(0,0,0,0.25)";
    ctx.shadowBlur    = 10 * u;
    ctx.shadowOffsetY = 3 * u;
    drawCompPill(text("competition"), L.PAD * u, pillY, pillW, L.PILL_H * u);
    ctx.restore();
    const panelY = h * (p ? 0.5 : 0.46) + gap;
    const logoSz = p ? 148 * u : 124 * u;
    const teamSz = p ? 42 * u : 34 * u;
    const teamW = w * 0.36;
    const leftCX = w * 0.22;
    const rightCX = w * 0.78;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 26 * u;
    ctx.shadowOffsetY = 6 * u;
    const logoY = panelY + gap;
    [
      { cx: leftCX, logo: homeLogo },
      { cx: rightCX, logo: awayLogo },
    ].forEach(({ cx, logo: lg }) => {
      if (lg) {
        drawContain(lg, cx - logoSz / 2, logoY, logoSz, logoSz);
      } else {
        // Placeholder discret : carré arrondi semi-transparent + "?"
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        roundRect(cx - logoSz / 2, logoY, logoSz, logoSz, 16 * u);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.30)";
        ctx.font = `900 ${Math.round(logoSz * 0.38)}px ${b.accentFont}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", cx, logoY + logoSz / 2);
      }
    });
    ctx.restore();
    const nameY = logoY + logoSz + gap;
    drawWrappedText(
      text("homeTeam").toUpperCase(),
      leftCX - teamW / 2,
      nameY + teamSz,
      teamW,
      {
        size: teamSz,
        min: 18 * u,
        color: "#fff",
        weight: 900,
        align: "center",
        lineHeight: teamSz * 1.14,
        maxLines: 2,
        family: b.accentFont,
      },
    );
    drawWrappedText(
      text("awayTeam").toUpperCase(),
      rightCX - teamW / 2,
      nameY + teamSz,
      teamW,
      {
        size: teamSz,
        min: 18 * u,
        color: "#fff",
        weight: 900,
        align: "center",
        lineHeight: teamSz * 1.14,
        maxLines: 2,
        family: b.accentFont,
      },
    );
    drawVsBrush(w * 0.5, logoY + logoSz * 0.5, w, h);
    const dt = [text("date"), text("time")].filter(Boolean).join("  ·  ");
    drawFooterBand([dt, text("location")], w, h, rgba(b.dark, 0.93));
  }

  function renderMatchVs({ format, photo, logo, icon, homeLogo, awayLogo }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      p = h >= w;
    const gap = L.GAP * u;

    // ── TITRE + PILL ─────────────────────────────────────────
    // Ancré en haut GAUCHE : le joueur/action est centré ou
    // à droite → le titre ne le masque pas.
    // titleX : 8% de la largeur
    // titleW : 40% max → laisse 60% libres pour la photo
    const titleX = w * 0.08;
    const titleW = Math.min(w * 0.40, w - titleX - L.PAD * 2 * u);

    drawBg(photo, w, h, 0.32);
    drawBottomFade(w, h, 0.68);
    drawHeader(icon, logo, w, h);

    // titleY : juste sous l'en-tête, max 18% de hauteur
    const titleY = Math.max((L.HDR_H + 8) * u, h * 0.17);

    drawFitText(
      text("title").toUpperCase(),
      titleX,
      titleY,
      titleW,
      {
        size: p ? 84 * u : 66 * u,
        min: 36 * u,
        maxHeight: 100 * u,
        color: "#fff",
        weight: 900,
        align: "left",
        stroke: "rgba(0,0,0,0.45)",
      },
    );

    // Pill compétition : même ancrage, largeur 28% max
    const pillW = Math.min(w * 0.28, 300 * u);
    const pillY = titleY + (p ? 24 : 20) * u + gap;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 10 * u;
    ctx.shadowOffsetY = 2 * u;
    drawCompPill(
      text("competition"),
      titleX,
      pillY,
      pillW,
      L.PILL_H * u,
    );
    ctx.restore();
    const panelRatio = p ? 0.44 : 0.4;
    drawDiagonalSplit(
      w,
      h,
      rgba(b.red, 0.9),
      rgba(b.blue, 0.9),
      panelRatio,
      0.5,
      72 * u,
    );
    const logoSz = p ? 196 * u : 162 * u;
    const logoGap = 68 * u;
    const totalW = logoSz * 2 + logoGap;
    const lx = (w - totalW) / 2;
    const rx = lx + logoSz + logoGap;
    const logoY = h * panelRatio + gap;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.50)";
    ctx.shadowBlur = 28 * u;
    ctx.shadowOffsetY = 7 * u;
    [
      { x: lx, lg: homeLogo },
      { x: rx, lg: awayLogo },
    ].forEach(({ x, lg }) => {
      if (lg) {
        drawContain(lg, x, logoY, logoSz, logoSz);
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.arc(
          x + logoSz / 2,
          logoY + logoSz / 2,
          logoSz * 0.44,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    });
    ctx.restore();
    drawVsBrush(w * 0.5, logoY + logoSz * 0.5, w, h);
    const nameSz = p ? 48 * u : 38 * u;
    const nameW = logoSz * 0.92;
    const nameY = logoY + logoSz + gap;
    drawWrappedText(
      text("homeTeam").toUpperCase(),
      lx + logoSz / 2 - nameW / 2,
      nameY + nameSz,
      nameW,
      {
        size: nameSz,
        min: 20 * u,
        color: "#fff",
        weight: 900,
        align: "center",
        lineHeight: nameSz * 1.12,
        maxLines: 2,
        family: b.accentFont,
      },
    );
    drawWrappedText(
      text("awayTeam").toUpperCase(),
      rx + logoSz / 2 - nameW / 2,
      nameY + nameSz,
      nameW,
      {
        size: nameSz,
        min: 20 * u,
        color: "#fff",
        weight: 900,
        align: "center",
        lineHeight: nameSz * 1.12,
        maxLines: 2,
        family: b.accentFont,
      },
    );
    const dt = [text("date"), text("time")].filter(Boolean).join("  ·  ");
    drawFooterBand([dt, text("location")], w, h, rgba(b.dark, 0.93));
  }

  function renderResult({ format, photo, logo, icon, homeLogo, awayLogo }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      p = h >= w;
    drawBg(photo, w, h, 0.02);
    drawDiagonalSplit(
      w,
      h,
      rgba(b.red, 0.48),
      rgba(b.blue, 0.42),
      0.44,
      0.5,
      72 * u,
    );
    drawBottomFade(w, h, 0.18);
    drawHeader(icon, logo, w, h);
    const gap = L.GAP * u;

    // Badge icône : x=[PAD..PAD+ICON]u = [52..132]u, y=[PAD..PAD+ICON]u = [52..132]u
    // Titre à droite du badge sur la même ligne → zéro chevauchement
    const iconRight = (L.PAD + L.ICON) * u + 12 * u;   // 144u
    const badgeMidY = (L.PAD + L.ICON * 0.70) * u;     // ~108u
    const iconBot   = (L.PAD + L.ICON) * u + 10 * u;   // 142u

    // Largeur du titre : jusqu'au logo ESD, laisse la moitié droite libre
    const titleW = w * 0.46;

    drawFitText(text("title").toUpperCase(), iconRight, badgeMidY, titleW, {
      size: p ? 86 * u : 70 * u,
      min: 36 * u,
      maxHeight: L.ICON * u * 0.82,
      color: "#fff",
      weight: 900,
      stroke: "rgba(0,0,0,0.42)",
    });

    // Pill compétition sous le badge, largeur 44% max
    const pillW = Math.min(w * 0.44, 480 * u);
    const pillY = iconBot;
    drawCompPill(text("competition"), L.PAD * u, pillY, pillW, L.PILL_H * u);

    // Score ─────────────────────────────────────────────────────
    const scoreY = h * (p ? 0.62 : 0.64);
    ctx.save();
    ctx.shadowColor   = "rgba(0,0,0,0.22)";
    ctx.shadowBlur    = 12 * u;
    ctx.shadowOffsetY = 2 * u;
    drawFitText(
      `${text("scoreHome")}  –  ${text("scoreAway")}`,
      w * 0.5,
      scoreY,
      w * 0.76,
      { size: p ? 120 * u : 100 * u, min: 50 * u, color: "#fff", weight: 900, align: "center" },
    );
    ctx.restore();

    // Noms d'équipes — sous le score, blancs et plus présents
    drawFitText(
      `${text("homeTeam").toUpperCase()}  vs  ${text("awayTeam").toUpperCase()}`,
      w * 0.5,
      scoreY + (p ? 34 : 28) * u + gap,
      w * 0.9,
      { size: 26 * u, min: 14 * u, color: "#fff", weight: 800, align: "center", family: b.accentFont },
    );

    // Lieu du match — plus lisible et visible sans dominer
    if (text("location")) {
      drawFitText(
        text("location").toUpperCase(),
        w * 0.5,
        scoreY + (p ? 60 : 50) * u + gap,
        w * 0.72,
        { size: 16 * u, min: 10 * u, color: "rgba(255,255,255,0.9)", weight: 700, align: "center", family: b.bodyFont },
      );
    }

    // Buteurs — bien au-dessus du footer, avec fond sombre pour lisibilité
    const footerTop  = h - L.FOOT_H * u;
    const detailsY   = footerTop - 112 * u;
    // Bande sombre derrière les buteurs
    const bandH = 84 * u;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, detailsY - 40 * u, w, bandH);

    drawWrappedText(
      text("details"),
      L.PAD * u,
      detailsY,
      w - L.PAD * 2 * u,
      { size: 26 * u, min: 14 * u, color: "#fff", family: b.bodyFont, weight: 700, lineHeight: 34 * u, maxLines: 2, maxHeight: 78 * u, align: "center" },
    );
    drawFooterBand(
      [[text("date"), text("time")].filter(Boolean).join("  ·  "), text("location")],
      w, h, rgba(b.dark, 0.93),
    );
  }

  function renderRoster({ format, photo, logo, icon }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      p = h >= w;
    const gap = L.GAP * u;

    // ── FOND ──────────────────────────────────────────────────
    // Photo plein cadre avec overlay sombre sur la gauche
    drawBg(photo, w, h, 0.20);

    // Panneau rouge : 50% portrait, 44% paysage — bord droit adouci
    const panelW = p ? w * 0.50 : w * 0.44;

    // Dégradé rouge → transparent pour une transition douce vers la photo
    const panelGrad = ctx.createLinearGradient(0, 0, panelW, 0);
    panelGrad.addColorStop(0,    rgba(b.red, 0.97));
    panelGrad.addColorStop(0.82, rgba(b.red, 0.94));
    panelGrad.addColorStop(1,    rgba(b.red, 0.0));
    ctx.fillStyle = panelGrad;
    ctx.fillRect(0, 0, panelW + 60 * u, h);

    // ── EN-TÊTE : zone blanche ────────────────────────────────
    // hdrH dimensionné pour contenir l'icône + le titre sur une ligne.
    // L.ICON * u = 80u, topPad = 10u → bas icône = 10 + 80 = 90u
    // On ajoute 14u de marge basse → hdrH = 104u (fixe, indépendant de HDR_H)
    const iconSz  = L.ICON * u;           // 80u
    const topPad  = 10 * u;               // marge haut dans la zone blanche
    const hdrH    = Math.round(iconSz + topPad + 14 * u);   // ≈ 104u

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, panelW, hdrH);
    // Liseré or bas de la zone blanche
    ctx.fillStyle = b.gold;
    ctx.fillRect(0, hdrH - Math.max(2, 3 * u), panelW, Math.max(2, 3 * u));

    // Logo ESD (coin haut droit, via drawHeader normal — hors panneau blanc)
    ctx.save();
    ctx.shadowColor  = "rgba(0,0,0,0.22)";
    ctx.shadowBlur   = 14 * u;
    ctx.shadowOffsetY = 3 * u;
    // On dessine seulement le logo ESD à sa position habituelle
    drawLogo(logo, w - L.LOGO * u - L.PAD * u, topPad, L.LOGO * u);
    ctx.restore();

    // Icône calendrier en haut à gauche de la zone blanche,
    // dimensionnée pour tenir dans hdrH avec les marges
    ctx.save();
    ctx.shadowColor  = "rgba(0,0,0,0.18)";
    ctx.shadowBlur   = 10 * u;
    ctx.shadowOffsetY = 3 * u;
    drawIconBadge(icon, L.PAD * u, topPad, iconSz, "#ffffff", b.red);
    ctx.restore();

    // Titre "LE GROUPE" : commence exactement à droite de l'icône,
    // avec un gap de 12u — plus aucun chevauchement possible
    const titleX = L.PAD * u + iconSz + 12 * u;
    const titleW = panelW - titleX - 8 * u;
    // Baseline centrée sur la hauteur de l'icône
    const titleY = topPad + iconSz * 0.72;
    drawFitText(text("title").toUpperCase(), titleX, titleY, titleW, {
      size: Math.min(58 * u, titleW * 0.55),   // auto-réduit si titre long
      min: 24 * u,
      maxHeight: iconSz * 0.85,
      color: b.red,
      weight: 900,
    });

    // ── BLOC MATCH + DATE ─────────────────────────────────────
    // Rectangle rouge foncé avec liseré or, compact
    const matchZoneH = 78 * u;
    const matchZoneY = hdrH + gap * 0.5;
    ctx.fillStyle = rgba(b.dark, 0.55);
    ctx.fillRect(0, matchZoneY, panelW, matchZoneH);
    ctx.fillStyle = b.gold;
    ctx.fillRect(0, matchZoneY, panelW, Math.max(2, 3 * u));

    const infoX = L.PAD * u;
    const infoW = panelW - L.PAD * 2 * u;

    drawFitText(text("subtitle").toUpperCase(), infoX, matchZoneY + matchZoneH * 0.44, infoW, {
      size: 22 * u,
      min: 13 * u,
      color: "#fff",
      weight: 900,
      family: b.accentFont,
    });
    drawFitText(text("date").toUpperCase(), infoX, matchZoneY + matchZoneH * 0.82, infoW, {
      size: 18 * u,
      min: 12 * u,
      color: b.gold,
      weight: 800,
      family: b.accentFont,
    });

    // ── LISTE JOUEURS ─────────────────────────────────────────
    const listTop    = matchZoneY + matchZoneH + gap * 0.75;
    const coachZoneH = 88 * u;
    const coachY     = h - coachZoneH - gap * 0.5;
    const available  = Math.max(60 * u, coachY - listTop - gap * 0.5);

    // Taille de ligne adaptée pour afficher un max de joueurs
    const idealLineH = 38 * u;
    const maxRows    = Math.max(1, Math.floor(available / idealLineH));
    const items      = limitVisibleLines(lines(text("items")), maxRows);
    const rowH       = available / Math.max(items.length, 1);
    // Taille du nom : s'adapte à la hauteur de ligne, min 14u max 30u
    const nameSz     = Math.max(14 * u, Math.min(28 * u, rowH * 0.52));
    // Taille du numéro : 70% du nom
    const numSz      = nameSz * 0.72;

    items.forEach((name, i) => {
      const ry = listTop + i * rowH;

      // Fond alterné subtil sur les lignes paires
      if (i % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, ry, panelW, rowH - 1 * u);
      }

      // Numéro en or, aligné à droite dans une zone fixe de 40u
      ctx.save();
      ctx.fillStyle = rgba(b.gold, 0.80);
      ctx.font      = `700 ${Math.round(numSz)}px ${b.bodyFont}`;
      ctx.textAlign    = "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(String(i + 1), L.PAD * u + 32 * u, ry + rowH * 0.70);
      ctx.restore();

      // Nom du joueur en blanc gras
      drawFitText(
        name,
        L.PAD * u + 40 * u,
        ry + rowH * 0.70,
        panelW - L.PAD * u - 52 * u,
        {
          size: nameSz,
          min: 13 * u,
          color: "#fff",
          weight: 900,
          family: b.accentFont,
        },
      );
    });

    // ── ZONE COACH ────────────────────────────────────────────
    ctx.fillStyle = rgba(b.dark, 0.78);
    ctx.fillRect(0, coachY, panelW, coachZoneH);
    ctx.fillStyle = b.gold;
    ctx.fillRect(0, coachY, panelW, Math.max(2, 3 * u));

    drawFitText(
      `Coach : ${text("coach")}`,
      L.PAD * u,
      coachY + coachZoneH * 0.64,
      panelW - L.PAD * 2 * u,
      {
        size: 26 * u,
        min: 16 * u,
        color: b.gold,
        weight: 900,
        family: b.accentFont,
      },
    );
  }

  function renderPortrait({ format, photo, logo, icon }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      portrait = h >= w;
    const gap = L.GAP * u;
    drawBg(photo, w, h, 0.16);
    drawDiagonalSplit(
      w,
      h,
      rgba(b.red, 0.88),
      rgba(b.blue, 0.84),
      portrait ? 0.56 : 0.52,
      0.46,
      80 * u,
    );
    drawBottomFade(w, h, 0.4);
    drawHeader(icon, logo, w, h);
    drawFitText(
      text("title").toUpperCase(),
      L.PAD * u,
      Math.max((L.HDR_H + gap) * u, h * L.FACE_SAFE),
      w * 0.62,
      {
        size: 56 * u,
        min: 30 * u,
        maxHeight: 68 * u,
        color: "#fff",
        weight: 900,
      },
    );
    drawWrappedText(
      text("name").toUpperCase(),
      L.PAD * u,
      portrait
        ? Math.max(316 * u, h * L.FACE_SAFE + 100 * u)
        : Math.max(286 * u, h * L.FACE_SAFE + 80 * u),
      w * 0.6,
      {
        size: portrait ? 102 * u : 82 * u,
        min: 46 * u,
        color: b.gold,
        weight: 900,
        lineHeight: portrait ? 96 * u : 78 * u,
        maxLines: 3,
        maxHeight: portrait ? 330 * u : 268 * u,
        family: b.accentFont,
      },
    );
    const pillY = h - L.FOOT_H * u - gap;
    drawPill(
      text("role"),
      L.PAD * u,
      pillY,
      Math.min(w * 0.5, 440 * u),
      52 * u,
      "#fff",
      b.red,
    );
    drawFitText(text("stats"), L.PAD * u + 6 * u, pillY - 58 * u, w * 0.64, {
      size: 28 * u,
      min: 16 * u,
      color: "#fff",
      weight: 800,
    });
    drawWrappedText(
      `"${text("quote")}"`,
      L.PAD * u + 6 * u,
      h - 196 * u,
      w * 0.62,
      {
        size: 24 * u,
        min: 14 * u,
        color: "rgba(255,255,255,0.90)",
        family: b.bodyFont,
        weight: 700,
        lineHeight: 36 * u,
        maxLines: 4,
        maxHeight: 150 * u,
      },
    );
    drawFooterBand(["Allez l'ESD !"], w, h, rgba(b.dark, 0.91));
  }

  function renderTransfer({ format, photo, logo, icon }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      portrait = h >= w;
    const gap = L.GAP * u;

    // ── 1. FOND COLORÉ ────────────────────────────────────────
    // Panneau rouge diagonal gauche (large)
    ctx.fillStyle = b.red;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.60, 0);
    ctx.lineTo(w * 0.34, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Panneau bleu droit
    ctx.fillStyle = b.blue;
    ctx.fillRect(w * 0.68, 0, w * 0.32, h);

    // ── 2. PHOTO PAR-DESSUS les couleurs ──────────────────────
    // La photo est dessinée APRÈS les panneaux colorés pour que
    // le visage du joueur apparaisse en avant-plan.
    // On la place centrée horizontalement, plein cadre vertical,
    // avec un clip pour éviter de déborder sur les bords.
    if (photo) {
      // Zone de clip : centre de l'image, légèrement décalée à droite
      // pour que le visage soit visible et le texte reste à gauche
      const clipX = portrait ? w * 0.28 : w * 0.32;
      const clipW = w - clipX;
      ctx.save();
      ctx.beginPath();
      ctx.rect(clipX, 0, clipW, h);
      ctx.clip();
      // Cover centré sur cette zone
      const scale = Math.max(clipW / photo.width, h / photo.height);
      const sw = photo.width  * scale;
      const sh = photo.height * scale;
      const sx = clipX + (clipW - sw) / 2;
      const sy = (h - sh) / 2;
      ctx.drawImage(photo, sx, sy, sw, sh);
      ctx.restore();
    }

    // ── 3. FONDU de liaison entre la photo et les panneaux ────
    // Dégradé horizontal sur le bord gauche de la photo
    // pour une transition douce rouge → photo
    const blendX = portrait ? w * 0.28 : w * 0.32;
    const blendW = 140 * u;
    const blendGrad = ctx.createLinearGradient(blendX, 0, blendX + blendW, 0);
    blendGrad.addColorStop(0,   rgba(b.red, 0.92));
    blendGrad.addColorStop(0.5, rgba(b.red, 0.40));
    blendGrad.addColorStop(1,   rgba(b.red, 0.0));
    ctx.fillStyle = blendGrad;
    ctx.fillRect(blendX, 0, blendW, h);

    // Fondu bas général (lisibilité footer)
    drawBottomFade(w, h, 0.42);

    // ── 4. EN-TÊTE ────────────────────────────────────────────
    drawHeader(icon, logo, w, h);

    // ── 5. TEXTE ──────────────────────────────────────────────
    // Badge icône HG occupe x=[PAD .. PAD+ICON] = [52..132]u
    //                        y=[PAD .. PAD+ICON] = [52..132]u
    // Pour éviter TOUT chevauchement :
    //   • "BIENVENUE" : commence à droite du badge (x = iconRight + gap)
    //                   sur la même ligne que le badge (y centré sur le badge)
    //   • "NABIL"     : descend sous le badge (y = iconBottom + gap)
    //                   revient à x = padX pour occuper toute la largeur
    const padX      = L.PAD * u;
    const iconRight = (L.PAD + L.ICON) * u + 14 * u;  // 146u — droite badge + gap
    const iconMidY  = (L.PAD + L.ICON * 0.72) * u;    // ~109u — baseline dans le badge
    const iconBottom = (L.PAD + L.ICON) * u + 8 * u;  // 140u — sous le badge + petit gap
    const textZoneW = portrait ? w * 0.46 : w * 0.42;

    // Titre "BIENVENUE" à droite du badge
    const titleW  = textZoneW - iconRight + padX;
    const titleSz = portrait ? 72 * u : 56 * u;

    drawFitText(
      text("title").toUpperCase(),
      iconRight,
      iconMidY,
      titleW,
      {
        size: titleSz,
        min: 26 * u,
        maxHeight: titleSz * 1.1,
        color: "#fff",
        weight: 900,
      },
    );

    // Nom du joueur : démarre SOUS la baseline du titre + titleSz (hauteur) + gap 14u
    // iconMidY = baseline titre → bas du titre ≈ iconMidY + titleSz
    const nameY  = iconMidY + titleSz + 14 * u;
    const nameSz = portrait ? 88 * u : 68 * u;

    drawWrappedText(
      text("name").toUpperCase(),
      padX,
      nameY,
      textZoneW,
      {
        size: nameSz,
        min: 36 * u,
        color: b.gold,
        weight: 900,
        lineHeight: nameSz * 1.1,
        maxLines: 2,
        maxHeight: nameSz * 2.3,
        family: b.accentFont,
      },
    );

    // Pill poste + description — bloc bas ancré au footer
    const footerTop = h - L.FOOT_H * u;
    const pillH     = 44 * u;
    const pillW     = Math.min(280 * u, textZoneW * 0.68);
    const pillY     = footerTop - 160 * u;

    ctx.save();
    ctx.shadowColor  = "rgba(0,0,0,0.35)";
    ctx.shadowBlur   = 12 * u;
    ctx.shadowOffsetY = 3 * u;
    drawPill(text("role"), padX, pillY, pillW, pillH, b.red, "#fff");
    ctx.restore();

    drawWrappedText(
      text("details"),
      padX,
      pillY + pillH + 14 * u,
      textZoneW + 16 * u,
      {
        size: 20 * u,
        min: 13 * u,
        color: "rgba(255,255,255,0.90)",
        family: b.bodyFont,
        weight: 600,
        lineHeight: 34 * u,
        maxLines: 3,
        maxHeight: 104 * u,
      },
    );

    // ── 6. FOOTER ─────────────────────────────────────────────
    drawFooterBand(
      [text("cta") || "BIENVENUE À LA MAISON"],
      w,
      h,
      rgba(b.dark, 0.93),
    );
  }

  function renderEvent({ format, photo, logo, icon }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      portrait = h >= w;
    const gap = L.GAP * u;
    drawBg(photo, w, h, 0.22);
    ctx.fillStyle = rgba(b.blue, 0.88);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.68, 0);
    ctx.lineTo(w * 0.46, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    drawHeader(icon, logo, w, h);
    drawFitText(
      text("subtitle").toUpperCase(),
      L.PAD * u,
      // Sous-titre juste après l'en-tête, sur 55% de large max
      // → zone droite et centre libres pour la photo
      Math.max((L.HDR_H + 8) * u, h * 0.16),
      w * 0.55,
      {
        size: 32 * u,
        min: 20 * u,
        color: b.gold,
        weight: 900,
        family: b.accentFont,
      },
    );
    drawWrappedText(
      text("title").toUpperCase(),
      L.PAD * u - 4 * u,
      // Titre principal sur 55% de large, sous le sous-titre
      portrait
        ? Math.max(268 * u, h * 0.22)
        : Math.max(238 * u, h * 0.22),
      w * 0.55,
      {
        size: portrait ? 86 * u : 68 * u,
        min: 36 * u,
        color: "#fff",
        weight: 900,
        lineHeight: portrait ? 84 * u : 66 * u,
        maxLines: 4,
        maxHeight: portrait ? 360 * u : 288 * u,
      },
    );
    drawWrappedText(
      text("details"),
      L.PAD * u + 4 * u,
      h - L.FOOT_H * u - 130 * u,
      w * 0.6,
      {
        size: 28 * u,
        min: 16 * u,
        color: "rgba(255,255,255,0.92)",
        family: b.bodyFont,
        weight: 700,
        lineHeight: 42 * u,
        maxLines: 4,
        maxHeight: 166 * u,
      },
    );
    drawFooterBand(
      [
        [text("date"), text("location")].filter(Boolean).join("  |  "),
        text("cta") || "",
      ],
      w,
      h,
      b.red,
    );
  }

  function renderConvivialEvent({ format, photo, logo, icon }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      portrait = h >= w;
    const gap = L.GAP * u;
    drawBg(photo, w, h, 0.24);
    const fadeH = h * (portrait ? 0.62 : 0.58);
    ctx.fillStyle = blockGradient(
      0,
      0,
      w,
      fadeH,
      rgba(b.blue, 0.92),
      rgba(b.blue, 0.04),
    );
    ctx.fillRect(0, 0, w, fadeH);
    drawHeader(icon, logo, w, h);
    const bienvenueY = Math.max((L.HDR_H + 44) * u + 14 * u, h * L.FACE_SAFE);
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${Math.round(42 * u)}px ${b.accentFont}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("BIENVENUE", L.PAD * u + 28 * u, bienvenueY);
    ctx.restore();
    const eyebrowY = Math.max(
      (L.HDR_H + 44) * u + 78 * u,
      h * L.FACE_SAFE + 50 * u,
    );
    drawFitText(text("subtitle").toUpperCase(), L.PAD * u, eyebrowY, w * 0.76, {
      size: 32 * u,
      min: 20 * u,
      color: b.gold,
      weight: 900,
      family: b.accentFont,
    });
    drawWrappedText(
      text("title").toUpperCase(),
      L.PAD * u,
      Math.max(
        eyebrowY + (portrait ? 122 : 102) * u,
        h * L.FACE_SAFE + 100 * u,
      ),
      w * 0.8,
      {
        size: portrait ? 126 * u : 102 * u,
        min: 56 * u,
        color: "#fff",
        weight: 900,
        lineHeight: portrait ? 118 * u : 96 * u,
        maxLines: 3,
        maxHeight: portrait ? 390 * u : 310 * u,
      },
    );
    drawWrappedText(
      text("details"),
      L.PAD * u + 8 * u,
      h - L.FOOT_H * u - 150 * u,
      w * 0.72,
      {
        size: 30 * u,
        min: 20 * u,
        color: "rgba(255,255,255,0.92)",
        family: b.bodyFont,
        weight: 700,
        lineHeight: 42 * u,
        maxLines: 3,
        maxHeight: 132 * u,
      },
    );
    const ribbonH = 148 * u,
      ribbonY = h - ribbonH;
    ctx.fillStyle = b.red;
    ctx.fillRect(0, ribbonY, w, ribbonH);
    ctx.fillStyle = b.gold;
    ctx.fillRect(0, ribbonY, w, Math.max(3, 5 * u));
    ctx.fillRect(0, h - Math.max(3, 5 * u), w, Math.max(3, 5 * u));
    const footer = [text("date"), text("location")]
      .filter(Boolean)
      .join("  —  ");
    drawFitText(
      footer,
      L.PAD * u,
      ribbonY + ribbonH * 0.56,
      w - L.PAD * 2 * u,
      {
        size: ribbonH * 0.3,
        min: 16 * u,
        color: "#fff",
        weight: 900,
        family: b.accentFont,
        align: "center",
        clip: false,
      },
    );
    drawFitText(
      text("cta") || "Contactez-nous",
      L.PAD * u,
      ribbonY + ribbonH * 0.86,
      w - L.PAD * 2 * u,
      {
        size: ribbonH * 0.22,
        min: 14 * u,
        color: "rgba(255,255,255,0.8)",
        weight: 700,
        family: b.bodyFont,
        align: "center",
        clip: false,
      },
    );
  }

  function renderRecruitment({ format, photo, logo, icon }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      portrait = h >= w;
    const gap = L.GAP * u;
    drawBg(photo, w, h, 0.36);
    drawBottomFade(w, h, 0.74);
    const topH = 136 * u,
      botH = 136 * u;
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, w, topH);
    ctx.fillStyle = b.gold;
    ctx.fillRect(0, topH - Math.max(3, 5 * u), w, Math.max(3, 5 * u));
    ctx.fillStyle = b.blue;
    ctx.fillRect(0, h - botH, w, botH);
    ctx.fillStyle = b.gold;
    ctx.fillRect(0, h - botH, w, Math.max(3, 5 * u));
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 14 * u;
    ctx.shadowOffsetY = 3 * u;
    drawHeader(icon, logo, w, h);
    ctx.restore();
    drawFitText(
      text("title").toUpperCase(),
      L.PAD * u + 78 * u,
      Math.max(topH * 0.68, h * L.FACE_SAFE),
      w - (L.PAD * 2 + L.LOGO + 92) * u,
      {
        size: 58 * u,
        min: 28 * u,
        maxHeight: 64 * u,
        color: "#fff",
        weight: 900,
        family: b.accentFont,
      },
    );
    drawWrappedText(
      text("subtitle").toUpperCase(),
      w * 0.5,
      Math.max(h * 0.5, h * L.FACE_SAFE + 100 * u),
      w * 0.8,
      {
        size: portrait ? 78 * u : 64 * u,
        min: 34 * u,
        color: "#fff",
        weight: 900,
        lineHeight: portrait ? 76 * u : 62 * u,
        align: "center",
        maxLines: 3,
        maxHeight: portrait ? 238 * u : 194 * u,
      },
    );
    drawWrappedText(
      text("details"),
      L.PAD * u + 20 * u,
      h - L.FOOT_H * u - 160 * u,
      w - L.PAD * 2 * u,
      {
        size: 30 * u,
        min: 18 * u,
        color: "rgba(255,255,255,0.94)",
        family: b.bodyFont,
        weight: 700,
        lineHeight: 44 * u,
        align: "center",
        maxLines: 4,
        maxHeight: 154 * u,
      },
    );
    drawFitText(
      text("cta") || "Contactez-nous",
      L.PAD * u,
      h - botH * 0.3,
      w - L.PAD * 2 * u,
      {
        size: 30 * u,
        min: 16 * u,
        color: b.gold,
        weight: 900,
        family: b.accentFont,
        align: "center",
        clip: false,
      },
    );
  }

  function renderSponsor({ format, photo, logo, icon, partnerLogos }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      p = h >= w;
    const gap = L.GAP * u;

    // ── 1. FOND photo + voile sombre ─────────────────────────
    drawBg(photo, w, h, 0.20);
    const fade = ctx.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0,    "rgba(5,8,15,0.80)");
    fade.addColorStop(0.40, "rgba(5,8,15,0.60)");
    fade.addColorStop(0.65, "rgba(5,8,15,0.25)");
    fade.addColorStop(1,    "rgba(5,8,15,0.85)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);

    // ── 2. EN-TÊTE ────────────────────────────────────────────
    drawHeader(icon, logo, w, h);

    // Titre à droite du badge (pattern universel anti-chevauchement)
    const iconRight = (L.PAD + L.ICON) * u + 12 * u;
    const iconMidY  = (L.PAD + L.ICON * 0.72) * u;
    const titleW    = w - iconRight - (L.LOGO + L.PAD + 8) * u;
    drawFitText(text("title").toUpperCase(), iconRight, iconMidY, titleW, {
      size: p ? 62 * u : 50 * u,
      min: 26 * u,
      maxHeight: L.ICON * u * 0.80,
      color: "#fff",
      weight: 900,
      family: b.accentFont,
    });

    // ── 3. CARTE PARTENAIRE ───────────────────────────────────
    // Hauteur calculée depuis le contenu réel, pas un % fixe
    // Éléments internes : pad + badge(32u) + gap(12u) + nom(46u) + gap(14u)
    //                   + message(lignes*28u) + gap(16u) + cta(48u) + pad
    const innerPad  = 24 * u;
    const badgeH    = 32 * u;
    const nameH     = 48 * u;       // hauteur réservée au nom partenaire
    const msgLines  = p ? 4 : 3;
    const msgLineH  = 28 * u;
    const ctaH      = 46 * u;

    const contentH  = badgeH + 12 * u + nameH + 14 * u + msgLines * msgLineH + 16 * u + ctaH;
    const cardH     = contentH + innerPad * 2;

    const cardX     = L.PAD * u;
    // Carte commence juste sous l'en-tête
    const cardY     = (L.PAD + L.ICON) * u + gap;
    const cardW     = w - cardX * 2;

    // Fond blanc de la carte
    ctx.save();
    ctx.fillStyle    = "rgba(255,255,255,0.97)";
    ctx.shadowColor  = "rgba(0,0,0,0.32)";
    ctx.shadowBlur   = 28 * u;
    ctx.shadowOffsetY = 6 * u;
    roundRect(cardX, cardY, cardW, cardH, 16 * u);
    ctx.fill();
    ctx.restore();

    // Liseré rouge haut de la carte
    ctx.fillStyle = b.red;
    roundRect(cardX, cardY, cardW, Math.max(5, 6 * u), 2 * u);
    ctx.fill();

    // ── 4. COLONNE GAUCHE : logos partenaires ────────────────
    const logoColW  = p ? cardW * 0.28 : cardW * 0.24;
    const logoColH  = cardH - innerPad * 2;
    const logoColX  = cardX + innerPad;
    const logoColY  = cardY + innerPad;

    // Séparateur vertical entre les deux colonnes
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(logoColX + logoColW + 18 * u, cardY + innerPad, Math.max(1, 1.5 * u), logoColH);

    const sponsorLogos = Array.isArray(partnerLogos) ? partnerLogos.slice(0, 4) : [];
    if (sponsorLogos.length) {
      const cols = sponsorLogos.length > 2 ? 2 : sponsorLogos.length;
      const rows = Math.ceil(sponsorLogos.length / cols);
      const gap = 12 * u;
      const logoSize = Math.min(
        logoColW / cols - gap,
        (logoColH - gap * (rows - 1)) / rows,
        88 * u,
      );
      const totalWidth = cols * logoSize + (cols - 1) * gap;
      const totalHeight = rows * logoSize + (rows - 1) * gap;
      const startX = logoColX + (logoColW - totalWidth) / 2;
      const startY = logoColY + (logoColH - totalHeight) / 2;
      sponsorLogos.forEach((logoImg, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = startX + col * (logoSize + gap);
        const y = startY + row * (logoSize + gap);
        ctx.save();
        ctx.fillStyle = "#f8f9fb";
        roundRect(x, y, logoSize, logoSize, 12 * u);
        ctx.fill();
        ctx.restore();
        drawContain(
          logoImg,
          x + 10 * u,
          y + 10 * u,
          logoSize - 20 * u,
          logoSize - 20 * u,
        );
      });
    } else {
      ctx.fillStyle = "#eef0f4";
      roundRect(logoColX, logoColY, logoColW, logoColH, 10 * u);
      ctx.fill();
      ctx.strokeStyle = "#c8cdd7";
      ctx.lineWidth   = 2 * u;
      roundRect(logoColX + logoColW * 0.2, logoColY + logoColH * 0.25, logoColW * 0.6, logoColH * 0.5, 8 * u);
      ctx.stroke();
      ctx.fillStyle   = "#9ca3af";
      ctx.font        = `700 ${Math.round(14 * u)}px ${b.bodyFont}`;
      ctx.textAlign   = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("LOGO", logoColX + logoColW / 2, logoColY + logoColH * 0.5);
      ctx.fillText("PARTENAIRE", logoColX + logoColW / 2, logoColY + logoColH * 0.5 + 18 * u);
    }

    // ── 5. COLONNE DROITE : texte ─────────────────────────────
    const textX = logoColX + logoColW + 20 * u + 18 * u;   // après séparateur
    const textW = cardX + cardW - innerPad - textX;
    let   curY  = cardY + innerPad + 6 * u;

    // Badge "PARTENAIRE OFFICIEL" en bleu
    drawPill("PARTENAIRE OFFICIEL", textX, curY, Math.min(textW, 240 * u), badgeH, b.blue, "#fff");
    curY += badgeH + 12 * u;

    // Nom du partenaire — grand, impactant
    drawFitText(text("sponsor").toUpperCase(), textX, curY + nameH * 0.78, textW, {
      size: 40 * u,
      min: 20 * u,
      maxHeight: nameH,
      color: b.dark,
      weight: 900,
      family: b.accentFont,
    });
    curY += nameH + 14 * u;

    // Message principal
    drawWrappedText(text("details"), textX, curY, textW, {
      size: 19 * u,
      min: 13 * u,
      color: "#374151",
      family: b.bodyFont,
      weight: 600,
      lineHeight: msgLineH,
      maxLines: msgLines,
      maxHeight: msgLines * msgLineH,
    });
    curY += msgLines * msgLineH + 16 * u;

    // ── 6. ZONE BAS : slogan club seul ───────────────────────
    const belowCard = cardY + cardH;
    const footerTop = h - L.FOOT_H * u;
    const midBelow  = belowCard + (footerTop - belowCard) / 2;

    drawFooterBand(["Ensemble avec l'ES Doubs"], w, h, rgba(b.dark, 0.95));
  }

  function renderInfo({ format, photo, logo, icon }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      portrait = h >= w;
    const gap = L.GAP * u;
    ctx.fillStyle = "#f4f6f9";
    ctx.fillRect(0, 0, w, h);
    if (photo) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      drawCover(photo, w * 0.45, 0, w * 0.55, h, "#ccc");
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    const barH = 20 * u;
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, w, barH);
    ctx.fillStyle = b.gold;
    ctx.fillRect(0, barH, w, Math.max(2, 3 * u));
    ctx.fillStyle = b.red;
    ctx.fillRect(0, barH + 3 * u, 20 * u, h - barH - 3 * u - 130 * u);
    drawHeader(icon, logo, w, h);
    drawFitText(
      text("subtitle").toUpperCase(),
      L.PAD * u,
      Math.max((L.HDR_H + gap) * u, h * L.FACE_SAFE),
      w * 0.64,
      {
        size: 30 * u,
        min: 18 * u,
        color: b.red,
        weight: 900,
        family: b.accentFont,
      },
    );
    drawWrappedText(
      text("title").toUpperCase(),
      L.PAD * u - 4 * u,
      portrait
        ? Math.max(296 * u, h * L.FACE_SAFE + 100 * u)
        : Math.max(266 * u, h * L.FACE_SAFE + 80 * u),
      w * 0.76,
      {
        size: portrait ? 70 * u : 56 * u,
        min: 32 * u,
        color: b.dark,
        weight: 900,
        lineHeight: portrait ? 74 * u : 60 * u,
        maxLines: 4,
        maxHeight: portrait ? 310 * u : 258 * u,
      },
    );
    const footerY = h - 118 * u;
    const hasDate = Boolean(text("date"));
    const dateY = footerY - 86 * u;
    const detailsY = hasDate ? dateY - 138 * u : footerY - 168 * u;

    if (hasDate)
      drawPill(
        text("date"),
        L.PAD * u,
        dateY,
        Math.min(w * 0.64, 600 * u),
        56 * u,
        b.red,
        "#fff",
      );
    drawWrappedText(
      text("details"),
      L.PAD * u + 6 * u,
      detailsY,
      w * 0.72,
      {
        size: 26 * u,
        min: 16 * u,
        color: b.dark,
        family: b.bodyFont,
        weight: 600,
        lineHeight: 38 * u,
        maxLines: hasDate ? 3 : 4,
        maxHeight: hasDate ? 118 * u : 154 * u,
      },
    );
    ctx.fillStyle = b.blue;
    ctx.fillRect(0, footerY, w, 118 * u);
    drawFitText(
      text("cta").toUpperCase(),
      L.PAD * u,
      h - 50 * u,
      w - L.PAD * 2 * u,
      {
        size: 30 * u,
        min: 16 * u,
        color: "#fff",
        weight: 900,
        align: "center",
        family: b.accentFont,
        clip: false,
      },
    );
  }

  function renderQuote({ format, photo, logo, icon }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      portrait = h >= w;
    const gap = L.GAP * u;
    drawBg(photo, w, h, 0.54);
    drawBottomFade(w, h, 0.32);
    ctx.fillStyle = rgba(b.red, 0.95);
    ctx.fillRect(0, 0, w, 140 * u);
    ctx.fillStyle = b.gold;
    ctx.fillRect(0, 138 * u, w, Math.max(3, 5 * u));
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.22)";
    ctx.shadowBlur = 18 * u;
    ctx.shadowOffsetY = 4 * u;
    drawHeader(icon, logo, w, h);
    ctx.restore();
    drawFitText(
      text("title").toUpperCase(),
      L.PAD * u + 78 * u,
      Math.max(90 * u, h * L.FACE_SAFE),
      w - (L.PAD * 2 + L.LOGO + 92) * u,
      {
        size: 56 * u,
        min: 28 * u,
        maxHeight: 64 * u,
        color: "#fff",
        weight: 900,
        family: b.accentFont,
      },
    );
    const blockY = portrait ? h * 0.22 : h * 0.2,
      blockH = portrait ? h * 0.44 : h * 0.42;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = 34 * u;
    ctx.shadowOffsetY = 8 * u;
    roundRect(L.PAD * u, blockY, w - L.PAD * 2 * u, blockH, 10 * u);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = rgba(b.red, 0.16);
    ctx.font = `900 ${Math.round(160 * u)}px ${b.accentFont}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText('"', L.PAD * u + 6 * u, blockY - 20 * u);
    drawWrappedText(
      `"${text("quote")}"`,
      L.PAD * u + 26 * u,
      blockY + 64 * u,
      w - L.PAD * 2 * u - 20 * u,
      {
        size: portrait ? 40 * u : 34 * u,
        min: 22 * u,
        color: b.dark,
        family: b.bodyFont,
        weight: 800,
        lineHeight: portrait ? 56 * u : 48 * u,
        align: "center",
        maxLines: 6,
        maxHeight: blockH - 80 * u,
      },
    );
    const nameY = blockY + blockH + 52 * u;
    drawFitText(text("name").toUpperCase(), w * 0.5, nameY, w * 0.74, {
      size: 58 * u,
      min: 28 * u,
      maxHeight: 68 * u,
      color: "#fff",
      weight: 900,
      align: "center",
    });
    drawFitText(
      `${text("role")}  ·  ${text("cta") || "ES Doubs"}`,
      w * 0.5,
      nameY + 62 * u,
      w * 0.72,
      {
        size: 26 * u,
        min: 16 * u,
        maxHeight: 34 * u,
        color: b.gold,
        weight: 800,
        align: "center",
        family: b.accentFont,
      },
    );
  }

  function renderCelebration({ format, photo, logo, icon }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      portrait = h >= w;
    const gap = L.GAP * u;
    drawBg(photo, w, h, 0.32);
    ctx.fillStyle = rgba(b.red, 0.78);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = rgba(b.gold, 0.82);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.48, 0);
    ctx.lineTo(0, h * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(b.blue, 0.72);
    ctx.beginPath();
    ctx.moveTo(w, h);
    ctx.lineTo(w * 0.52, h);
    ctx.lineTo(w, h * 0.62);
    ctx.closePath();
    ctx.fill();
    const cc = ["#ffffff", b.gold, rgba(b.blue, 0.8)];
    for (let i = 0; i < 28; i++) {
      const cx = ((i * 137 + 217) % (w - 40)) + 20,
        cy = ((i * 97 + 119) % (h - 40)) + 20,
        r = 4 * u + (i % 4) * 3 * u;
      ctx.fillStyle = cc[i % cc.length];
      ctx.globalAlpha = 0.24 + (i % 5) * 0.06;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 14 * u;
    ctx.shadowOffsetY = 3 * u;
    drawHeader(icon, logo, w, h);
    ctx.restore();
    drawFitText(
      text("subtitle").toUpperCase(),
      L.PAD * u,
      Math.max((L.HDR_H + gap) * u + 10 * u, h * L.FACE_SAFE),
      w * 0.7,
      {
        size: 38 * u,
        min: 22 * u,
        color: b.gold,
        weight: 900,
        family: b.accentFont,
      },
    );
    drawWrappedText(
      text("title").toUpperCase(),
      L.PAD * u - 2 * u,
      portrait
        ? Math.max(304 * u, h * L.FACE_SAFE + 100 * u)
        : Math.max(272 * u, h * L.FACE_SAFE + 80 * u),
      w * 0.84,
      {
        size: portrait ? 94 * u : 76 * u,
        min: 42 * u,
        color: "#fff",
        weight: 900,
        lineHeight: portrait ? 90 * u : 72 * u,
        maxLines: 4,
        maxHeight: portrait ? 390 * u : 316 * u,
      },
    );
    drawWrappedText(
      text("details"),
      L.PAD * u + 4 * u,
      h - L.FOOT_H * u - 140 * u,
      w - L.PAD * 2 * u,
      {
        size: 30 * u,
        min: 18 * u,
        color: "rgba(255,255,255,0.92)",
        family: b.bodyFont,
        weight: 700,
        lineHeight: 44 * u,
        maxLines: 4,
        maxHeight: 144 * u,
      },
    );
    drawFooterBand([text("cta") || ""], w, h, rgba(b.dark, 0.88));
  }

  /**
   * renderList — Programme des matchs du week-end
   * Direction "Split-card" : fond très sombri, chaque match = bloc horizontal
   * avec zone heure | noms + catégorie | badge DOM/EXT
   * Séparateurs de jour en doré, pagination auto si > MAX_PER_PAGE matchs
   */
  function renderList({ format, photo, logo, icon }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h);

    // ── Constantes de mise en page ────────────────────────────
    const PAD = L.PAD * u;
    const GAP = L.GAP * u;
    // Pas de pagination — tous les matchs sont affichés, rowH s'adapte automatiquement

    // ── 1. FOND très sombre — les joueurs passent en texture ──
    drawBg(photo, w, h, 0.15);
    // Overlay uniforme très opaque → le texte prime toujours
    ctx.fillStyle = "rgba(8,10,20,0.82)";
    ctx.fillRect(0, 0, w, h);
    // Légère texture diagonale rouge en coin HG (identité ESD)
    const triGrad = ctx.createLinearGradient(0, 0, w * 0.55, h * 0.48);
    triGrad.addColorStop(0,   rgba(b.red, 0.22));
    triGrad.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = triGrad;
    ctx.fillRect(0, 0, w, h);

    // ── 2. EN-TÊTE rouge plein ────────────────────────────────
    const hdrH = (L.PAD + L.ICON) * u + 14 * u;
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, w, hdrH);
    // Liseré or bas du header
    ctx.fillStyle = b.gold;
    ctx.fillRect(0, hdrH - Math.max(3, 4 * u), w, Math.max(3, 4 * u));

    // Logo ESD sur fond blanc arrondi dans le coin HD — dessiné APRES
    // le fond rouge pour que le badge blanc soit visible
    const logoSz  = L.LOGO * u;
    const logoPad = L.PAD * u;
    const logoX   = w - logoSz - logoPad;
    const logoY   = logoPad * 0.6;
    drawLogo(logo, logoX, logoY, logoSz);

    // Icône badge HG + titre (sans appel drawHeader pour éviter
    // le double dessin du logo)
    const iconRight = (L.PAD + L.ICON) * u + 12 * u;
    const iconMidY  = (L.PAD + L.ICON * 0.72) * u;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 12 * u; ctx.shadowOffsetY = 3 * u;
    drawIconBadge(icon, logoPad, L.PAD * u * 0.6, L.ICON * u, "#fff", b.red);
    ctx.restore();
    const titleW    = w - iconRight - (L.LOGO + L.PAD + 8) * u;
    drawFitText(text("title").toUpperCase(), iconRight, iconMidY, titleW, {
      size: 56 * u, min: 28 * u, maxHeight: L.ICON * u * 0.78,
      color: "#fff", weight: 900, family: b.accentFont,
    });

    // ── 3. PILL DATE sous le header ───────────────────────────
    const pillH = 44 * u;
    const pillY = hdrH + GAP * 0.6;
    const pillW = Math.min(w - PAD * 2, 700 * u);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 10 * u; ctx.shadowOffsetY = 3 * u;
    drawPill(text("date").toUpperCase(), PAD, pillY, pillW, pillH, b.blue, "#fff");
    ctx.restore();

    // ── 4. PARSE des matchs ───────────────────────────────────
    // Format attendu par ligne :
    //   "SAM · 10h00 · U15 D1 — MORTEAU vs DOUBS 1 · Stade X"
    // On accepte aussi le format libre — on affiche la ligne telle quelle
    const allItems     = lines(text("items"));
    // Tous les matchs affichés — pas de pagination
    const visibleItems = allItems;
    const hiddenCount  = 0;

    // ── 5. RENDU des blocs matchs ─────────────────────────────
    const listTop  = pillY + pillH + GAP * 0.75;
    const footerH  = L.FOOT_H * u;
    const listBot  = h - footerH - GAP * 0.5;
    const available = listBot - listTop;
    const rowCount  = visibleItems.length + (hiddenCount > 0 ? 1 : 0);
    const rowH      = Math.max(52 * u, Math.min(110 * u, available / Math.max(rowCount, 1)));
    const nameSize  = Math.max(15 * u, Math.min(28 * u, rowH * 0.32));
    const metaSize  = Math.max(12 * u, Math.min(20 * u, rowH * 0.22));
    const rowW      = w - PAD * 2;

    visibleItems.forEach((raw, i) => {
      const ry = listTop + i * rowH;

      // Format attendu : "SAM - 10h00 - Categorie -- Equipe1 vs Equipe2 - Stade"
      // Separateurs ASCII purs : tiret simple (-) entre champs, double tiret (--) avant les noms
      let jour = "", heure = "", categorie = "", equipes = "", stade = "";
      const m = raw.match(
        /^(SAM|DIM)\s*-\s*([0-9h:]+)\s*-\s*([^-]+?)\s*--\s*(.+?)(?:\s*-\s*(.+))?$/i
      );
      if (m) {
        jour      = m[1].toUpperCase();
        heure     = m[2].trim();
        categorie = m[3].trim();
        equipes   = m[4].trim();
        stade     = (m[5] || "").trim();
      }
      const parsed = Boolean(m);

      // ── Fond de la carte ───────────────────────────────────
      // Fond légèrement plus clair sur les lignes alternées
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)";
      roundRect(PAD, ry + 2 * u, rowW, rowH - 8 * u, 10 * u);
      ctx.fill();

      if (parsed) {
        // ── ZONE HEURE (gauche, 14% de la largeur) ────────────
        const heureZoneW = rowW * 0.14;
        const heureX     = PAD + heureZoneW / 2;

        // Pastille jour (SAM=rouge, DIM=bleu)
        const jourColor = jour === "SAM" ? b.red : b.blue;
        ctx.fillStyle   = jourColor;
        const jourH     = Math.max(18 * u, rowH * 0.22);
        const jourW     = heureZoneW - 6 * u;
        const jourY     = ry + 2 * u + (rowH - 8 * u) * 0.10;
        roundRect(PAD + 3 * u, jourY, jourW, jourH, jourH * 0.35);
        ctx.fill();
        drawFitText(jour, PAD + 3 * u + jourW / 2, jourY + jourH * 0.74, jourW, {
          size: metaSize * 0.82, min: 10 * u, color: "#fff", weight: 900,
          align: "center", family: b.accentFont,
        });

        // Heure
        drawFitText(heure, PAD + 3 * u, jourY + jourH + 5 * u + nameSize * 0.9, jourW, {
          size: nameSize * 0.96, min: 12 * u, color: "#fff", weight: 900,
          align: "center", family: b.accentFont,
        });

        // ── ZONE NOMS (centre, 68% de la largeur) ─────────────
        const nameZoneX = PAD + heureZoneW + 8 * u;
        const nameZoneW = rowW * 0.68;
        const midY      = ry + 2 * u + (rowH - 8 * u) / 2;

        // Catégorie en doré, petit
        drawFitText(categorie, nameZoneX, midY - nameSize * 0.62, nameZoneW, {
          size: metaSize, min: 10 * u, color: b.gold, weight: 800, family: b.accentFont,
        });

        // Noms des équipes — partie principale
        // Détecte si "DOUBS" est dans chaque moitié
        const parts   = equipes.split(/\s+vs\s+/i);
        const team1   = (parts[0] || equipes).trim();
        const team2   = (parts[1] || "").trim();
        const hasVs   = parts.length === 2;

        if (hasVs) {
          // Ligne équipe 1 — vs — équipe 2, séparés par un tiret
          const isHome = team2.toLowerCase().includes("doubs");
          const isAway = team1.toLowerCase().includes("doubs");
          const t1Col  = isAway ? b.gold : "#fff";
          const t2Col  = isHome ? b.gold : "#fff";

          // Équipe 1
          drawFitText(team1, nameZoneX, midY + nameSize * 0.22, nameZoneW * 0.44, {
            size: nameSize, min: 11 * u, color: t1Col, weight: 900, family: b.accentFont,
          });
          // "–" central
          drawFitText("–", nameZoneX + nameZoneW * 0.46, midY + nameSize * 0.22, nameZoneW * 0.08, {
            size: nameSize, min: 11 * u, color: "rgba(255,255,255,0.45)", weight: 700, align: "center",
          });
          // Équipe 2
          drawFitText(team2, nameZoneX + nameZoneW * 0.56, midY + nameSize * 0.22, nameZoneW * 0.44, {
            size: nameSize, min: 11 * u, color: t2Col, weight: 900, family: b.accentFont,
          });
        } else {
          // Ligne brute si pas de "vs"
          drawFitText(equipes, nameZoneX, midY + nameSize * 0.22, nameZoneW, {
            size: nameSize, min: 11 * u, color: "#fff", weight: 900, family: b.accentFont,
          });
        }

        // Stade en petit dessous
        if (stade) {
          drawFitText("@ " + stade, nameZoneX, midY + nameSize * 1.06, nameZoneW, {
            size: metaSize * 0.88, min: 9 * u, color: "rgba(255,255,255,0.55)", weight: 600,
            family: b.bodyFont,
          });
        }

        // ── BADGE DOM/EXT (droite, 18%) ────────────────────────
        const badgeZoneX = PAD + heureZoneW + 8 * u + rowW * 0.68 + 8 * u;
        const badgeW     = rowW - heureZoneW - rowW * 0.68 - 16 * u;
        const badgeH2    = Math.max(22 * u, rowH * 0.28);
        const badgeY     = ry + 2 * u + (rowH - 8 * u) / 2 - badgeH2 / 2;

        // DOM/EXT : DOUBS en team1 (gauche) = équipe qui reçoit = DOMICILE
        //           DOUBS en team2 (droite) = équipe qui se déplace = EXTÉRIEUR
        const doubsIsTeam1 = team1.toUpperCase().includes("DOUBS");
        const doubsIsTeam2 = team2.toUpperCase().includes("DOUBS");
        const isHome  = doubsIsTeam1;   // DOUBS joue à domicile (côté gauche)
        const isAway  = doubsIsTeam2;   // DOUBS joue à l'extérieur (côté droite)
        const badgeLabel  = isHome ? "DOMICILE" : "EXTERIEUR";
        const badgeColor  = isHome ? b.red : b.blue;

        drawPill(badgeLabel, badgeZoneX, badgeY, Math.min(badgeW, 160 * u), badgeH2, badgeColor, "#fff");

      } else {
        // ── Ligne brute (format non structuré) ────────────────
        const midY = ry + 2 * u + (rowH - 8 * u) * 0.60;
        drawFitText(raw, PAD + 12 * u, midY, rowW - 24 * u, {
          size: nameSize, min: 12 * u, color: "#fff", weight: 800, family: b.accentFont,
        });
      }
    });

    // ── Mention "+ N matchs" si pagination ───────────────────
    if (hiddenCount > 0) {
      const moreY = listTop + visibleItems.length * rowH + 6 * u;
      drawFitText(
        `+ ${hiddenCount} autre${hiddenCount > 1 ? "s" : ""} match${hiddenCount > 1 ? "s" : ""} — voir le programme complet`,
        PAD, moreY + 20 * u, w - PAD * 2,
        { size: 18 * u, min: 12 * u, color: rgba(b.gold, 0.82), weight: 700, family: b.bodyFont },
      );
    }

    // ── FOOTER ────────────────────────────────────────────────
    drawFooterBand([text("footer") || "Allez l'ES Doubs !"], w, h, rgba(b.dark, 0.96));
  }

  function renderTable({ format, photo, logo, icon }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h);
    const gap = L.GAP * u;
    drawBg(photo, w, h, 0.52);
    drawBottomFade(w, h, 0.38);
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, w, 20 * u);
    ctx.fillStyle = b.gold;
    ctx.fillRect(0, 20 * u, w, Math.max(2, 4 * u));
    drawHeader(icon, logo, w, h);

    // ── Titre aligné sur la ligne de l'icône (même hauteur que le badge) ──
    // Sur l'affiche : "CLASSEMENT" est à droite de l'icône trophée,
    // dans la même zone horizontale (pas en-dessous).
    const iconSz  = L.ICON * u;                // hauteur du badge icône
    const iconBot = L.PAD * u + iconSz;        // bas du badge icône
    const titleX  = L.PAD * u + iconSz + 16 * u;  // juste à droite de l'icône
    const titleW  = w - titleX - L.LOGO * u - L.PAD * 2 * u; // jusqu'au logo ESD
    // Baseline du titre : centre vertical de l'icône
    const titleY  = L.PAD * u + iconSz * 0.72;

    drawFitText(text("title").toUpperCase(), titleX, titleY, titleW, {
      size: 80 * u,
      min: 42 * u,
      maxHeight: 96 * u,
      color: "#fff",
      weight: 900,
    });

    // Sous-titre en doré, sous le titre avec un petit écart
    drawFitText(text("subtitle"), titleX, titleY + 42 * u, titleW, {
      size: 28 * u,
      min: 14 * u,
      color: b.gold,
      weight: 800,
      family: b.accentFont,
    });

    // Tableau démarre sous l'en-tête
    const boxX = L.PAD * u,
      boxY = iconBot + gap + 28 * u,
      boxW = w - L.PAD * 2 * u,
      avail = h - boxY - L.FOOT_H * u - gap;
    const rowItems = limitVisibleLines(
      lines(text("items")),
      Math.max(1, Math.floor(avail / (46 * u))),
    );
    const rowH = Math.max(
      42 * u,
      Math.min(80 * u, avail / Math.max(rowItems.length, 1)),
    );
    rowItems.forEach((row, i) => {
      const ry = boxY + i * rowH;
      // ── Détection ligne ES Doubs ──────────────────────────
      // La ligne contenant "doubs" est surlignée en rouge,
      // quelle que soit sa position dans le classement.
      const isESD = row.toLowerCase().includes("doubs");

      ctx.fillStyle = isESD
        ? b.red                         // rouge si c'est ES Doubs
        : i % 2
          ? rgba("#ffffff", 0.20)       // gris clair pair
          : rgba("#ffffff", 0.12);      // gris foncé impair
      roundRect(boxX, ry, boxW, rowH - 8 * u, 6 * u);
      ctx.fill();

      // Numéro de rang
      ctx.save();
      ctx.fillStyle = isESD ? b.gold : rgba("#ffffff", 0.55);
      ctx.font = `900 ${Math.round(Math.min(26 * u, rowH * 0.4))}px ${b.bodyFont}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(String(i + 1), boxX + 30 * u, ry + rowH * 0.66);
      ctx.restore();

      // Texte de la ligne
      drawFitText(
        row.replace(/^\d+\.\s*/, ""),
        boxX + 56 * u,
        ry + rowH * 0.66,
        boxW - 72 * u,
        {
          size: Math.min(30 * u, rowH * 0.42),
          min: 16 * u,
          // Blanc sur fond rouge (ESD) ou blanc classique
          color: "#fff",
          weight: isESD ? 900 : 800,
        },
      );
    });
    drawFitText(
      text("footer") || "",
      L.PAD * u,
      h - 50 * u,
      w - L.PAD * 2 * u,
      {
        size: 24 * u,
        min: 14 * u,
        color: rgba(b.gold, 0.9),
        weight: 800,
        align: "center",
        family: b.bodyFont,
        clip: false,
      },
    );
  }

  function renderGallery({ format, photo, logo, icon, gallery }) {
    const { width: w, height: h } = format,
      b = state.brand,
      u = unit(w, h),
      portrait = h >= w;
    const gap = L.GAP * u;
    ctx.fillStyle = "#f4f6f9";
    ctx.fillRect(0, 0, w, h);
    const headerH = portrait ? 128 * u : 116 * u;
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, w, headerH);
    ctx.fillStyle = b.gold;
    ctx.fillRect(0, headerH - Math.max(3, 5 * u), w, Math.max(3, 5 * u));
    drawHeader(icon, logo, w, h);
    drawFitText(
      text("title").toUpperCase(),
      L.PAD * u + 78 * u,
      headerH * 0.68,
      w - (L.PAD * 2 + L.LOGO + 92) * u,
      {
        size: 58 * u,
        min: 26 * u,
        maxHeight: 64 * u,
        color: "#fff",
        weight: 900,
        family: b.accentFont,
      },
    );
    const footerY = h - 92 * u;
    const thumbH = Math.min(portrait ? 180 * u : 158 * u, h * 0.13);
    const reservedTextH = portrait ? 210 * u : 146 * u;
    const mainY = headerH + gap,
      mainH = Math.max(
        180 * u,
        Math.min(
          portrait ? h * 0.46 : h * 0.36,
          footerY - headerH - gap * 2 - thumbH - reservedTextH,
        ),
      );
    drawCover(photo, L.PAD * u, mainY, w - L.PAD * 2 * u, mainH, b.dark);
    const thumbsY = mainY + mainH + gap,
      thumbs = (gallery.length ? gallery : [photo, photo, photo]).filter(
        Boolean,
      );
    const thumbW = (w - L.PAD * 2 * u - gap * 2) / 3;
    thumbs
      .slice(0, 3)
      .forEach((img, i) =>
        drawCover(
          img,
          L.PAD * u + i * (thumbW + gap),
          thumbsY,
          thumbW,
          thumbH,
          "#ccc",
        ),
      );
    const textY = thumbsY + thumbH + (portrait ? 50 : 38) * u;
    drawFitText(text("subtitle"), w * 0.5, textY, w - L.PAD * 2 * u, {
      size: 40 * u,
      min: 22 * u,
      color: b.dark,
      weight: 900,
      align: "center",
      maxHeight: 48 * u,
    });
    const detailY = textY + (portrait ? 58 : 46) * u;
    const detailMaxH = Math.max(42 * u, footerY - detailY - 18 * u);
    drawWrappedText(
      text("details"),
      L.PAD * u + 18 * u,
      detailY,
      w - L.PAD * 2 * u,
      {
        size: portrait ? 26 * u : 23 * u,
        min: 16 * u,
        color: "#555",
        family: b.bodyFont,
        weight: 700,
        lineHeight: portrait ? 38 * u : 32 * u,
        align: "center",
        maxLines: portrait ? 3 : 2,
        maxHeight: Math.min(132 * u, detailMaxH),
      },
    );
    ctx.fillStyle = b.blue;
    ctx.fillRect(0, footerY, w, 92 * u);
    drawFitText(
      (text("cta") || "@esdoubs").toUpperCase(),
      L.PAD * u,
      h - 34 * u,
      w - L.PAD * 2 * u,
      {
        size: 30 * u,
        min: 16 * u,
        color: "#fff",
        weight: 900,
        align: "center",
        family: b.accentFont,
        clip: false,
      },
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  HELPERS CANVAS
  // ═══════════════════════════════════════════════════════════

  function drawCover(img, x, y, w, h, fallback) {
    if (!img) {
      ctx.fillStyle = fallback || "#d9dee8";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      for (let i = -h; i < w; i += 64) {
        ctx.fillRect(x + i, y, 20, h * 2);
      }
      return;
    }
    const s = Math.max(w / img.width, h / img.height),
      sw = img.width * s,
      sh = img.height * s;
    ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
  }

  function drawContain(img, x, y, w, h) {
    if (!img) return;
    const s = Math.min(w / img.width, h / img.height),
      sw = img.width * s,
      sh = img.height * s;
    ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
  }

  function drawLogo(logo, x, y, size) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 12 * unit(size, size);
    roundRect(x, y, size, size, size * 0.1);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    if (logo)
      drawContain(logo, x + size * 0.1, y + size * 0.1, size * 0.8, size * 0.8);
    ctx.restore();
  }

  function drawIconBadge(icon, x, y, size, fillColor, accentColor) {
    ctx.save();
    ctx.fillStyle = fillColor || "#ffffff";
    roundRect(x, y, size, size, size * 0.14);
    ctx.fill();
    ctx.fillStyle = accentColor || state.brand.red;
    ctx.fillRect(x, y + size * 0.76, size, size * 0.24);
    if (icon)
      drawContain(
        icon,
        x + size * 0.16,
        y + size * 0.1,
        size * 0.68,
        size * 0.62,
      );
    ctx.restore();
  }

  function drawPartnerBadge(partnerLogos, w, h, u) {
    if (!partnerLogos?.length) return;
    // Max 3 logos — affichage en ligne horizontale (1, 2 ou 3 côte à côte)
    const logos  = partnerLogos.filter(Boolean).slice(0, 3);
    const count  = logos.length;
    const pad    = 18 * u;
    const gap    = 10 * u;
    // Taille max par logo selon le nombre : plus il y en a, plus ils réduisent
    const maxH   = h * 0.11;
    const maxW   = (w - pad * 2 - gap * (count - 1)) / count;
    const base   = (state.partnerLogoSize || 120) * u;
    const size   = Math.min(base, maxW, maxH, count === 1 ? 110 * u : count === 2 ? 90 * u : 74 * u);
    const totalW = count * size + gap * (count - 1);

    // Position
    let x = pad, y = h - size - pad;
    if (state.partnerLogoPosition === "bottom-right")  { x = w - totalW - pad; }
    else if (state.partnerLogoPosition === "top-left") { y = pad; }
    else if (state.partnerLogoPosition === "top-right"){ x = w - totalW - pad; y = pad; }

    logos.forEach((logoImg, i) => {
      const lx = x + i * (size + gap);
      const ly = y;
      ctx.save();
      if (state.partnerLogoStyle === "overlay") {
        drawContain(logoImg, lx, ly, size, size);
      } else {
        ctx.fillStyle    = "rgba(255,255,255,0.95)";
        ctx.shadowColor  = "rgba(0,0,0,0.14)";
        ctx.shadowBlur   = 10 * u;
        ctx.shadowOffsetY = 2 * u;
        roundRect(lx, ly, size, size, 10 * u);
        ctx.fill();
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
        drawContain(logoImg, lx + 7 * u, ly + 7 * u, size - 14 * u, size - 14 * u);
      }
      ctx.restore();
    });
  }

  function drawOverlay(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawBottomFade(w, h, strength) {
    const g = ctx.createLinearGradient(0, h * 0.3, 0, h);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function blockGradient(x, y, w, h, topColor, bottomColor) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, topColor);
    g.addColorStop(1, bottomColor);
    return g;
  }

  function drawPill(value, x, y, w, h, fillColor, color) {
    if (w <= 0 || h <= 0) return;
    ctx.save();
    ctx.fillStyle = fillColor;
    roundRect(x, y, w, h, Math.min(8, h * 0.2));
    ctx.fill();
    drawFitText(value, x + h * 0.3, y + h * 0.68, w - h * 0.6, {
      size: h * 0.4,
      min: h * 0.26,
      color,
      weight: 900,
      maxHeight: h * 0.54,
      align: "center",
    });
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  // ═══════════════════════════════════════════════════════════
  //  HELPERS TEXTE
  // ═══════════════════════════════════════════════════════════

  function normalizeCanvasText(v, keepBreaks) {
    const s = String(v || "").replace(/\r/g, "");
    if (keepBreaks)
      return s
        .split("\n")
        .map((l) => l.replace(/\s+/g, " ").trim())
        .join("\n")
        .trim();
    return s.replace(/\s+/g, " ").trim();
  }

  function setFont(size, weight, family) {
    ctx.font = `${weight} ${Math.max(1, Math.round(size))}px ${family || state.brand.titleFont}`;
  }

  function truncateText(v, maxWidth) {
    const clean = normalizeCanvasText(v);
    if (!clean || maxWidth <= 0) return "";
    if (ctx.measureText(clean).width <= maxWidth) return clean;
    if (ctx.measureText(ELLIPSIS).width > maxWidth) return "";
    const chars = Array.from(clean);
    let lo = 0,
      hi = chars.length,
      best = "";
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2),
        cand = `${chars.slice(0, mid).join("").trimEnd()}${ELLIPSIS}`;
      if (ctx.measureText(cand).width <= maxWidth) {
        best = cand;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return best;
  }

  function wrapText(v, maxWidth) {
    const out = [];
    String(v || "")
      .split("\n")
      .forEach((para) => {
        const words = para.trim().split(/\s+/).filter(Boolean);
        if (!words.length) return;
        let line = "";
        words.forEach((w) => {
          const cand = line ? `${line} ${w}` : w;
          if (ctx.measureText(cand).width <= maxWidth) {
            line = cand;
            return;
          }
          if (line) out.push(line);
          if (ctx.measureText(w).width <= maxWidth) {
            line = w;
            return;
          }
          const chunks = breakLongWord(w, maxWidth);
          out.push(...chunks.slice(0, -1));
          line = chunks[chunks.length - 1] || "";
        });
        if (line) out.push(line);
      });
    return out;
  }

  function breakLongWord(word, maxWidth) {
    const chunks = [];
    let chunk = "";
    Array.from(String(word || "")).forEach((c) => {
      const cand = chunk + c;
      if (ctx.measureText(cand).width <= maxWidth || !chunk) {
        chunk = cand;
        return;
      }
      chunks.push(chunk);
      chunk = c;
    });
    if (chunk) chunks.push(chunk);
    return chunks;
  }

  function resolveTextBoxX(x, maxWidth, align) {
    if (
      align === "center" &&
      x + maxWidth > canvas.width * 1.04 &&
      x - maxWidth / 2 >= 0
    )
      return x - maxWidth / 2;
    if (align === "right" && x - maxWidth >= 0) return x - maxWidth;
    return x;
  }

  function xForAlign(x, maxWidth, align) {
    if (align === "center") return x + maxWidth / 2;
    if (align === "right") return x + maxWidth;
    return x;
  }

  function clipTextBox(x, y, maxWidth, maxHeight, size, align) {
    const bx = resolveTextBoxX(x, maxWidth, align);
    ctx.beginPath();
    ctx.rect(
      bx,
      y - size,
      maxWidth,
      Math.max(size * 1.25, maxHeight || size * 1.35),
    );
    ctx.clip();
    return bx;
  }

  function drawFitText(v, x, y, maxWidth, options) {
    const align = options.align || "left",
      family = options.family || state.brand.titleFont,
      weight = options.weight || 800;
    let txt = normalizeCanvasText(v);
    if (!txt || maxWidth <= 0) return;
    let size = Math.min(
      options.size,
      options.maxHeight ? options.maxHeight * 0.86 : options.size,
    );
    const minSize = options.min || size * 0.52,
      maxH = options.maxHeight || size * 1.25;
    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    while (size > minSize) {
      setFont(size, weight, family);
      if (ctx.measureText(txt).width <= maxWidth) break;
      size -= 2;
    }
    setFont(size, weight, family);
    if (ctx.measureText(txt).width > maxWidth)
      txt = truncateText(txt, maxWidth);
    if (options.clip !== false) clipTextBox(x, y, maxWidth, maxH, size, align);
    const bx = resolveTextBoxX(x, maxWidth, align),
      dx = xForAlign(bx, maxWidth, align);
    if (options.stroke && txt) {
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(3, size * 0.08);
      ctx.strokeStyle = options.stroke;
      ctx.strokeText(txt, dx, y, maxWidth);
    }
    ctx.fillStyle = options.color || state.brand.dark;
    ctx.fillText(txt, dx, y, maxWidth);
    ctx.restore();
  }

  function drawWrappedText(v, x, y, maxWidth, options) {
    const txt = normalizeCanvasText(v, true);
    if (!txt || maxWidth <= 0) return;
    const align = options.align || "left",
      family = options.family || state.brand.titleFont,
      weight = options.weight || 700;
    const origSize = options.size || 24,
      minSize = options.min || origSize * 0.52;
    const lineRatio = options.lineHeight ? options.lineHeight / origSize : 1.18;
    const maxLines = Math.max(1, options.maxLines || 8),
      maxH = options.maxHeight || Infinity;
    let size = origSize,
      lineH = size * lineRatio,
      vis = maxLines,
      wrapped = [];
    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = options.color || state.brand.dark;
    while (size >= minSize) {
      setFont(size, weight, family);
      lineH = Math.max(size * 1.05, size * lineRatio);
      const hlim = Number.isFinite(maxH)
        ? Math.max(1, Math.floor((maxH + size * 0.18) / lineH))
        : maxLines;
      vis = Math.max(1, Math.min(maxLines, hlim));
      wrapped = wrapText(txt, maxWidth);
      if (wrapped.length <= vis) break;
      size -= 2;
    }
    setFont(size, weight, family);
    lineH = Math.max(size * 1.05, size * lineRatio);
    const hlim = Number.isFinite(maxH)
      ? Math.max(1, Math.floor((maxH + size * 0.18) / lineH))
      : maxLines;
    vis = Math.max(1, Math.min(maxLines, hlim));
    if (wrapped.length > vis) {
      wrapped = wrapped.slice(0, vis);
      wrapped[wrapped.length - 1] = truncateText(
        wrapped[wrapped.length - 1],
        maxWidth,
      );
    } else {
      wrapped = wrapped.map((l) => truncateText(l, maxWidth));
    }
    const bx =
      options.clip === false
        ? resolveTextBoxX(x, maxWidth, align)
        : clipTextBox(
            x,
            y,
            maxWidth,
            Number.isFinite(maxH) ? maxH : vis * lineH,
            size,
            align,
          );
    const dx = xForAlign(bx, maxWidth, align);
    wrapped.forEach((line, i) => {
      ctx.fillText(line, dx, y + i * lineH, maxWidth);
    });
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════
  //  HELPERS UTILITAIRES
  // ═══════════════════════════════════════════════════════════

  function unit(w, h) {
    return Math.min(w, h) / 1080;
  }
  function text(key) {
    return state.fields[key] || "";
  }
  function lines(v) {
    return String(v || "")
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }

  function limitVisibleLines(items, maxItems) {
    const limit = Math.max(1, Math.floor(maxItems || 1));
    if (items.length <= limit) return items;
    const vis = items.slice(0, limit),
      hidden = items.length - limit + 1;
    vis[vis.length - 1] =
      `+ ${hidden} autre${hidden > 1 ? "s" : ""}${ELLIPSIS}`;
    return vis;
  }

  function rgba(hex, alpha) {
    const n = String(hex || "#000").replace("#", ""),
      v = parseInt(n.length === 3 ? n.replace(/(.)/g, "$1$1") : n, 16);
    return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${alpha})`;
  }

  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (imageCache.has(src)) return Promise.resolve(imageCache.get(src));
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        imageCache.set(src, img);
        resolve(img);
      };
      img.onerror = () => {
        console.warn("Image introuvable", src);
        resolve(null);
      };
      img.src = src;
    });
  }

  function readJson(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      console.warn(e);
      return fallback;
    }
  }
  function getTemplate(id) {
    return data.templates.find((t) => t.id === id) || data.templates[0];
  }
  function getCategory(id) {
    return data.categories.find((c) => c.id === id) || data.categories[0];
  }
  function getFormat(id) {
    return data.formats.find((f) => f.id === id) || data.formats[0];
  }

  function makeFilename(ext) {
    const t = getTemplate(state.templateId),
      f = getFormat(state.formatId),
      d = new Date().toISOString().slice(0, 10);
    return `${slug(t.name)}-${f.id}-${d}.${ext}`;
  }

  function slug(v) {
    return String(v)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  function setStatus(v) {
    els.autosaveState.textContent = v;
  }
  function setStatusState(stateClass, text) {
    els.autosaveState.className = stateClass;
    els.autosaveState.textContent = text;
    setTimeout(() => {
      els.autosaveState.className = "";
    }, 2000);
  }
  function escapeHtml(v) {
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  function downloadUrl(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    downloadUrl(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ═══════════════════════════════════════════════════════════
  //  ERGONOMIE
  // ═══════════════════════════════════════════════════════════

  function toggleShortcuts() {
    const isHidden = els.shortcutsOverlay.hasAttribute("hidden");
    els.shortcutsOverlay.toggleAttribute("hidden", !isHidden);
    els.shortcutsToggle.classList.toggle("active", isHidden);
    els.shortcutsToggle.setAttribute("aria-pressed", String(isHidden));
    if (isHidden) els.closeShortcuts.focus();
  }

  function closeShortcuts() {
    els.shortcutsOverlay.setAttribute("hidden", "");
    els.shortcutsToggle.classList.remove("active");
    els.shortcutsToggle.setAttribute("aria-pressed", "false");
    els.shortcutsToggle.focus();
  }

  function bindShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !els.shortcutsOverlay.hasAttribute("hidden")) {
        closeShortcuts();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const grid = els.templateGrid;
        if (
          document.activeElement === grid ||
          grid.contains(document.activeElement)
        ) {
          e.preventDefault();
          const items = [...grid.querySelectorAll(".template-card")];
          if (!items.length) return;
          const current = items.findIndex((btn) =>
            btn.classList.contains("active"),
          );
          let next = current + (e.key === "ArrowDown" ? 1 : -1);
          if (next < 0) next = items.length - 1;
          if (next >= items.length) next = 0;
          items[next]?.focus();
          return;
        }
      }
      if (
        e.key === "Enter" &&
        document.activeElement?.classList.contains("template-card")
      ) {
        const btn = document.activeElement;
        if (btn?.dataset.templateId) {
          e.preventDefault();
          selectTemplate(btn.dataset.templateId);
        }
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        saveCurrentDesign();
      } else if (key === "p") {
        e.preventDefault();
        exportImage("image/png", "png");
      } else if (key === "j") {
        e.preventDefault();
        exportImage("image/jpeg", "jpg");
      } else if (key === "e") {
        e.preventDefault();
        exportPdf();
      } else if (key === "r") {
        e.preventDefault();
        selectTemplate(state.templateId);
        setStatus("Modèle réinitialisé");
      } else if (key === "f") {
        e.preventDefault();
        els.templateSearch.focus();
      }
    });
    window.addEventListener("beforeunload", (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  function markModified(label) {
    if (!label) return;
    label.classList.add("modified");
    hasUnsavedChanges = true;
  }

  function clearModified() {
    hasUnsavedChanges = false;
    document
      .querySelectorAll(".field-stack label.modified")
      .forEach((l) => l.classList.remove("modified"));
  }

  function setLoading(loading) {
    const stage = document.querySelector(".canvas-stage");
    if (!stage) return;
    stage.classList.toggle("loading", loading);
  }

  // ═══════════════════════════════════════════════════════════
  //  EXPORT
  // ═══════════════════════════════════════════════════════════

  async function exportImage(type, ext) {
    setLoading(true);
    const filename = makeFilename(ext);
    try {
      const blob = await canvasToBlob(
        type,
        type === "image/jpeg" ? 1 : undefined,
      );
      downloadBlob(blob, filename);
      setStatusState("success", `${ext.toUpperCase()} exporté`);
    } catch (e) {
      console.error(e);
      setStatusState("error", "Export bloqué par le navigateur");
    } finally {
      setLoading(false);
    }
  }

  async function exportPdf() {
    setLoading(true);
    try {
      const imageBlob = await canvasToBlob("image/jpeg", 1);
      const bytes = await blobToBytes(imageBlob);
      const blob = createPdfFromJpegBytes(bytes, canvas.width, canvas.height);
      downloadBlob(blob, makeFilename("pdf"));
      setStatusState("success", "PDF exporté");
    } catch (e) {
      console.error(e);
      setStatusState("error", "PDF impossible à générer");
    } finally {
      setLoading(false);
    }
  }

  function canvasToBlob(type, quality) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("Canvas export failed")),
          type,
          quality,
        );
        return;
      }
      try {
        resolve(dataUrlToBlob(canvas.toDataURL(type, quality)));
      } catch (e) {
        reject(e);
      }
    });
  }

  function dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(",");
    const meta = parts[0] || "";
    const mime =
      (meta.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
    const bin = atob(parts[1] || "");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function blobToBytes(blob) {
    if (blob.arrayBuffer) {
      return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  function createPdfFromJpegBytes(bytes, W, H) {
    const enc = new TextEncoder(),
      parts = [],
      offsets = [0];
    let off = 0;
    const add = (t) => {
      const b = enc.encode(t);
      parts.push(b);
      off += b.length;
    };
    const addB = (b) => {
      parts.push(b);
      off += b.length;
    };
    const bObj = (n) => {
      offsets[n] = off;
      add(`${n} 0 obj\n`);
    };
    const eObj = () => add("\nendobj\n");
    const cnt = `q\n${W} 0 0 ${H} 0 0 cm\n/Im0 Do\nQ\n`;
    add("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
    bObj(1);
    add("<< /Type /Catalog /Pages 2 0 R >>");
    eObj();
    bObj(2);
    add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    eObj();
    bObj(3);
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    );
    eObj();
    bObj(4);
    add(
      `<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`,
    );
    addB(bytes);
    add("\nendstream");
    eObj();
    bObj(5);
    add(`<< /Length ${enc.encode(cnt).length} >>\nstream\n${cnt}endstream`);
    eObj();
    const xOff = off;
    add("xref\n0 6\n0000000000 65535 f \n");
    for (let i = 1; i <= 5; i++)
      add(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
    add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xOff}\n%%EOF`);
    return new Blob(parts, { type: "application/pdf" });
  }

  function init() {
    bindEvents();
    bindShortcuts();
    buildFormatSelect();
    selectTemplate(data.templates[0].id);
  }

  // ─────────────────────────────────────────────
  init();
})();
