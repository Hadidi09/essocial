(function () {
  "use strict";

  const data = window.ESD_APP_DATA;
  const STORAGE_KEY = "esd-studio-saved-designs";
  const BRAND_KEY = "esd-studio-brand";
  const LOGO_SRC = "assets/images/esd_logo.png";
  const ELLIPSIS = "\u2026";

  const canvas = document.getElementById("designCanvas");
  const ctx = canvas.getContext("2d");

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
    partnerUpload: document.getElementById("partnerUpload"),
    partnerSize: document.getElementById("partnerSize"),
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
  };

  const imageCache = new Map();
  const DRAFT_KEY = "esd-studio-drafts";
  let selectedCategory = data.categories[0].id;
  let searchTerm = "";
  let renderFrame = 0;
  let renderVersion = 0;

  const savedBrand = readJson(BRAND_KEY, null);
  const state = {
    templateId: data.templates[0].id,
    formatId: data.templates[0].defaultFormat,
    fields: {},
    imageSrc: data.templates[0].defaultImage,
    homeLogoSrc: "",
    awayLogoSrc: "",
    partnerLogoSrc: "",
    partnerLogoSize: 120,
    partnerLogoPosition: "bottom-left",
    partnerLogoStyle: "badge",
    iconId: data.templates[0].defaultIcon,
    brand: { ...data.brandDefaults, ...(savedBrand || {}) },
  };

  function init() {
    buildFormatSelect();
    bindEvents();
    applyBrandToUi();
    selectTemplate(state.templateId);
    renderSavedList();
    saveDraftDebounced();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(requestRender);
    }
  }

  function debounce(fn, wait) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
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
        partnerLogoSrc: state.partnerLogoSrc,
        iconId: state.iconId,
        brand: { ...state.brand },
        updatedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
      setStatus("Brouillon sauvegardé");
    } catch (error) {
      console.warn(error);
    }
  }

  const saveDraftDebounced = debounce(saveDraft, 700);

  function bindEvents() {
    els.templateSearch.addEventListener("input", (event) => {
      searchTerm = event.target.value.trim().toLowerCase();
      renderTemplateList();
    });

    els.formatSelect.addEventListener("change", (event) => {
      state.formatId = event.target.value;
      requestRender();
    });

    els.imageUpload.addEventListener("change", (event) => {
      handleUpload(event.target.files[0], "main");
    });

    els.homeLogoUpload.addEventListener("change", (event) => {
      handleUpload(event.target.files[0], "homeLogo");
    });

    els.awayLogoUpload.addEventListener("change", (event) => {
      handleUpload(event.target.files[0], "awayLogo");
    });

    els.partnerUpload.addEventListener("change", (event) => {
      handleUpload(event.target.files[0], "partner");
    });

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

    ["dragenter", "dragover"].forEach((type) => {
      els.dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        els.dropZone.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach((type) => {
      els.dropZone.addEventListener(type, (event) => {
        event.preventDefault();
        els.dropZone.classList.remove("dragover");
      });
    });

    els.dropZone.addEventListener("drop", (event) => {
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      handleUpload(file, "main");
    });

    els.adminToggle.addEventListener("click", () => {
      const visible = els.adminPanel.hasAttribute("hidden");
      els.adminPanel.toggleAttribute("hidden", !visible);
      els.adminToggle.classList.toggle("active", visible);
    });

    ["brandRed", "brandBlue", "brandGold", "brandDark", "brandTitleFont", "brandBodyFont"].forEach((id) => {
      els[id].addEventListener("input", updateBrandFromControls);
    });

    els.resetBrand.addEventListener("click", () => {
      state.brand = { ...data.brandDefaults };
      try {
        localStorage.removeItem(BRAND_KEY);
      } catch (error) {
        console.warn(error);
        setStatus("Réinitialisation de l'identité impossible");
      }
      applyBrandToUi();
      requestRender();
    });

    if (els.resetTemplate) {
      els.resetTemplate.addEventListener("click", resetCurrentTemplate);
    }

    els.saveDesign.addEventListener("click", saveCurrentDesign);
    els.clearSaved.addEventListener("click", () => {
      if (!confirm("Supprimer toutes les sauvegardes locales ?")) return;
      try {
        localStorage.removeItem(STORAGE_KEY);
        setStatus("Sauvegardes supprimées");
      } catch (error) {
        console.warn(error);
        setStatus("Suppression impossible (stockage indisponible)");
      }
      renderSavedList();
    });

    els.exportPng.addEventListener("click", () => exportImage("image/png", "png"));
    els.exportJpg.addEventListener("click", () => exportImage("image/jpeg", "jpg"));
    els.exportPdf.addEventListener("click", exportPdf);
  }


  function buildFormatSelect() {
    els.formatSelect.innerHTML = "";
    data.formats.forEach((format) => {
      const option = document.createElement("option");
      option.value = format.id;
      option.textContent = `${format.name} · ${format.width}×${format.height}`;
      els.formatSelect.appendChild(option);
    });
  }

  function renderCategoryTabs() {
    els.categoryTabs.innerHTML = "";
    data.categories.forEach((category) => {
      const count = data.templates.filter((template) => template.category === category.id).length;
      const isActive = category.id === selectedCategory;
      const button = document.createElement("button");
      button.type = "button";
      button.className = isActive ? "active" : "";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(isActive));
      button.setAttribute("aria-label", `${category.name} (${count} modèles)`);
      button.innerHTML = `<span>${escapeHtml(category.name)}</span><strong>${count}</strong>`;
      button.addEventListener("click", () => {
        selectedCategory = category.id;
        renderCategoryTabs();
        renderTemplateList();
      });
      els.categoryTabs.appendChild(button);
    });
  }

  function renderTemplateList() {
    renderCategoryTabs();
    const templates = data.templates.filter((template) => {
      const inCategory = template.category === selectedCategory;
      const text = `${template.name} ${template.description}`.toLowerCase();
      return inCategory && (!searchTerm || text.includes(searchTerm));
    });

    els.templateCount.textContent = String(templates.length);
    els.templateGrid.innerHTML = "";

    if (!templates.length) {
      const empty = document.createElement("p");
      empty.className = "preview-meta";
      empty.textContent = "Aucun modèle trouvé.";
      els.templateGrid.appendChild(empty);
      return;
    }

    templates.forEach((template) => {
      const isActive = template.id === state.templateId;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `template-card${isActive ? " active" : ""}`;
      button.dataset.templateId = template.id;
      button.setAttribute("aria-pressed", String(isActive));
      button.setAttribute("aria-label", `${template.name}, ${template.description}`);
      button.innerHTML = `<strong>${escapeHtml(template.name)}</strong><span>${escapeHtml(template.description)}</span>`;
      button.addEventListener("click", () => selectTemplate(template.id));
      els.templateGrid.appendChild(button);
    });
  }

  function selectTemplate(templateId, restoredState) {
    const template = getTemplate(templateId);
    state.templateId = template.id;
    state.formatId = restoredState?.formatId || template.defaultFormat || data.formats[0].id;
    state.fields = restoredState?.fields || Object.fromEntries(template.fields.map((item) => [item.key, item.value]));
    state.imageSrc = restoredState?.imageSrc || template.defaultImage || data.media[0].src;
    state.homeLogoSrc = restoredState?.homeLogoSrc || "";
    state.awayLogoSrc = restoredState?.awayLogoSrc || "";
    state.partnerLogoSrc = restoredState?.partnerLogoSrc || "";
    state.iconId = restoredState?.iconId || template.defaultIcon || data.icons[0].id;
    if (restoredState?.brand) {
      state.brand = { ...data.brandDefaults, ...restoredState.brand };
      applyBrandToUi();
    }

    // If no explicit restored state provided, attempt to load a local draft for this template
    if (!restoredState) {
      try {
        const drafts = readJson(DRAFT_KEY, {});
        const draft = drafts[template.id];
        if (draft) {
          state.fields = { ...Object.fromEntries(template.fields.map((item) => [item.key, item.value])), ...draft.fields };
          state.imageSrc = draft.imageSrc || state.imageSrc;
          state.homeLogoSrc = draft.homeLogoSrc || state.homeLogoSrc;
          state.awayLogoSrc = draft.awayLogoSrc || state.awayLogoSrc;
          state.partnerLogoSrc = draft.partnerLogoSrc || state.partnerLogoSrc;
          state.formatId = draft.formatId || state.formatId;
          state.iconId = draft.iconId || state.iconId;
          state.brand = { ...state.brand, ...(draft.brand || {}) };
          setStatus("Brouillon restauré");
        }
      } catch (error) {
        console.warn(error);
      }
    }

    selectedCategory = template.category;
    els.formatSelect.value = state.formatId;
    els.currentTemplateName.textContent = template.name;
    els.currentCategory.textContent = getCategory(template.category).name;

    renderTemplateList();
    renderFieldEditor();
    renderMediaBank();
    renderIconBank();
    requestRender();
  }

  function renderFieldEditor() {
    const template = getTemplate(state.templateId);
    els.fieldEditor.innerHTML = "";
    template.fields.forEach((item) => {
      const label = document.createElement("label");
      label.textContent = item.label;
      const input = document.createElement(item.type === "textarea" ? "textarea" : "input");
      input.id = `field-${item.key}`;
      input.dataset.key = item.key;
      const limits = fieldUiLimits(item);
      input.value = state.fields[item.key] || "";
      input.placeholder = item.value || "";
      input.maxLength = limits.maxLength;
      if (input.tagName === "TEXTAREA") {
        input.rows = limits.rows;
        input.style.minHeight = `${limits.rows * 28}px`;
      }
      input.addEventListener("input", (e) => {
        const k = e.target.dataset.key || item.key;
        state.fields[k] = e.target.value;
        requestRender();
        saveDraftDebounced();
      });
      label.appendChild(input);
      els.fieldEditor.appendChild(label);
    });
  }

  function fieldUiLimits(item) {
    const key = item.key.toLowerCase();
    if (key === "items") return { maxLength: 900, rows: 8 };
    if (["details", "quote"].includes(key)) return { maxLength: 420, rows: 5 };
    if (["title", "subtitle", "competition"].includes(key)) return { maxLength: 90, rows: 2 };
    return { maxLength: 140, rows: 3 };
  }

  function renderMediaBank() {
    els.mediaBank.innerHTML = "";
    data.media.forEach((media) => {
      const isActive = state.imageSrc === media.src;
      const button = document.createElement("button");
      button.type = "button";
      button.title = media.name;
      button.className = isActive ? "active" : "";
      button.setAttribute("aria-pressed", String(isActive));
      button.setAttribute("aria-label", `Image : ${media.name}`);
      const img = document.createElement("img");
      img.src = media.src;
      img.alt = media.name;
      button.appendChild(img);
      button.addEventListener("click", () => {
        state.imageSrc = media.src;
        renderMediaBank();
        requestRender();
      });
      els.mediaBank.appendChild(button);
    });
  }

  function renderIconBank() {
    els.iconBank.innerHTML = "";
    data.icons.forEach((icon) => {
      const isActive = state.iconId === icon.id;
      const button = document.createElement("button");
      button.type = "button";
      button.title = icon.name;
      button.className = isActive ? "active" : "";
      button.setAttribute("aria-pressed", String(isActive));
      button.setAttribute("aria-label", `Icône : ${icon.name}`);
      const img = document.createElement("img");
      img.src = icon.src;
      img.alt = icon.name;
      button.appendChild(img);
      button.addEventListener("click", () => {
        state.iconId = icon.id;
        renderIconBank();
        requestRender();
      });
      els.iconBank.appendChild(button);
    });
  }

  function handleUpload(file, target) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (target === "partner") {
        state.partnerLogoSrc = reader.result;
      } else if (target === "homeLogo") {
        state.homeLogoSrc = reader.result;
      } else if (target === "awayLogo") {
        state.awayLogoSrc = reader.result;
      } else {
        state.imageSrc = reader.result;
        renderMediaBank();
      }
      requestRender();
      setStatus("Image chargée");
      saveDraftDebounced();
    };
    reader.readAsDataURL(file);
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
      titleFont: els.brandTitleFont.value.trim() || data.brandDefaults.titleFont,
      bodyFont: els.brandBodyFont.value.trim() || data.brandDefaults.bodyFont,
    };
    try {
      localStorage.setItem(BRAND_KEY, JSON.stringify(state.brand));
    } catch (error) {
      console.warn(error);
      setStatus("Identité non sauvegardée (stockage indisponible)");
    }
    applyBrandToUi();
    requestRender();
    saveDraftDebounced();
  }

  function resetCurrentTemplate() {
    selectTemplate(state.templateId);
    setStatus("Mod\u00e8le r\u00e9initialis\u00e9");
  }

  function saveCurrentDesign() {
    const saved = readJson(STORAGE_KEY, []);
    const template = getTemplate(state.templateId);
    const item = {
      id: `${Date.now()}`,
      label: template.name,
      savedAt: new Date().toLocaleString("fr-FR"),
      templateId: state.templateId,
      formatId: state.formatId,
      fields: { ...state.fields },
      imageSrc: state.imageSrc,
      homeLogoSrc: state.homeLogoSrc,
      awayLogoSrc: state.awayLogoSrc,
      partnerLogoSrc: state.partnerLogoSrc,
      iconId: state.iconId,
      brand: { ...state.brand },
    };

    try {
      saved.unshift(item);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.slice(0, 15)));
      renderSavedList();
      setStatus("Design enregistré");
    } catch (error) {
      console.error(error);
      setStatus("Sauvegarde trop lourde");
    }
  }

  function renderSavedList() {
    const saved = readJson(STORAGE_KEY, []);
    els.savedList.innerHTML = "";
    if (!saved.length) {
      const empty = document.createElement("small");
      empty.textContent = "Aucune sauvegarde locale.";
      els.savedList.appendChild(empty);
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
      load.addEventListener("click", () => selectTemplate(item.templateId, item));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.title = "Supprimer cette sauvegarde";
      remove.setAttribute("aria-label", "Supprimer cette sauvegarde");
      remove.textContent = "\u00d7";
      remove.addEventListener("click", () => deleteSavedDesign(item.id));
      row.appendChild(load);
      row.appendChild(remove);
      els.savedList.appendChild(row);
    });
  }

  function deleteSavedDesign(id) {
    const saved = readJson(STORAGE_KEY, []);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.filter((item) => item.id !== id)));
      setStatus("Sauvegarde supprimée");
    } catch (error) {
      console.warn(error);
      setStatus("Suppression impossible (stockage indisponible)");
    }
    renderSavedList();
  }

  function requestRender() {
    cancelAnimationFrame(renderFrame);
    renderFrame = requestAnimationFrame(renderCurrent);
  }

  async function renderCurrent() {
    const version = ++renderVersion;
    const template = getTemplate(state.templateId);
    const format = getFormat(state.formatId);
    const icon = data.icons.find((item) => item.id === state.iconId) || data.icons[0];
    const gallerySources = template.layout === "gallery" ? data.media.slice(0, 5).map((item) => item.src) : [];

    canvas.width = format.width;
    canvas.height = format.height;
    els.formatMeta.textContent = `${format.width} × ${format.height} px`;
    setStatus("Rendu...");

    const [photo, logo, iconImage, homeLogo, awayLogo, partnerLogo, ...gallery] = await Promise.all([
      loadImage(state.imageSrc),
      loadImage(LOGO_SRC),
      loadImage(icon.src),
      state.homeLogoSrc ? loadImage(state.homeLogoSrc) : Promise.resolve(null),
      state.awayLogoSrc ? loadImage(state.awayLogoSrc) : Promise.resolve(null),
      state.partnerLogoSrc ? loadImage(state.partnerLogoSrc) : Promise.resolve(null),
      ...gallerySources.map(loadImage),
    ]);

    if (version !== renderVersion) return;

    renderDesign({
      template,
      format,
      photo,
      logo,
      icon: iconImage,
      homeLogo,
      awayLogo,
      partnerLogo,
      gallery: gallery.filter(Boolean),
    });

    setStatus("Aperçu à jour");
  }

  function renderDesign(assets) {
    const { template, format } = assets;
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
      portrait: renderPortrait,
      transfer: renderTransfer,
      sponsor: renderSponsor,
      info: renderInfo,
      gallery: renderGallery,
      quote: renderQuote,
      celebration: renderCelebration,
      recruitment: renderRecruitment,
    };

    const renderer = renderers[template.layout] || renderInfo;
    renderer(assets);
    if (assets.partnerLogo && template.layout !== "sponsor") {
      drawPartnerBadge(assets.partnerLogo, format.width, format.height, unit(format.width, format.height));
    }
  }

  function ensureTextBelowIcon(requestedY, iconY, iconSize, gap = 30) {
    return Math.max(requestedY, iconY + iconSize + gap);
  }

  function renderMatch({ format, photo, logo, icon }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    drawCover(photo, 0, 0, w, h, b.dark);
    drawOverlay(0, 0, w, h, "rgba(0,0,0,0.24)");
    drawBottomFade(w, h, 0.7);

    ctx.fillStyle = rgba(b.red, 0.9);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.58);
    ctx.lineTo(w * 0.42, h * 0.5);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = rgba(b.blue, 0.86);
    ctx.beginPath();
    ctx.moveTo(w * 0.55, h);
    ctx.lineTo(w, h * 0.73);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    drawIconBadge(icon, 46 * u, 42 * u, 74 * u, b.white, b.red);
    drawLogo(logo, w - 150 * u, 34 * u, 112 * u);

    const titleX = 150 * u;
    const titleWidth = w * 0.56;
    drawFitText(text("title").toUpperCase(), titleX, 170 * u, titleWidth, {
      size: h > w ? 92 * u : 70 * u,
      min: 44 * u,
      maxHeight: 104 * u,
      color: b.white,
      weight: 900,
      stroke: b.red,
    });

    drawPill(text("competition"), titleX, 226 * u, Math.min(360 * u, w * 0.45), 42 * u, b.red, b.white);

    const portrait = h > w;
    const panelY = portrait ? h - 520 * u : h - 420 * u;
    const teamSize = portrait ? 54 * u : 42 * u;
    const vsSize = portrait ? 40 * u : 34 * u;
    const timeSize = portrait ? 34 * u : 30 * u;
    const locationSize = portrait ? 24 * u : 22 * u;
    const teamLine = panelY + (portrait ? 72 * u : 80 * u);
    const vsLine = panelY + (portrait ? 142 * u : 150 * u);
    const timeLine = panelY + (portrait ? 212 * u : 220 * u);
    const locationLine = panelY + (portrait ? 266 * u : 276 * u);

    drawWrappedText(text("homeTeam").toUpperCase(), 48 * u, teamLine, w * 0.86, {
      size: teamSize,
      color: b.white,
      weight: 900,
      lineHeight: teamSize * 1.05,
      maxLines: 2,
      maxHeight: teamSize * 2.4,
    });
    drawWrappedText(`VS ${text("awayTeam").toUpperCase()}`, 48 * u, vsLine, w * 0.86, {
      size: vsSize,
      color: b.gold,
      weight: 900,
      lineHeight: vsSize * 1.05,
      maxLines: 1,
    });
    drawWrappedText(`${text("time")} · ${text("date")}`, 50 * u, timeLine, w * 0.82, {
      size: timeSize,
      min: timeSize * 0.7,
      color: b.white,
      weight: 800,
      maxLines: 2,
      maxHeight: timeSize * 2.3,
    });
    drawWrappedText(text("location"), 50 * u, locationLine, w * 0.82, {
      size: locationSize,
      min: locationSize * 0.7,
      color: b.white,
      weight: 700,
      family: b.bodyFont,
      maxLines: 2,
      maxHeight: locationSize * 2.4,
    });
    drawFooterBrand(w, h, logo);
  }

  function renderMatchVs({ format, photo, logo, icon, homeLogo, awayLogo }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);

    drawCover(photo, 0, 0, w, h, b.dark);
    drawOverlay(0, 0, w, h, "rgba(0,0,0,0.32)");
    drawBottomFade(w, h, 0.6);

    drawIconBadge(icon, 46 * u, 42 * u, 74 * u, b.white, b.red);
    drawLogo(logo, w - 150 * u, 34 * u, 112 * u);

    const titleX = 80 * u;
    const titleWidth = w - 160 * u;
    drawFitText(text("title").toUpperCase(), titleX, 160 * u, titleWidth, {
      size: h > w ? 84 * u : 68 * u,
      min: 38 * u,
      maxHeight: 110 * u,
      color: b.white,
      weight: 900,
      stroke: b.red,
    });
    drawPill(text("competition"), titleX, 230 * u, Math.min(420 * u, titleWidth), 44 * u, b.red, b.white);

    const contentY = 310 * u;
    const panelPadding = 32 * u;
    const cardWidth = (w - panelPadding * 3) / 2;
    const cardHeight = Math.min(h - contentY - 180 * u, 520 * u);
    const leftCardX = panelPadding;
    const rightCardX = w - cardWidth - panelPadding;
    const cardY = contentY;
    const badgeSize = Math.min(160 * u, cardWidth * 0.6);

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(leftCardX, cardY, cardWidth, cardHeight, 28 * u);
    ctx.fill();
    roundRect(rightCardX, cardY, cardWidth, cardHeight, 28 * u);
    ctx.fill();
    ctx.restore();

    const logoX = leftCardX + (cardWidth - badgeSize) / 2;
    const logoY = cardY + 42 * u;
    if (homeLogo) {
      drawContain(homeLogo, logoX, logoY, badgeSize, badgeSize);
    } else {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      roundRect(logoX, logoY, badgeSize, badgeSize, 22 * u);
      ctx.fill();
      ctx.restore();
    }

    drawWrappedText(text("homeTeam").toUpperCase(), leftCardX + 24 * u, logoY + badgeSize + 54 * u, cardWidth - 48 * u, {
      size: 42 * u,
      min: 26 * u,
      color: b.white,
      weight: 900,
      align: "center",
      lineHeight: 46 * u,
      maxLines: 2,
    });
    drawWrappedText(`${text("date")} · ${text("time")}`, leftCardX + 24 * u, logoY + badgeSize + 120 * u, cardWidth - 48 * u, {
      size: 26 * u,
      min: 18 * u,
      color: b.gold,
      weight: 800,
      align: "center",
      maxLines: 1,
    });
    drawWrappedText(text("location"), leftCardX + 24 * u, logoY + badgeSize + 158 * u, cardWidth - 48 * u, {
      size: 22 * u,
      min: 16 * u,
      color: b.white,
      family: b.bodyFont,
      weight: 700,
      align: "center",
      maxLines: 2,
    });

    const awayLogoX = rightCardX + (cardWidth - badgeSize) / 2;
    if (awayLogo) {
      drawContain(awayLogo, awayLogoX, logoY, badgeSize, badgeSize);
    } else {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      roundRect(awayLogoX, logoY, badgeSize, badgeSize, 22 * u);
      ctx.fill();
      ctx.restore();
    }

    drawWrappedText(text("awayTeam").toUpperCase(), rightCardX + 24 * u, logoY + badgeSize + 54 * u, cardWidth - 48 * u, {
      size: 42 * u,
      min: 26 * u,
      color: b.white,
      weight: 900,
      align: "center",
      lineHeight: 46 * u,
      maxLines: 2,
    });
    drawWrappedText(`${text("date")} · ${text("time")}`, rightCardX + 24 * u, logoY + badgeSize + 120 * u, cardWidth - 48 * u, {
      size: 26 * u,
      min: 18 * u,
      color: b.gold,
      weight: 800,
      align: "center",
      maxLines: 1,
    });
    drawWrappedText(text("location"), rightCardX + 24 * u, logoY + badgeSize + 158 * u, cardWidth - 48 * u, {
      size: 22 * u,
      min: 16 * u,
      color: b.white,
      family: b.bodyFont,
      weight: 700,
      align: "center",
      maxLines: 2,
    });

    drawFitText("VS", w * 0.5, cardY + cardHeight * 0.45, 160 * u, {
      size: 120 * u,
      min: 64 * u,
      color: b.gold,
      weight: 900,
      align: "center",
    });

    drawFooterText(text("footer"), w, h, b);
  }

  function renderResult({ format, photo, logo, icon }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    fill(b.blue);
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, w * 0.42, h);
    drawCover(photo, w * 0.36, 0, w * 0.64, h, b.dark);
    drawOverlay(w * 0.36, 0, w * 0.64, h, "rgba(0,0,0,0.34)");
    drawBottomFade(w, h, 0.45);
    drawIconBadge(icon, 42 * u, 42 * u, 70 * u, b.white, b.blue);
    drawLogo(logo, w - 142 * u, 36 * u, 105 * u);

    drawFitText(text("title").toUpperCase(), 52 * u, 170 * u, w * 0.52, {
      size: 88 * u,
      min: 40 * u,
      maxHeight: 104 * u,
      color: b.white,
      weight: 900,
    });
    drawFitText(`${text("scoreHome")} - ${text("scoreAway")}`, w * 0.5, h * 0.48, w * 0.78, {
      size: 180 * u,
      min: 82 * u,
      color: b.white,
      weight: 900,
      align: "center",
      stroke: b.dark,
    });
    drawWrappedText(`${text("homeTeam")} / ${text("awayTeam")}`, w * 0.5, h * 0.61, w * 0.78, {
      size: 32 * u,
      color: b.gold,
      weight: 900,
      align: "center",
      maxLines: 2,
    });
    drawWrappedText(text("details"), 56 * u, h - 150 * u, w - 112 * u, {
      size: 30 * u,
      color: b.white,
      family: b.bodyFont,
      weight: 700,
      lineHeight: 42 * u,
      maxLines: 3,
    });
  }

  function renderList({ format, photo, logo, icon }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    fill("#f8fafc");
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, 24 * u, h);
    ctx.fillStyle = b.blue;
    ctx.fillRect(0, h - 92 * u, w, 92 * u);
    drawCover(photo, w * 0.58, 0, w * 0.42, h, b.blue);
    drawOverlay(w * 0.58, 0, w * 0.42, h, "rgba(31,92,168,0.62)");
    drawLogo(logo, w - 138 * u, 34 * u, 100 * u);
    drawIconBadge(icon, 52 * u, 44 * u, 70 * u, b.white, b.red);

    const titleY = ensureTextBelowIcon(142 * u, 52 * u, 70 * u, 30 * u);
    drawFitText(text("title").toUpperCase(), 52 * u, titleY, w * 0.64, {
      size: 70 * u,
      min: 36 * u,
      maxHeight: 82 * u,
      color: b.dark,
      weight: 900,
    });
    drawWrappedText(text("subtitle"), 54 * u, 190 * u, w * 0.58, {
      size: 27 * u,
      color: b.red,
      weight: 800,
      maxLines: 2,
    });
    drawPill(text("date"), 54 * u, 225 * u, Math.min(520 * u, w * 0.5), 44 * u, b.blue, b.white);

    const startY = 310 * u;
    const listAvailable = h - startY - 128 * u;
    const rows = limitVisibleLines(lines(text("items")), Math.max(1, Math.floor(listAvailable / (46 * u))));
    const rowH = Math.max(42 * u, Math.min(82 * u, listAvailable / Math.max(rows.length, 1)));
    rows.forEach((row, index) => {
      const y = startY + index * rowH;
      ctx.fillStyle = index % 2 ? "rgba(31,92,168,0.07)" : "rgba(210,15,31,0.07)";
      roundRect(52 * u, y, w * 0.72, rowH - 9 * u, 8 * u);
      ctx.fill();
      drawWrappedText(row, 78 * u, y + rowH * 0.58, w * 0.66, {
        size: Math.min(28 * u, rowH * 0.34),
        color: b.dark,
        weight: 800,
        maxLines: 1,
      });
    });
    drawFooterText(text("footer"), w, h, b);
  }

  function renderTable({ format, photo, logo, icon }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    fill(b.dark);
    drawCover(photo, w * 0.5, 0, w * 0.5, h, b.dark);
    drawOverlay(0, 0, w, h, "rgba(17,24,39,0.56)");
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, w, 18 * u);
    drawLogo(logo, w - 138 * u, 38 * u, 100 * u);
    drawIconBadge(icon, 52 * u, 50 * u, 70 * u, b.white, b.gold);

    const titleY = ensureTextBelowIcon(154 * u, 52 * u, 70 * u, 30 * u);
    drawFitText(text("title").toUpperCase(), 52 * u, titleY, w * 0.72, {
      size: 80 * u,
      min: 44 * u,
      maxHeight: 94 * u,
      color: b.white,
      weight: 900,
    });
    drawWrappedText(text("subtitle"), 54 * u, 198 * u, w * 0.68, {
      size: 28 * u,
      color: b.gold,
      weight: 800,
      maxLines: 1,
    });

    const boxX = 52 * u;
    const boxY = 250 * u;
    const boxW = w - 104 * u;
    const tableAvailable = h - boxY - 130 * u;
    const rows = limitVisibleLines(lines(text("items")), Math.max(1, Math.floor(tableAvailable / (44 * u))));
    const rowH = Math.max(40 * u, Math.min(76 * u, tableAvailable / Math.max(rows.length, 1)));
    rows.forEach((row, index) => {
      const y = boxY + index * rowH;
      ctx.fillStyle = index === 0 ? b.red : rgba(b.white, index % 2 ? 0.16 : 0.1);
      roundRect(boxX, y, boxW, rowH - 8 * u, 6 * u);
      ctx.fill();
      drawWrappedText(row, boxX + 26 * u, y + rowH * 0.58, boxW - 52 * u, {
        size: Math.min(31 * u, rowH * 0.42),
        color: b.white,
        weight: 900,
        maxLines: 1,
      });
    });
    drawFooterText(text("footer"), w, h, b);
  }

  function renderRoster({ format, photo, logo, icon }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    fill("#ffffff");
    drawCover(photo, 0, 0, w, h, b.dark);
    drawOverlay(0, 0, w, h, "rgba(0,0,0,0.42)");
    ctx.fillStyle = rgba(b.red, 0.9);
    ctx.fillRect(70 * u, 120 * u, w * 0.42, h - 265 * u);
    ctx.fillStyle = b.white;
    ctx.fillRect(w * 0.5, 0, w * 0.5, h);
    drawLogo(logo, w - 165 * u, h - 230 * u, 120 * u);
    drawIconBadge(icon, 96 * u, h - 220 * u, 74 * u, b.white, b.red);

    const titleY = ensureTextBelowIcon(165 * u, 96 * u, 74 * u, 30 * u);
    drawFitText(text("title").toUpperCase(), w * 0.53, titleY, w * 0.42, {
      size: 86 * u,
      min: 44 * u,
      maxHeight: 104 * u,
      color: b.red,
      weight: 900,
    });
    drawWrappedText(text("subtitle"), w * 0.53, 218 * u, w * 0.4, {
      size: 27 * u,
      color: b.dark,
      weight: 800,
      maxLines: 2,
    });
    drawWrappedText(text("date"), w * 0.53, 285 * u, w * 0.4, {
      size: 24 * u,
      color: b.blue,
      weight: 800,
      maxLines: 2,
    });

    const top = 165 * u;
    const coachY = h - 300 * u;
    const listBottom = coachY - 48 * u;
    const available = Math.max(60 * u, listBottom - top);
    const maxRows = Math.max(1, Math.floor(available / (38 * u)));
    const names = limitVisibleLines(lines(text("items")), maxRows);
    const rowH = available / Math.max(names.length, 1);
    const nameSize = Math.max(20 * u, Math.min(48 * u, rowH * 0.62));
    names.forEach((name, index) => {
      drawFitText(name.toUpperCase(), 100 * u, top + index * rowH + nameSize, w * 0.34, {
        size: nameSize,
        min: 22 * u,
        color: b.white,
        weight: 900,
      });
    });
    drawWrappedText(`Coach : ${text("coach")}`, 92 * u, coachY, w * 0.36, {
      size: 28 * u,
      color: b.white,
      weight: 800,
      maxLines: 2,
      maxHeight: 66 * u,
    });
  }

  function renderEvent({ format, photo, logo, icon }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    drawCover(photo, 0, 0, w, h, b.blue);
    drawOverlay(0, 0, w, h, "rgba(0,0,0,0.22)");
    ctx.fillStyle = rgba(b.blue, 0.9);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.72, 0);
    ctx.lineTo(w * 0.5, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(b.red, 0.92);
    ctx.fillRect(0, h - 160 * u, w, 160 * u);
    drawLogo(logo, w - 145 * u, 34 * u, 108 * u);
    drawIconBadge(icon, 52 * u, 50 * u, 78 * u, b.white, b.red);

    const subtitleY = ensureTextBelowIcon(170 * u, 52 * u, 78 * u, 30 * u);
    drawWrappedText(text("subtitle").toUpperCase(), 54 * u, subtitleY, w * 0.54, {
      size: 26 * u,
      color: b.gold,
      weight: 900,
      maxLines: 2,
      maxHeight: 60 * u,
    });
    drawWrappedText(text("title").toUpperCase(), 52 * u, 265 * u, w * 0.58, {
      size: h > w ? 78 * u : 60 * u,
      min: 34 * u,
      color: b.white,
      weight: 900,
      lineHeight: (h > w ? 82 : 64) * u,
      maxLines: 4,
      maxHeight: 270 * u,
    });
    drawWrappedText(text("details"), 56 * u, h - 320 * u, w * 0.58, {
      size: 27 * u,
      min: 18 * u,
      color: b.white,
      family: b.bodyFont,
      weight: 700,
      lineHeight: 38 * u,
      maxLines: 4,
      maxHeight: 150 * u,
    });
    drawPill(`${text("date")} · ${text("location")}`, 52 * u, h - 118 * u, w - 104 * u, 62 * u, b.white, b.red);
  }

  function renderPortrait({ format, photo, logo, icon }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    fill(b.dark);
    drawCover(photo, w * 0.34, 0, w * 0.66, h, b.dark);
    drawOverlay(w * 0.34, 0, w * 0.66, h, "rgba(0,0,0,0.22)");
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, w * 0.46, h);
    ctx.fillStyle = b.blue;
    ctx.fillRect(0, h - 160 * u, w, 160 * u);
    drawLogo(logo, w - 142 * u, 36 * u, 104 * u);
    drawIconBadge(icon, 50 * u, 48 * u, 76 * u, b.white, b.gold);

    const titleY = ensureTextBelowIcon(160 * u, 50 * u, 76 * u, 30 * u);
    drawFitText(text("title").toUpperCase(), 52 * u, titleY, w * 0.62, {
      size: 58 * u,
      min: 34 * u,
      maxHeight: 72 * u,
      color: b.white,
      weight: 900,
    });
    drawWrappedText(text("name").toUpperCase(), 52 * u, 265 * u, w * 0.54, {
      size: 84 * u,
      min: 38 * u,
      color: b.white,
      weight: 900,
      lineHeight: 88 * u,
      maxLines: 3,
      maxHeight: 215 * u,
    });
    const roleY = h - 252 * u;
    drawPill(text("role"), 52 * u, roleY, Math.min(430 * u, w * 0.52), 52 * u, b.white, b.red);
    drawWrappedText(text("stats"), 56 * u, roleY - 70 * u, w - 112 * u, {
      size: 29 * u,
      color: b.white,
      weight: 900,
      maxLines: 2,
      maxHeight: 68 * u,
    });
    drawWrappedText(`“${text("quote")}”`, 56 * u, h - 110 * u, w - 112 * u, {
      size: 24 * u,
      min: 16 * u,
      color: b.white,
      family: b.bodyFont,
      weight: 700,
      lineHeight: 34 * u,
      maxLines: 3,
      maxHeight: 92 * u,
    });
  }

  function renderTransfer({ format, photo, logo, icon }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    drawCover(photo, 0, 0, w, h, b.dark);
    drawOverlay(0, 0, w, h, "rgba(0,0,0,0.46)");
    drawBottomFade(w, h, 0.62);
    ctx.fillStyle = rgba(b.red, 0.86);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.58, 0);
    ctx.lineTo(w * 0.33, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(b.blue, 0.78);
    ctx.fillRect(w * 0.68, 0, w * 0.32, h);
    drawLogo(logo, w - 148 * u, 38 * u, 108 * u);
    drawIconBadge(icon, 52 * u, 52 * u, 76 * u, b.white, b.blue);

    const titleY = ensureTextBelowIcon(175 * u, 52 * u, 76 * u, 30 * u);
    drawFitText(text("title").toUpperCase(), 56 * u, titleY, w * 0.68, {
      size: 88 * u,
      min: 42 * u,
      color: b.white,
      weight: 900,
    });
    drawWrappedText(text("name").toUpperCase(), 56 * u, 305 * u, w * 0.62, {
      size: 86 * u,
      color: b.gold,
      weight: 900,
      lineHeight: 88 * u,
      maxLines: 3,
    });
    drawPill(text("role"), 58 * u, h - 330 * u, Math.min(400 * u, w * 0.48), 52 * u, b.white, b.red);
    drawWrappedText(text("details"), 58 * u, h - 245 * u, w * 0.68, {
      size: 28 * u,
      color: b.white,
      family: b.bodyFont,
      weight: 700,
      lineHeight: 40 * u,
      maxLines: 4,
    });
    drawWrappedText(text("cta").toUpperCase(), 58 * u, h - 62 * u, w * 0.75, {
      size: 30 * u,
      color: b.white,
      weight: 900,
      maxLines: 1,
    });
  }

  function renderSponsor({ format, photo, logo, icon, partnerLogo }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    fill("#ffffff");
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, w * 0.38, h);
    drawCover(photo, 0, 0, w * 0.38, h, b.red);
    drawOverlay(0, 0, w * 0.38, h, rgba(b.red, 0.68));
    ctx.fillStyle = b.blue;
    ctx.fillRect(0, h - 120 * u, w, 120 * u);
    drawLogo(logo, w - 145 * u, 36 * u, 108 * u);
    drawIconBadge(icon, 54 * u, 52 * u, 76 * u, b.white, b.gold);

    const titleY = ensureTextBelowIcon(155 * u, 54 * u, 76 * u, 30 * u);
    drawFitText(text("title").toUpperCase(), w * 0.43, titleY, w * 0.45, {
      size: 62 * u,
      min: 34 * u,
      color: b.red,
      weight: 900,
    });

    const boxX = w * 0.43;
    const boxY = 215 * u;
    const boxW = w * 0.48;
    const boxH = Math.min(300 * u, h * 0.34);
    ctx.fillStyle = "#f3f5f8";
    roundRect(boxX, boxY, boxW, boxH, 8 * u);
    ctx.fill();
    if (partnerLogo) {
      drawContain(partnerLogo, boxX + 24 * u, boxY + 24 * u, boxW - 48 * u, boxH - 48 * u);
    } else {
      drawWrappedText(text("sponsor").toUpperCase(), boxX + 32 * u, boxY + boxH * 0.56, boxW - 64 * u, {
        size: 48 * u,
        color: b.dark,
        weight: 900,
        align: "center",
        maxLines: 2,
      });
    }

    drawWrappedText(text("sponsor"), w * 0.43, boxY + boxH + 65 * u, w * 0.47, {
      size: 34 * u,
      color: b.blue,
      weight: 900,
      maxLines: 2,
    });
    drawWrappedText(text("details"), w * 0.43, boxY + boxH + 120 * u, w * 0.47, {
      size: 25 * u,
      color: b.dark,
      family: b.bodyFont,
      weight: 700,
      lineHeight: 36 * u,
      maxLines: 4,
    });
    drawWrappedText(text("cta").toUpperCase(), 52 * u, h - 62 * u, w - 104 * u, {
      size: 28 * u,
      color: b.white,
      weight: 900,
      align: "center",
      maxLines: 1,
    });
  }

  function renderInfo({ format, photo, logo, icon }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    fill("#ffffff");
    drawCover(photo, w * 0.6, 0, w * 0.4, h, "#e5e7eb");
    drawOverlay(w * 0.6, 0, w * 0.4, h, "rgba(255,255,255,0.58)");
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, w, 24 * u);
    ctx.fillStyle = b.blue;
    ctx.fillRect(0, h - 118 * u, w, 118 * u);
    drawLogo(logo, w - 145 * u, 42 * u, 108 * u);
    drawIconBadge(icon, 58 * u, 72 * u, 100 * u, b.white, b.red);

    const subtitleY = ensureTextBelowIcon(220 * u, 58 * u, 100 * u, 30 * u);
    drawWrappedText(text("subtitle").toUpperCase(), 58 * u, subtitleY, w * 0.62, {
      size: 28 * u,
      color: b.red,
      weight: 900,
      maxLines: 1,
    });
    drawWrappedText(text("title").toUpperCase(), 56 * u, 320 * u, w * 0.72, {
      size: h > w ? 78 * u : 62 * u,
      color: b.dark,
      weight: 900,
      lineHeight: (h > w ? 84 : 68) * u,
      maxLines: 4,
    });
    drawPill(text("date"), 58 * u, h - 360 * u, Math.min(620 * u, w * 0.62), 56 * u, b.red, b.white);
    drawWrappedText(text("details"), 60 * u, h - 265 * u, w * 0.68, {
      size: 28 * u,
      color: b.dark,
      family: b.bodyFont,
      weight: 700,
      lineHeight: 40 * u,
      maxLines: 4,
      maxHeight: 150 * u,
    });
    drawWrappedText(text("cta").toUpperCase(), 56 * u, h - 52 * u, w - 112 * u, {
      size: 28 * u,
      color: b.white,
      weight: 900,
      align: "center",
      maxLines: 1,
    });
  }

  function renderGallery({ format, photo, logo, icon, gallery }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    fill("#ffffff");
    const gap = 18 * u;
    const top = 150 * u;
    const mainH = h * 0.48;
    drawCover(photo, 44 * u, top, w - 88 * u, mainH, b.dark);
    const thumbs = gallery.length ? gallery : [photo, photo, photo].filter(Boolean);
    const thumbY = top + mainH + gap;
    const thumbW = (w - 88 * u - gap * 2) / 3;
    thumbs.slice(0, 3).forEach((img, index) => {
      drawCover(img, 44 * u + index * (thumbW + gap), thumbY, thumbW, Math.min(190 * u, h * 0.14), b.dark);
    });
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, w, 116 * u);
    ctx.fillStyle = b.blue;
    ctx.fillRect(0, h - 115 * u, w, 115 * u);
    drawLogo(logo, w - 136 * u, 25 * u, 94 * u);
    drawIconBadge(icon, 46 * u, 27 * u, 70 * u, b.white, b.red);

    const titleY = ensureTextBelowIcon(77 * u, 46 * u, 70 * u, 30 * u);
    drawFitText(text("title").toUpperCase(), 134 * u, titleY, w - 292 * u, {
      size: 54 * u,
      min: 28 * u,
      color: b.white,
      weight: 900,
    });
    drawWrappedText(text("subtitle"), 50 * u, thumbY + Math.min(190 * u, h * 0.14) + 58 * u, w - 100 * u, {
      size: 38 * u,
      color: b.dark,
      weight: 900,
      align: "center",
      maxLines: 2,
    });
    drawWrappedText(text("details"), 70 * u, h - 220 * u, w - 140 * u, {
      size: 25 * u,
      color: b.dark,
      family: b.bodyFont,
      weight: 700,
      lineHeight: 36 * u,
      align: "center",
      maxLines: 3,
    });
    drawWrappedText(text("cta").toUpperCase(), 54 * u, h - 50 * u, w - 108 * u, {
      size: 28 * u,
      color: b.white,
      weight: 900,
      align: "center",
      maxLines: 1,
    });
  }

  function renderQuote({ format, photo, logo, icon }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    drawCover(photo, 0, 0, w, h, b.dark);
    drawOverlay(0, 0, w, h, "rgba(0,0,0,0.54)");
    ctx.fillStyle = rgba(b.red, 0.9);
    ctx.fillRect(0, 0, w, 140 * u);
    ctx.fillStyle = rgba(b.white, 0.94);
    roundRect(58 * u, h * 0.28, w - 116 * u, h * 0.42, 8 * u);
    ctx.fill();
    drawLogo(logo, w - 140 * u, 24 * u, 96 * u);
    drawIconBadge(icon, 48 * u, 28 * u, 70 * u, b.white, b.blue);

    const titleY = ensureTextBelowIcon(83 * u, 48 * u, 70 * u, 30 * u);
    drawFitText(text("title").toUpperCase(), 132 * u, titleY, w - 285 * u, {
      size: 54 * u,
      min: 30 * u,
      color: b.white,
      weight: 900,
    });
    drawWrappedText(`“${text("quote")}”`, 88 * u, h * 0.39, w - 176 * u, {
      size: 42 * u,
      color: b.dark,
      family: b.bodyFont,
      weight: 800,
      lineHeight: 56 * u,
      align: "center",
      maxLines: 5,
    });
    drawWrappedText(text("name").toUpperCase(), 70 * u, h * 0.78, w - 140 * u, {
      size: 50 * u,
      color: b.white,
      weight: 900,
      align: "center",
      maxLines: 1,
    });
    drawWrappedText(`${text("role")} · ${text("cta")}`, 70 * u, h * 0.84, w - 140 * u, {
      size: 24 * u,
      color: b.gold,
      weight: 900,
      align: "center",
      maxLines: 2,
    });
  }

  function renderCelebration({ format, photo, logo, icon }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    fill(b.red);
    drawCover(photo, 0, 0, w, h, b.red);
    drawOverlay(0, 0, w, h, rgba(b.red, 0.58));
    ctx.fillStyle = rgba(b.dark, 0.48);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = b.gold;
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w, h * 0.42);
    ctx.lineTo(w * 0.58, 0);
    ctx.closePath();
    ctx.fill();
    drawLogo(logo, w - 146 * u, 38 * u, 108 * u);
    drawIconBadge(icon, 56 * u, 55 * u, 82 * u, b.white, b.red);

    const subtitleY = ensureTextBelowIcon(185 * u, 56 * u, 82 * u, 30 * u);
    drawWrappedText(text("subtitle").toUpperCase(), 56 * u, subtitleY, w * 0.72, {
      size: 34 * u,
      color: b.gold,
      weight: 900,
      maxLines: 2,
    });
    drawWrappedText(text("title").toUpperCase(), 54 * u, 330 * u, w * 0.86, {
      size: h > w ? 92 * u : 76 * u,
      color: b.white,
      weight: 900,
      lineHeight: (h > w ? 96 : 80) * u,
      maxLines: 4,
    });
    drawWrappedText(text("details"), 60 * u, h - 310 * u, w - 120 * u, {
      size: 30 * u,
      color: b.white,
      family: b.bodyFont,
      weight: 700,
      lineHeight: 42 * u,
      maxLines: 4,
    });
    drawPill(text("cta"), 58 * u, h - 130 * u, w - 116 * u, 62 * u, b.white, b.red);
  }

  function renderRecruitment({ format, photo, logo, icon }) {
    const { width: w, height: h } = format;
    const b = state.brand;
    const u = unit(w, h);
    drawCover(photo, 0, 0, w, h, b.dark);
    drawOverlay(0, 0, w, h, "rgba(0,0,0,0.36)");
    drawBottomFade(w, h, 0.74);
    ctx.fillStyle = b.red;
    ctx.fillRect(0, 0, w, 130 * u);
    ctx.fillStyle = b.blue;
    ctx.fillRect(0, h - 130 * u, w, 130 * u);
    drawLogo(logo, w - 142 * u, 24 * u, 98 * u);
    drawIconBadge(icon, 46 * u, 28 * u, 74 * u, b.white, b.gold);

    const titleY = ensureTextBelowIcon(84 * u, 46 * u, 74 * u, 30 * u);
    drawFitText(text("title").toUpperCase(), 132 * u, titleY, w - 290 * u, {
      size: 54 * u,
      min: 28 * u,
      color: b.white,
      weight: 900,
    });
    drawWrappedText(text("subtitle").toUpperCase(), 60 * u, h * 0.52, w - 120 * u, {
      size: 72 * u,
      color: b.white,
      weight: 900,
      lineHeight: 76 * u,
      align: "center",
      maxLines: 3,
    });
    drawWrappedText(text("details"), 76 * u, h - 315 * u, w - 152 * u, {
      size: 29 * u,
      color: b.white,
      family: b.bodyFont,
      weight: 700,
      lineHeight: 42 * u,
      align: "center",
      maxLines: 4,
    });
    drawWrappedText(text("cta").toUpperCase(), 58 * u, h - 55 * u, w - 116 * u, {
      size: 28 * u,
      color: b.white,
      weight: 900,
      align: "center",
      maxLines: 1,
    });
  }

  function exportImage(type, extension) {
    const filename = makeFilename(extension);

    if (canvas.toBlob) {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setStatus("Export impossible");
            return;
          }
          downloadBlob(blob, filename);
          setStatus(`${extension.toUpperCase()} exporté`);
        },
        type,
        type === "image/jpeg" ? 1 : undefined,
      );
      return;
    }

    try {
      const quality = type === "image/jpeg" ? 1 : undefined;
      const url = canvas.toDataURL(type, quality);
      downloadUrl(url, filename);
      setStatus(`${extension.toUpperCase()} exporté`);
    } catch (error) {
      console.error(error);
      setStatus("Export bloqué par le navigateur");
    }
  }

  function exportPdf() {
    try {
      const blob = createPdfFromCanvas(canvas);
      downloadBlob(blob, makeFilename("pdf"));
      setStatus("PDF exporté");
    } catch (error) {
      console.error(error);
      setStatus("PDF impossible à générer");
    }
  }

  function createPdfFromCanvas(sourceCanvas) {
    const jpegBase64 = sourceCanvas.toDataURL("image/jpeg", 1).split(",")[1];
    const jpegBinary = atob(jpegBase64);
    const jpegBytes = new Uint8Array(jpegBinary.length);
    for (let i = 0; i < jpegBinary.length; i += 1) {
      jpegBytes[i] = jpegBinary.charCodeAt(i);
    }

    const encoder = new TextEncoder();
    const parts = [];
    const offsets = [0];
    let offset = 0;
    const addAscii = (textValue) => {
      const bytes = encoder.encode(textValue);
      parts.push(bytes);
      offset += bytes.length;
    };
    const addBytes = (bytes) => {
      parts.push(bytes);
      offset += bytes.length;
    };
    const beginObj = (number) => {
      offsets[number] = offset;
      addAscii(`${number} 0 obj\n`);
    };
    const endObj = () => addAscii("\nendobj\n");
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;

    addAscii("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n");
    beginObj(1);
    addAscii("<< /Type /Catalog /Pages 2 0 R >>");
    endObj();
    beginObj(2);
    addAscii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    endObj();
    beginObj(3);
    addAscii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    endObj();
    beginObj(4);
    addAscii(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
    addBytes(jpegBytes);
    addAscii("\nendstream");
    endObj();
    beginObj(5);
    addAscii(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
    endObj();

    const xrefOffset = offset;
    addAscii("xref\n0 6\n0000000000 65535 f \n");
    for (let i = 1; i <= 5; i += 1) {
      addAscii(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
    }
    addAscii(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    return new Blob(parts, { type: "application/pdf" });
  }

  function drawCover(img, x, y, w, h, fallback) {
    if (!img) {
      ctx.fillStyle = fallback || "#d9dee8";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      for (let i = -h; i < w; i += 70) {
        ctx.fillRect(x + i, y, 22, h * 2);
      }
      return;
    }
    const scale = Math.max(w / img.width, h / img.height);
    const sw = img.width * scale;
    const sh = img.height * scale;
    ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
  }

  function drawContain(img, x, y, w, h) {
    if (!img) return;
    const scale = Math.min(w / img.width, h / img.height);
    const sw = img.width * scale;
    const sh = img.height * scale;
    ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
  }

  function drawLogo(logo, x, y, size) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    roundRect(x, y, size, size, size * 0.08);
    ctx.fill();
    if (logo) {
      drawContain(logo, x + size * 0.08, y + size * 0.08, size * 0.84, size * 0.84);
    }
    ctx.restore();
  }

  function drawIconBadge(icon, x, y, size, fillColor, accentColor) {
    ctx.save();
    ctx.fillStyle = fillColor;
    roundRect(x, y, size, size, size * 0.16);
    ctx.fill();
    ctx.fillStyle = accentColor;
    ctx.fillRect(x, y + size * 0.78, size, size * 0.22);
    if (icon) drawContain(icon, x + size * 0.18, y + size * 0.12, size * 0.64, size * 0.64);
    ctx.restore();
  }

  function drawPartnerBadge(partnerLogo, w, h, u) {
    if (!partnerLogo) return;
    const base = (state.partnerLogoSize || 120) * u;
    const size = Math.min(base, w * 0.3, h * 0.3);
    const padding = 28 * u;
    let x = padding;
    let y = h - size - padding;
    switch (state.partnerLogoPosition) {
      case "bottom-right":
        x = w - size - padding;
        y = h - size - padding;
        break;
      case "top-left":
        x = padding;
        y = padding;
        break;
      case "top-right":
        x = w - size - padding;
        y = padding;
        break;
      default:
        x = padding;
        y = h - size - padding;
    }
    ctx.save();
    if (state.partnerLogoStyle === "overlay") {
      // draw directly on the image without background
      drawContain(partnerLogo, x, y, size, size);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      roundRect(x, y, size, size, 14 * u);
      ctx.fill();
      drawContain(partnerLogo, x + 12 * u, y + 12 * u, size - 24 * u, size - 24 * u);
    }
    ctx.restore();
  }

  function drawOverlay(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawBottomFade(w, h, strength) {
    const gradient = ctx.createLinearGradient(0, h * 0.35, 0, h);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  function normalizeCanvasText(value, preserveBreaks = false) {
    const source = String(value || "").replace(/\r/g, "");
    if (preserveBreaks) {
      return source
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .join("\n")
        .trim();
    }
    return source.replace(/\s+/g, " ").trim();
  }

  function resolveTextBoxX(x, maxWidth, align) {
    if (align === "center" && x + maxWidth > canvas.width * 1.04 && x - maxWidth / 2 >= 0) {
      return x - maxWidth / 2;
    }
    if (align === "right" && x - maxWidth >= 0) {
      return x - maxWidth;
    }
    return x;
  }

  function clipTextBox(x, y, maxWidth, maxHeight, size, align) {
    const boxX = resolveTextBoxX(x, maxWidth, align);
    const height = Math.max(size * 1.25, maxHeight || size * 1.35);
    ctx.beginPath();
    ctx.rect(boxX, y - size, maxWidth, height);
    ctx.clip();
    return boxX;
  }

  function truncateText(value, maxWidth) {
    const clean = normalizeCanvasText(value);
    if (!clean || maxWidth <= 0) return "";
    if (ctx.measureText(clean).width <= maxWidth) return clean;
    if (ctx.measureText(ELLIPSIS).width > maxWidth) return "";

    const chars = Array.from(clean);
    let low = 0;
    let high = chars.length;
    let best = "";
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = `${chars.slice(0, mid).join("").trimEnd()}${ELLIPSIS}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best;
  }

  function drawPill(value, x, y, w, h, fillColor, color) {
    if (w <= 0 || h <= 0) return;
    ctx.save();
    ctx.fillStyle = fillColor;
    roundRect(x, y, w, h, Math.min(8, h * 0.18));
    ctx.fill();
    drawWrappedText(value, x + h * 0.32, y + h * 0.64, w - h * 0.64, {
      size: h * 0.38,
      min: h * 0.24,
      color,
      weight: 900,
      maxLines: 1,
      maxHeight: h * 0.52,
      align: "center",
    });
    ctx.restore();
  }

  function drawFitText(value, x, y, maxWidth, options) {
    const align = options.align || "left";
    let textValue = normalizeCanvasText(value);
    if (!textValue || maxWidth <= 0) return;

    let size = Math.min(options.size, options.maxHeight ? options.maxHeight * 0.86 : options.size);
    const minSize = options.min || size * 0.52;
    const family = options.family || state.brand.titleFont;
    const weight = options.weight || 800;
    const maxHeight = options.maxHeight || size * 1.25;

    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    while (size > minSize) {
      setFont(size, weight, family);
      if (ctx.measureText(textValue).width <= maxWidth) break;
      size -= 2;
    }
    setFont(size, weight, family);
    if (ctx.measureText(textValue).width > maxWidth) {
      textValue = truncateText(textValue, maxWidth);
    }

    if (options.clip !== false) {
      clipTextBox(x, y, maxWidth, maxHeight, size, align);
    }

    const boxX = resolveTextBoxX(x, maxWidth, align);
    const drawX = xForAlign(boxX, maxWidth, align);
    if (options.stroke && textValue) {
      ctx.lineWidth = Math.max(3, size * 0.08);
      ctx.strokeStyle = options.stroke;
      ctx.strokeText(textValue, drawX, y, maxWidth);
    }
    ctx.fillStyle = options.color || state.brand.dark;
    ctx.fillText(textValue, drawX, y, maxWidth);
    ctx.restore();
  }

  function drawWrappedText(value, x, y, maxWidth, options) {
    const textValue = normalizeCanvasText(value, true);
    if (!textValue || maxWidth <= 0) return;

    const align = options.align || "left";
    const family = options.family || state.brand.titleFont;
    const weight = options.weight || 700;
    const originalSize = options.size || 24;
    const minSize = options.min || originalSize * 0.52;
    const lineRatio = options.lineHeight ? options.lineHeight / originalSize : 1.18;
    const maxLines = Math.max(1, options.maxLines || 8);
    const maxHeight = options.maxHeight || Infinity;
    let size = originalSize;
    let lineHeight = size * lineRatio;
    let visibleLineCount = maxLines;
    let wrapped = [];

    ctx.save();
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = options.color || state.brand.dark;

    while (size >= minSize) {
      setFont(size, weight, family);
      lineHeight = Math.max(size * 1.05, size * lineRatio);
      const heightLimit = Number.isFinite(maxHeight) ? Math.max(1, Math.floor((maxHeight + size * 0.18) / lineHeight)) : maxLines;
      visibleLineCount = Math.max(1, Math.min(maxLines, heightLimit));
      wrapped = wrapText(textValue, maxWidth);
      if (wrapped.length <= visibleLineCount) break;
      size -= 2;
    }

    setFont(size, weight, family);
    lineHeight = Math.max(size * 1.05, size * lineRatio);
    const heightLimit = Number.isFinite(maxHeight) ? Math.max(1, Math.floor((maxHeight + size * 0.18) / lineHeight)) : maxLines;
    visibleLineCount = Math.max(1, Math.min(maxLines, heightLimit));

    if (wrapped.length > visibleLineCount) {
      wrapped = wrapped.slice(0, visibleLineCount);
      wrapped[wrapped.length - 1] = truncateText(wrapped[wrapped.length - 1], maxWidth);
    } else {
      wrapped = wrapped.map((line) => truncateText(line, maxWidth));
    }

    const boxX = options.clip === false ? resolveTextBoxX(x, maxWidth, align) : clipTextBox(x, y, maxWidth, Number.isFinite(maxHeight) ? maxHeight : visibleLineCount * lineHeight, size, align);
    const drawX = xForAlign(boxX, maxWidth, align);
    wrapped.forEach((line, index) => {
      ctx.fillText(line, drawX, y + index * lineHeight, maxWidth);
    });
    ctx.restore();
  }

  function wrapText(value, maxWidth) {
    const output = [];
    const paragraphs = String(value || "").split("\n");
    paragraphs.forEach((paragraph) => {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (!words.length) return;
      let line = "";
      words.forEach((word) => {
        const candidate = line ? `${line} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxWidth) {
          line = candidate;
          return;
        }
        if (line) output.push(line);
        if (ctx.measureText(word).width <= maxWidth) {
          line = word;
          return;
        }
        const chunks = breakLongWord(word, maxWidth);
        output.push(...chunks.slice(0, -1));
        line = chunks[chunks.length - 1] || "";
      });
      if (line) output.push(line);
    });
    return output;
  }

  function breakLongWord(word, maxWidth) {
    const chunks = [];
    let chunk = "";
    Array.from(String(word || "")).forEach((char) => {
      const candidate = chunk + char;
      if (ctx.measureText(candidate).width <= maxWidth || !chunk) {
        chunk = candidate;
        return;
      }
      chunks.push(chunk);
      chunk = char;
    });
    if (chunk) chunks.push(chunk);
    return chunks;
  }

  function xForAlign(x, maxWidth, align) {
    if (align === "center") return x + maxWidth / 2;
    if (align === "right") return x + maxWidth;
    return x;
  }

  function setFont(size, weight, family) {
    ctx.font = `${weight} ${Math.max(1, Math.round(size))}px ${family}`;
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function fill(color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function rgba(hex, alpha) {
    const normalized = hex.replace("#", "");
    const value = parseInt(normalized.length === 3 ? normalized.replace(/(.)/g, "$1$1") : normalized, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function unit(w, h) {
    return Math.min(w, h) / 1080;
  }

  function text(key) {
    return state.fields[key] || "";
  }

  function lines(value) {
    return String(value || "")
      .split(/\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function limitVisibleLines(items, maxItems) {
    const limit = Math.max(1, Math.floor(maxItems || 1));
    if (items.length <= limit) return items;
    const visible = items.slice(0, limit);
    const hidden = items.length - limit + 1;
    visible[visible.length - 1] = `+ ${hidden} autre${hidden > 1 ? "s" : ""}${ELLIPSIS}`;
    return visible;
  }

  function loadImage(src) {
    if (!src) return Promise.resolve(null);
    if (imageCache.has(src)) return Promise.resolve(imageCache.get(src));
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        imageCache.set(src, image);
        resolve(image);
      };
      image.onerror = () => {
        console.warn("Image introuvable", src);
        resolve(null);
      };
      image.src = src;
    });
  }

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.warn(error);
      return fallback;
    }
  }

  function getTemplate(id) {
    return data.templates.find((template) => template.id === id) || data.templates[0];
  }

  function getCategory(id) {
    return data.categories.find((category) => category.id === id) || data.categories[0];
  }

  function getFormat(id) {
    return data.formats.find((format) => format.id === id) || data.formats[0];
  }

  function makeFilename(extension) {
    const template = getTemplate(state.templateId);
    const format = getFormat(state.formatId);
    const date = new Date().toISOString().slice(0, 10);
    return `${slug(template.name)}-${format.id}-${date}.${extension}`;
  }

  function slug(value) {
    return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function downloadUrl(url, filename) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    downloadUrl(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setStatus(value) {
    els.autosaveState.textContent = value;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  init();
})();
