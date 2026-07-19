/* ES Doubs Studio Communication — app.js v2 — Direction artistique refondée */
(function () {
  "use strict";

  // ── DATA & STATE ────────────────────────────────────────────
  const data        = window.ESD_APP_DATA;
  const STORAGE_KEY = "esd-studio-saved-designs";
  const BRAND_KEY   = "esd-studio-brand";
  const DRAFT_KEY   = "esd-studio-drafts";
  const LOGO_SRC    = "assets/images/esd_logo.png";
  const ELLIPSIS    = "\u2026";

  const canvas = document.getElementById("designCanvas");
  const ctx    = canvas.getContext("2d");

  const els = {
    templateSearch      : document.getElementById("templateSearch"),
    categoryTabs        : document.getElementById("categoryTabs"),
    templateGrid        : document.getElementById("templateGrid"),
    templateCount       : document.getElementById("templateCount"),
    currentCategory     : document.getElementById("currentCategory"),
    currentTemplateName : document.getElementById("currentTemplateName"),
    formatSelect        : document.getElementById("formatSelect"),
    formatMeta          : document.getElementById("formatMeta"),
    autosaveState       : document.getElementById("autosaveState"),
    fieldEditor         : document.getElementById("fieldEditor"),
    dropZone            : document.getElementById("dropZone"),
    imageUpload         : document.getElementById("imageUpload"),
    homeLogoUpload      : document.getElementById("homeLogoUpload"),
    awayLogoUpload      : document.getElementById("awayLogoUpload"),
    partnerUpload       : document.getElementById("partnerUpload"),
    partnerSize         : document.getElementById("partnerSize"),
    partnerPosition     : document.getElementById("partnerPosition"),
    partnerStyle        : document.getElementById("partnerStyle"),
    mediaBank           : document.getElementById("mediaBank"),
    iconBank            : document.getElementById("iconBank"),
    adminToggle         : document.getElementById("adminToggle"),
    adminPanel          : document.getElementById("adminPanel"),
    brandRed            : document.getElementById("brandRed"),
    brandBlue           : document.getElementById("brandBlue"),
    brandGold           : document.getElementById("brandGold"),
    brandDark           : document.getElementById("brandDark"),
    brandTitleFont      : document.getElementById("brandTitleFont"),
    brandBodyFont       : document.getElementById("brandBodyFont"),
    resetBrand          : document.getElementById("resetBrand"),
    saveDesign          : document.getElementById("saveDesign"),
    clearSaved          : document.getElementById("clearSaved"),
    savedList           : document.getElementById("savedList"),
    exportPng           : document.getElementById("exportPng"),
    exportJpg           : document.getElementById("exportJpg"),
    exportPdf           : document.getElementById("exportPdf"),
  };

  const imageCache = new Map();
  let selectedCategory = data.categories[0].id;
  let searchTerm  = "";
  let renderFrame = 0;
  let renderVersion = 0;

  const savedBrand = readJson(BRAND_KEY, null);
  const state = {
    templateId         : data.templates[0].id,
    formatId           : data.templates[0].defaultFormat,
    fields             : {},
    imageSrc           : data.templates[0].defaultImage,
    homeLogoSrc        : "",
    awayLogoSrc        : "",
    partnerLogoSrc     : "",
    partnerLogoSize    : 120,
    partnerLogoPosition: "bottom-left",
    partnerLogoStyle   : "badge",
    iconId             : data.templates[0].defaultIcon,
    brand              : { ...data.brandDefaults, ...(savedBrand || {}) },
  };

  // ── INIT ────────────────────────────────────────────────────
  function init() {
    buildFormatSelect();
    bindEvents();
    applyBrandToUi();
    selectTemplate(state.templateId);
    renderSavedList();
    saveDraftDebounced();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(requestRender);
  }

  function debounce(fn, ms) {
    let t = null;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  }

  function saveDraft() {
    try {
      const drafts = readJson(DRAFT_KEY, {});
      drafts[state.templateId] = {
        templateId: state.templateId, formatId: state.formatId,
        fields: { ...state.fields }, imageSrc: state.imageSrc,
        homeLogoSrc: state.homeLogoSrc, awayLogoSrc: state.awayLogoSrc,
        partnerLogoSrc: state.partnerLogoSrc, iconId: state.iconId,
        brand: { ...state.brand }, updatedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
      setStatus("Brouillon sauvegardé");
    } catch (e) { console.warn(e); }
  }
  const saveDraftDebounced = debounce(saveDraft, 700);

  // ── EVENTS ──────────────────────────────────────────────────
  function bindEvents() {
    els.templateSearch.addEventListener("input", (e) => { searchTerm = e.target.value.trim().toLowerCase(); renderTemplateList(); });
    els.formatSelect.addEventListener("change",    (e) => { state.formatId = e.target.value; requestRender(); });
    els.imageUpload.addEventListener("change",     (e) => handleUpload(e.target.files[0], "main"));
    els.homeLogoUpload.addEventListener("change",  (e) => handleUpload(e.target.files[0], "homeLogo"));
    els.awayLogoUpload.addEventListener("change",  (e) => handleUpload(e.target.files[0], "awayLogo"));
    els.partnerUpload.addEventListener("change",   (e) => handleUpload(e.target.files[0], "partner"));
    if (els.partnerSize)     { els.partnerSize.addEventListener("input",    (e) => { state.partnerLogoSize = Number(e.target.value) || 120; requestRender(); }); els.partnerSize.value = state.partnerLogoSize; }
    if (els.partnerPosition) { els.partnerPosition.addEventListener("change", (e) => { state.partnerLogoPosition = e.target.value || "bottom-left"; requestRender(); }); els.partnerPosition.value = state.partnerLogoPosition; }
    if (els.partnerStyle)    { els.partnerStyle.addEventListener("change",   (e) => { state.partnerLogoStyle = e.target.value || "badge"; requestRender(); }); els.partnerStyle.value = state.partnerLogoStyle; }
    ["dragenter","dragover"].forEach((t) => els.dropZone.addEventListener(t, (e) => { e.preventDefault(); els.dropZone.classList.add("dragover"); }));
    ["dragleave","drop"].forEach((t)     => els.dropZone.addEventListener(t, (e) => { e.preventDefault(); els.dropZone.classList.remove("dragover"); }));
    els.dropZone.addEventListener("drop", (e) => handleUpload(e.dataTransfer.files && e.dataTransfer.files[0], "main"));
    els.adminToggle.addEventListener("click", () => { const v = els.adminPanel.hasAttribute("hidden"); els.adminPanel.toggleAttribute("hidden", !v); els.adminToggle.classList.toggle("active", v); });
    ["brandRed","brandBlue","brandGold","brandDark","brandTitleFont","brandBodyFont"].forEach((id) => els[id].addEventListener("input", updateBrandFromControls));
    els.resetBrand.addEventListener("click", () => { state.brand = { ...data.brandDefaults }; try { localStorage.removeItem(BRAND_KEY); } catch(e){} applyBrandToUi(); requestRender(); });
    if (els.resetTemplate) els.resetTemplate.addEventListener("click", () => { selectTemplate(state.templateId); setStatus("Modèle réinitialisé"); });
    els.saveDesign.addEventListener("click", saveCurrentDesign);
    els.clearSaved.addEventListener("click", () => { if (!confirm("Supprimer toutes les sauvegardes locales ?")) return; try { localStorage.removeItem(STORAGE_KEY); setStatus("Sauvegardes supprimées"); } catch(e){} renderSavedList(); });
    els.exportPng.addEventListener("click", () => exportImage("image/png",  "png"));
    els.exportJpg.addEventListener("click", () => exportImage("image/jpeg", "jpg"));
    els.exportPdf.addEventListener("click", exportPdf);
  }

  // ── UI BUILDERS ─────────────────────────────────────────────
  function buildFormatSelect() {
    els.formatSelect.innerHTML = "";
    data.formats.forEach((f) => { const o = document.createElement("option"); o.value = f.id; o.textContent = `${f.name} · ${f.width}×${f.height}`; els.formatSelect.appendChild(o); });
  }

  function renderCategoryTabs() {
    els.categoryTabs.innerHTML = "";
    data.categories.forEach((cat) => {
      const count = data.templates.filter((t) => t.category === cat.id).length;
      const active = cat.id === selectedCategory;
      const btn = document.createElement("button"); btn.type = "button"; btn.className = active ? "active" : "";
      btn.setAttribute("role","tab"); btn.setAttribute("aria-selected", String(active)); btn.setAttribute("aria-label", `${cat.name} (${count} modèles)`);
      btn.innerHTML = `<span>${escapeHtml(cat.name)}</span><strong>${count}</strong>`;
      btn.addEventListener("click", () => { selectedCategory = cat.id; renderCategoryTabs(); renderTemplateList(); });
      els.categoryTabs.appendChild(btn);
    });
  }

  function renderTemplateList() {
    renderCategoryTabs();
    const templates = data.templates.filter((t) => t.category === selectedCategory && (!searchTerm || `${t.name} ${t.description}`.toLowerCase().includes(searchTerm)));
    els.templateCount.textContent = String(templates.length);
    els.templateGrid.innerHTML = "";
    if (!templates.length) { const p = document.createElement("p"); p.className = "preview-meta"; p.textContent = "Aucun modèle trouvé."; els.templateGrid.appendChild(p); return; }
    templates.forEach((t) => {
      const active = t.id === state.templateId;
      const btn = document.createElement("button"); btn.type = "button"; btn.className = `template-card${active ? " active" : ""}`;
      btn.dataset.templateId = t.id; btn.setAttribute("aria-pressed", String(active)); btn.setAttribute("aria-label", `${t.name}, ${t.description}`);
      btn.innerHTML = `<strong>${escapeHtml(t.name)}</strong><span>${escapeHtml(t.description)}</span>`;
      btn.addEventListener("click", () => selectTemplate(t.id));
      els.templateGrid.appendChild(btn);
    });
  }

  function selectTemplate(templateId, restoredState) {
    const tmpl = getTemplate(templateId);
    state.templateId      = tmpl.id;
    state.formatId        = restoredState?.formatId    || tmpl.defaultFormat || data.formats[0].id;
    state.fields          = restoredState?.fields      || Object.fromEntries(tmpl.fields.map((f) => [f.key, f.value]));
    state.imageSrc        = restoredState?.imageSrc    || tmpl.defaultImage  || data.media[0].src;
    state.homeLogoSrc     = restoredState?.homeLogoSrc || "";
    state.awayLogoSrc     = restoredState?.awayLogoSrc || "";
    state.partnerLogoSrc  = restoredState?.partnerLogoSrc || "";
    state.iconId          = restoredState?.iconId      || tmpl.defaultIcon   || data.icons[0].id;
    if (restoredState?.brand) { state.brand = { ...data.brandDefaults, ...restoredState.brand }; applyBrandToUi(); }
    if (!restoredState) {
      try {
        const draft = (readJson(DRAFT_KEY, {}))[tmpl.id];
        if (draft) {
          state.fields          = { ...Object.fromEntries(tmpl.fields.map((f) => [f.key, f.value])), ...draft.fields };
          state.imageSrc        = draft.imageSrc        || state.imageSrc;
          state.homeLogoSrc     = draft.homeLogoSrc     || state.homeLogoSrc;
          state.awayLogoSrc     = draft.awayLogoSrc     || state.awayLogoSrc;
          state.partnerLogoSrc  = draft.partnerLogoSrc  || state.partnerLogoSrc;
          state.formatId        = draft.formatId        || state.formatId;
          state.iconId          = draft.iconId          || state.iconId;
          state.brand           = { ...state.brand, ...(draft.brand || {}) };
          setStatus("Brouillon restauré");
        }
      } catch(e) { console.warn(e); }
    }
    selectedCategory = tmpl.category;
    els.formatSelect.value = state.formatId;
    els.currentTemplateName.textContent = tmpl.name;
    els.currentCategory.textContent = getCategory(tmpl.category).name;
    renderTemplateList(); renderFieldEditor(); renderMediaBank(); renderIconBank(); requestRender();
  }

  function renderFieldEditor() {
    const tmpl = getTemplate(state.templateId); els.fieldEditor.innerHTML = "";
    tmpl.fields.forEach((item) => {
      const label = document.createElement("label"); label.textContent = item.label;
      const input = document.createElement(item.type === "textarea" ? "textarea" : "input");
      input.id = `field-${item.key}`; input.dataset.key = item.key;
      const lim = fieldUiLimits(item);
      input.value = state.fields[item.key] || ""; input.placeholder = item.value || ""; input.maxLength = lim.maxLength;
      if (input.tagName === "TEXTAREA") { input.rows = lim.rows; input.style.minHeight = `${lim.rows * 28}px`; }
      input.addEventListener("input", (e) => { state.fields[e.target.dataset.key || item.key] = e.target.value; requestRender(); saveDraftDebounced(); });
      label.appendChild(input); els.fieldEditor.appendChild(label);
    });
  }

  function fieldUiLimits(item) {
    const k = item.key.toLowerCase();
    if (k === "items") return { maxLength: 900, rows: 8 };
    if (["details","quote"].includes(k)) return { maxLength: 420, rows: 5 };
    if (["title","subtitle","competition"].includes(k)) return { maxLength: 90, rows: 2 };
    return { maxLength: 140, rows: 3 };
  }

  function renderMediaBank() {
    els.mediaBank.innerHTML = "";
    data.media.forEach((m) => {
      const active = state.imageSrc === m.src; const btn = document.createElement("button"); btn.type = "button"; btn.title = m.name; btn.className = active ? "active" : "";
      btn.setAttribute("aria-pressed", String(active)); btn.setAttribute("aria-label", `Image : ${m.name}`);
      const img = document.createElement("img"); img.src = m.src; img.alt = m.name; btn.appendChild(img);
      btn.addEventListener("click", () => { state.imageSrc = m.src; renderMediaBank(); requestRender(); });
      els.mediaBank.appendChild(btn);
    });
  }

  function renderIconBank() {
    els.iconBank.innerHTML = "";
    data.icons.forEach((ic) => {
      const active = state.iconId === ic.id; const btn = document.createElement("button"); btn.type = "button"; btn.title = ic.name; btn.className = active ? "active" : "";
      btn.setAttribute("aria-pressed", String(active)); btn.setAttribute("aria-label", `Icône : ${ic.name}`);
      const img = document.createElement("img"); img.src = ic.src; img.alt = ic.name; btn.appendChild(img);
      btn.addEventListener("click", () => { state.iconId = ic.id; renderIconBank(); requestRender(); });
      els.iconBank.appendChild(btn);
    });
  }

  // ── BRAND ───────────────────────────────────────────────────
  function handleUpload(file, target) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      if      (target === "partner")  state.partnerLogoSrc = reader.result;
      else if (target === "homeLogo") state.homeLogoSrc    = reader.result;
      else if (target === "awayLogo") state.awayLogoSrc    = reader.result;
      else { state.imageSrc = reader.result; renderMediaBank(); }
      requestRender(); setStatus("Image chargée"); saveDraftDebounced();
    };
    reader.readAsDataURL(file);
  }

  function applyBrandToUi() {
    const root = document.documentElement;
    root.style.setProperty("--red",  state.brand.red);
    root.style.setProperty("--blue", state.brand.blue);
    root.style.setProperty("--gold", state.brand.gold);
    els.brandRed.value = state.brand.red; els.brandBlue.value = state.brand.blue; els.brandGold.value = state.brand.gold;
    els.brandDark.value = state.brand.dark; els.brandTitleFont.value = state.brand.titleFont; els.brandBodyFont.value = state.brand.bodyFont;
  }

  function updateBrandFromControls() {
    state.brand = { ...state.brand, red: els.brandRed.value, blue: els.brandBlue.value, gold: els.brandGold.value, dark: els.brandDark.value, titleFont: els.brandTitleFont.value.trim() || data.brandDefaults.titleFont, bodyFont: els.brandBodyFont.value.trim() || data.brandDefaults.bodyFont };
    try { localStorage.setItem(BRAND_KEY, JSON.stringify(state.brand)); } catch(e) { console.warn(e); }
    applyBrandToUi(); requestRender(); saveDraftDebounced();
  }

  // ── SAVE / LOAD ─────────────────────────────────────────────
  function saveCurrentDesign() {
    const saved = readJson(STORAGE_KEY, []); const tmpl = getTemplate(state.templateId);
    const item = { id: `${Date.now()}`, label: tmpl.name, savedAt: new Date().toLocaleString("fr-FR"), templateId: state.templateId, formatId: state.formatId, fields: { ...state.fields }, imageSrc: state.imageSrc, homeLogoSrc: state.homeLogoSrc, awayLogoSrc: state.awayLogoSrc, partnerLogoSrc: state.partnerLogoSrc, iconId: state.iconId, brand: { ...state.brand } };
    try { saved.unshift(item); localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.slice(0, 15))); renderSavedList(); setStatus("Design enregistré"); } catch(e) { console.error(e); setStatus("Sauvegarde trop lourde"); }
  }

  function renderSavedList() {
    const saved = readJson(STORAGE_KEY, []); els.savedList.innerHTML = "";
    if (!saved.length) { const s = document.createElement("small"); s.textContent = "Aucune sauvegarde locale."; els.savedList.appendChild(s); return; }
    saved.forEach((item) => {
      const row = document.createElement("div"); row.className = "saved-item"; row.style.gridTemplateColumns = "1fr auto auto";
      row.innerHTML = `<div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.savedAt)}</small></div>`;
      const load = document.createElement("button"); load.type = "button"; load.title = "Charger"; load.textContent = "↺"; load.addEventListener("click", () => selectTemplate(item.templateId, item));
      const del = document.createElement("button"); del.type = "button"; del.title = "Supprimer"; del.setAttribute("aria-label","Supprimer cette sauvegarde"); del.textContent = "×"; del.addEventListener("click", () => deleteSavedDesign(item.id));
      row.appendChild(load); row.appendChild(del); els.savedList.appendChild(row);
    });
  }

  function deleteSavedDesign(id) {
    const saved = readJson(STORAGE_KEY, []);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved.filter((i) => i.id !== id))); setStatus("Sauvegarde supprimée"); } catch(e) { console.warn(e); }
    renderSavedList();
  }

  // ── RENDER PIPELINE ─────────────────────────────────────────
  function requestRender() { cancelAnimationFrame(renderFrame); renderFrame = requestAnimationFrame(renderCurrent); }

  async function renderCurrent() {
    const version = ++renderVersion;
    const tmpl   = getTemplate(state.templateId);
    const format = getFormat(state.formatId);
    const icon   = data.icons.find((i) => i.id === state.iconId) || data.icons[0];
    const gallerySrcs = tmpl.layout === "gallery" ? data.media.slice(0, 5).map((m) => m.src) : [];
    canvas.width = format.width; canvas.height = format.height;
    els.formatMeta.textContent = `${format.width} × ${format.height} px`;
    setStatus("Rendu…");
    const [photo, logo, iconImg, homeLogo, awayLogo, partnerLogo, ...gallery] = await Promise.all([
      loadImage(state.imageSrc), loadImage(LOGO_SRC), loadImage(icon.src),
      state.homeLogoSrc    ? loadImage(state.homeLogoSrc)    : Promise.resolve(null),
      state.awayLogoSrc    ? loadImage(state.awayLogoSrc)    : Promise.resolve(null),
      state.partnerLogoSrc ? loadImage(state.partnerLogoSrc) : Promise.resolve(null),
      ...gallerySrcs.map(loadImage),
    ]);
    if (version !== renderVersion) return;
    renderDesign({ tmpl, format, photo, logo, icon: iconImg, homeLogo, awayLogo, partnerLogo, gallery: gallery.filter(Boolean) });
    setStatus("Aperçu à jour");
  }

  function renderDesign(assets) {
    const { tmpl, format } = assets;
    ctx.clearRect(0, 0, format.width, format.height);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    const renderers = {
      "match"           : renderMatch,       "match-vs"  : renderMatchVs,
      "result"          : renderResult,      "list"      : renderList,
      "table"           : renderTable,       "roster"    : renderRoster,
      "event"           : renderEvent,       "convivial-event": renderConvivialEvent,
      "portrait"        : renderPortrait,    "transfer"  : renderTransfer,
      "sponsor"         : renderSponsor,     "info"      : renderInfo,
      "gallery"         : renderGallery,     "quote"     : renderQuote,
      "celebration"     : renderCelebration, "recruitment": renderRecruitment,
    };
    (renderers[tmpl.layout] || renderInfo)(assets);
    if (assets.partnerLogo && tmpl.layout !== "sponsor") drawPartnerBadge(assets.partnerLogo, format.width, format.height, unit(format.width, format.height));
  }


  // ═══════════════════════════════════════════════════════════
  //  PRIMITIVES PARTAGÉES
  // ═══════════════════════════════════════════════════════════

  function drawBg(photo, w, h, overlayAlpha) {
    drawCover(photo, 0, 0, w, h, state.brand.dark);
    if (overlayAlpha > 0) drawOverlay(0, 0, w, h, `rgba(0,0,0,${overlayAlpha})`);
  }

  function drawDiagonalSplit(w, h, leftColor, rightColor, topRatio, splitRatio, angle) {
    const sy = h * topRatio, sx = w * splitRatio, diag = angle != null ? angle : 80;
    ctx.fillStyle = leftColor;
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(sx - diag, sy); ctx.lineTo(sx + diag, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rightColor;
    ctx.beginPath(); ctx.moveTo(sx - diag, sy); ctx.lineTo(w, sy); ctx.lineTo(w, h); ctx.lineTo(sx + diag, h); ctx.closePath(); ctx.fill();
  }

  function drawHeader(icon, logo, w, h) {
    const u = unit(w, h);
    drawIconBadge(icon, 44 * u, 38 * u, 76 * u, "#ffffff", state.brand.red);
    drawLogo(logo, w - 136 * u, 34 * u, 100 * u);
  }

  function drawCompPill(value, x, y, maxW, h) {
    drawPill(value, x, y, Math.min(maxW, 480 * unit(canvas.width, canvas.height)), h, state.brand.red, "#ffffff");
  }

  function drawFooterBand(lineArr, w, h, color) {
    const u = unit(w, h), b = state.brand;
    const bandH = 130 * u, y = h - bandH;
    ctx.fillStyle = color || b.red; ctx.fillRect(0, y, w, bandH);
    ctx.fillStyle = b.gold; ctx.fillRect(0, y, w, Math.max(3, 5 * u));
    const main = lineArr[0] || "", sub = lineArr[1] || "";
    if (main) drawFitText(main.toUpperCase(), 52 * u, y + bandH * 0.52, w - 104 * u, { size: bandH * 0.34, min: 18 * u, color: "#ffffff", weight: 900, align: "center", family: b.accentFont, clip: false });
    if (sub)  drawFitText(sub, 52 * u, y + bandH * 0.82, w - 104 * u, { size: bandH * 0.24, min: 14 * u, color: "rgba(255,255,255,0.82)", weight: 700, align: "center", family: b.bodyFont, clip: false });
  }

  function drawVsBrush(cx, cy, w, h) {
    const u = unit(w, h), b = state.brand;
    const size = (Math.min(w, h) > 900 ? 200 : 160) * u;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 28 * u; ctx.shadowOffsetY = 6 * u;
    ctx.font = `900 ${Math.round(size)}px ${b.accentFont}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineJoin = "round"; ctx.lineWidth = Math.max(6, 10 * u); ctx.strokeStyle = rgba(b.dark, 0.7); ctx.strokeText("VS", cx, cy);
    const stops = [b.goldLight || "#f7e7ad", b.gold, b.goldDeep || "#a9781f"];
    const grad = ctx.createLinearGradient(cx - size * 0.5, cy - size * 0.5, cx + size * 0.5, cy + size * 0.5);
    stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
    ctx.fillStyle = grad; ctx.fillText("VS", cx, cy);
    ctx.restore();
  }


  // ═══════════════════════════════════════════════════════════
  //  RENDERERS
  // ═══════════════════════════════════════════════════════════

  function renderMatch({ format, photo, logo, icon, homeLogo, awayLogo }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    drawBg(photo, w, h, 0.18);
    drawDiagonalSplit(w, h, rgba(b.red, 0.93), rgba(b.blue, 0.88), portrait ? 0.52 : 0.48, 0.5, 90 * u);
    drawBottomFade(w, h, 0.5);
    drawHeader(icon, logo, w, h);
    const titleX = 48 * u, titleW = w * 0.58;
    drawFitText(text("title").toUpperCase(), titleX, 172 * u, titleW, { size: portrait ? 96 * u : 72 * u, min: 44 * u, maxHeight: 112 * u, color: "#fff", weight: 900, stroke: rgba(b.dark, 0.4) });
    drawCompPill(text("competition"), titleX, 224 * u, titleW, 46 * u);
    const panelY = portrait ? h * 0.54 : h * 0.50, logoSize = portrait ? 148 * u : 126 * u;
    const teamSize = portrait ? 46 * u : 38 * u, teamW = w * 0.34;
    const leftCX = w * 0.22, rightCX = w * 0.78;
    ctx.save(); ctx.shadowColor = "rgba(255,255,255,0.22)"; ctx.shadowBlur = 20 * u;
    if (homeLogo) drawContain(homeLogo, leftCX - logoSize / 2, panelY + 16 * u, logoSize, logoSize);
    else { ctx.fillStyle = "rgba(255,255,255,0.18)"; roundRect(leftCX - logoSize / 2, panelY + 16 * u, logoSize, logoSize, 18 * u); ctx.fill(); }
    if (awayLogo) drawContain(awayLogo, rightCX - logoSize / 2, panelY + 16 * u, logoSize, logoSize);
    else { ctx.fillStyle = "rgba(255,255,255,0.18)"; roundRect(rightCX - logoSize / 2, panelY + 16 * u, logoSize, logoSize, 18 * u); ctx.fill(); }
    ctx.restore();
    drawWrappedText(text("homeTeam").toUpperCase(), leftCX - teamW / 2,  panelY + logoSize + 20 * u + teamSize, teamW, { size: teamSize, min: 22 * u, color: "#fff", weight: 900, align: "center", lineHeight: teamSize * 1.1, maxLines: 2, family: b.accentFont });
    drawWrappedText(text("awayTeam").toUpperCase(), rightCX - teamW / 2, panelY + logoSize + 20 * u + teamSize, teamW, { size: teamSize, min: 22 * u, color: "#fff", weight: 900, align: "center", lineHeight: teamSize * 1.1, maxLines: 2, family: b.accentFont });
    drawVsBrush(w * 0.5, panelY + logoSize * 0.52 + 16 * u, w, h);
    drawFooterBand([[text("date"), text("time")].filter(Boolean).join("  |  "), text("location")], w, h, b.dark + "f0");
  }

  function renderMatchVs({ format, photo, logo, icon, homeLogo, awayLogo }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    drawBg(photo, w, h, 0.32); drawBottomFade(w, h, 0.68); drawHeader(icon, logo, w, h);
    drawFitText(text("title").toUpperCase(), 52 * u, 172 * u, w - 104 * u, { size: portrait ? 90 * u : 72 * u, min: 40 * u, maxHeight: 108 * u, color: "#fff", weight: 900, align: "center", stroke: rgba(b.dark, 0.45) });
    drawCompPill(text("competition"), w * 0.5 - 210 * u, 228 * u, 420 * u, 46 * u);
    const panelY = portrait ? h * 0.47 : h * 0.43;
    drawDiagonalSplit(w, h, rgba(b.red, 0.88), rgba(b.blue, 0.88), panelY / h, 0.5, 70 * u);
    const logoSize = portrait ? 210 * u : 172 * u, gap = 80 * u, totalW = logoSize * 2 + gap;
    const lx = (w - totalW) / 2, rx = lx + logoSize + gap, logoY = panelY + 24 * u;
    ctx.save(); ctx.shadowColor = "rgba(255,255,255,0.25)"; ctx.shadowBlur = 22 * u;
    if (homeLogo) drawContain(homeLogo, lx, logoY, logoSize, logoSize); else { ctx.fillStyle = "rgba(255,255,255,0.16)"; roundRect(lx, logoY, logoSize, logoSize, 20 * u); ctx.fill(); }
    if (awayLogo) drawContain(awayLogo, rx, logoY, logoSize, logoSize); else { ctx.fillStyle = "rgba(255,255,255,0.16)"; roundRect(rx, logoY, logoSize, logoSize, 20 * u); ctx.fill(); }
    ctx.restore();
    drawVsBrush(w * 0.5, logoY + logoSize * 0.5, w, h);
    const nameY = logoY + logoSize + 12 * u, nameSize = portrait ? 52 * u : 42 * u, nameW = logoSize * 0.88;
    drawWrappedText(text("homeTeam").toUpperCase(), lx + logoSize / 2 - nameW / 2, nameY + nameSize, nameW, { size: nameSize, min: 24 * u, color: "#fff", weight: 900, align: "center", lineHeight: nameSize * 1.1, maxLines: 2, family: b.accentFont });
    drawWrappedText(text("awayTeam").toUpperCase(), rx + logoSize / 2 - nameW / 2, nameY + nameSize, nameW, { size: nameSize, min: 24 * u, color: "#fff", weight: 900, align: "center", lineHeight: nameSize * 1.1, maxLines: 2, family: b.accentFont });
    drawFooterBand([[text("date"), text("time")].filter(Boolean).join("  ·  "), text("location")], w, h, b.dark + "f0");
  }

  function renderResult({ format, photo, logo, icon }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    drawBg(photo, w, h, 0.24);
    drawDiagonalSplit(w, h, rgba(b.red, 0.91), rgba(b.blue, 0.85), 0.44, 0.5, 100 * u);
    drawBottomFade(w, h, 0.4); drawHeader(icon, logo, w, h);
    drawFitText(text("title").toUpperCase(), 50 * u, 168 * u, w * 0.56, { size: portrait ? 92 * u : 74 * u, min: 42 * u, maxHeight: 108 * u, color: "#fff", weight: 900, stroke: rgba(b.dark, 0.45) });
    drawCompPill(text("competition"), 50 * u, 222 * u, w * 0.52, 44 * u);
    const scoreY = h * (portrait ? 0.52 : 0.54);
    drawFitText(`${text("scoreHome")}  –  ${text("scoreAway")}`, w * 0.5, scoreY, w * 0.82, { size: portrait ? 200 * u : 168 * u, min: 90 * u, color: "#fff", weight: 900, align: "center", stroke: rgba(b.dark, 0.5), strokeWidth: Math.max(5, 8 * u) });
    drawFitText(`${text("homeTeam").toUpperCase()}  vs  ${text("awayTeam").toUpperCase()}`, w * 0.5, scoreY + 62 * u, w * 0.82, { size: 34 * u, min: 20 * u, color: b.gold, weight: 900, align: "center", family: b.accentFont });
    drawWrappedText(text("details"), 54 * u, h - 152 * u, w - 108 * u, { size: 30 * u, min: 18 * u, color: "#fff", family: b.bodyFont, weight: 700, lineHeight: 44 * u, maxLines: 3 });
  }


  function renderRoster({ format, photo, logo, icon }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    drawBg(photo, w, h, 0.28);
    const panelW = portrait ? w * 0.54 : w * 0.46;
    ctx.fillStyle = rgba(b.red, 0.93); ctx.fillRect(0, 0, panelW, h);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, panelW, 130 * u);
    ctx.fillStyle = b.gold; ctx.fillRect(0, 128 * u, panelW, Math.max(3, 5 * u));
    drawHeader(icon, logo, w, h);
    drawFitText(text("title").toUpperCase(), 46 * u, 92 * u, panelW - 52 * u, { size: 68 * u, min: 36 * u, maxHeight: 80 * u, color: b.red, weight: 900 });
    drawWrappedText(text("subtitle"), 46 * u, 175 * u, panelW - 52 * u, { size: 26 * u, color: "#fff", weight: 800, maxLines: 2, family: b.accentFont });
    drawWrappedText(text("date"),     46 * u, 214 * u, panelW - 52 * u, { size: 24 * u, color: b.gold, weight: 800, maxLines: 2, family: b.accentFont });
    const listTop = 256 * u, coachY = h - 148 * u, available = Math.max(80 * u, coachY - listTop - 20 * u);
    const maxRows = Math.max(1, Math.floor(available / (38 * u)));
    const nameItems = limitVisibleLines(lines(text("items")), maxRows);
    const rowH = available / Math.max(nameItems.length, 1);
    const nameSize = Math.max(20 * u, Math.min(42 * u, rowH * 0.58));
    nameItems.forEach((name, i) => {
      const ry = listTop + i * rowH;
      if (i % 2 === 0) { ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(0, ry, panelW, rowH - 2 * u); }
      ctx.save(); ctx.fillStyle = rgba(b.gold, 0.7); ctx.font = `700 ${Math.round(nameSize * 0.72)}px ${b.bodyFont}`; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic"; ctx.fillText(String(i + 1), 74 * u, ry + rowH * 0.72); ctx.restore();
      drawFitText(name, 84 * u, ry + rowH * 0.72, panelW - 100 * u, { size: nameSize, min: 18 * u, color: "#fff", weight: 800, family: b.accentFont });
    });
    ctx.fillStyle = rgba(b.dark, 0.7); ctx.fillRect(0, coachY - 14 * u, panelW, 130 * u);
    drawFitText(`Coach : ${text("coach")}`, 46 * u, coachY + 48 * u, panelW - 52 * u, { size: 34 * u, min: 20 * u, color: b.gold, weight: 900, family: b.accentFont });
  }

  function renderPortrait({ format, photo, logo, icon }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    drawBg(photo, w, h, 0.14);
    drawDiagonalSplit(w, h, rgba(b.red, 0.88), rgba(b.blue, 0.84), portrait ? 0.56 : 0.52, 0.46, 80 * u);
    drawBottomFade(w, h, 0.38); drawHeader(icon, logo, w, h);
    drawFitText(text("title").toUpperCase(), 48 * u, 168 * u, w * 0.62, { size: 58 * u, min: 32 * u, maxHeight: 72 * u, color: "#fff", weight: 900 });
    drawWrappedText(text("name").toUpperCase(), 48 * u, portrait ? 310 * u : 280 * u, w * 0.6, { size: portrait ? 106 * u : 86 * u, min: 48 * u, color: b.gold, weight: 900, lineHeight: portrait ? 100 * u : 82 * u, maxLines: 3, maxHeight: portrait ? 330 * u : 268 * u, family: b.accentFont });
    const pillY = h - 290 * u;
    drawPill(text("role"), 48 * u, pillY, Math.min(w * 0.5, 440 * u), 54 * u, "#fff", b.red);
    drawFitText(text("stats"), 54 * u, pillY - 60 * u, w * 0.64, { size: 30 * u, min: 18 * u, color: "#fff", weight: 800 });
    drawWrappedText(`"${text("quote")}"`, 54 * u, h - 200 * u, w * 0.62, { size: 25 * u, min: 16 * u, color: "rgba(255,255,255,0.88)", family: b.bodyFont, weight: 700, lineHeight: 36 * u, maxLines: 4, maxHeight: 154 * u });
    drawFooterBand(["Allez l'ESD !"], w, h, b.dark + "e8");
  }

  function renderTransfer({ format, photo, logo, icon }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    drawBg(photo, w, h, 0.38);
    ctx.fillStyle = rgba(b.red, 0.9); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(w*0.62,0); ctx.lineTo(w*0.36,h); ctx.lineTo(0,h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(b.blue, 0.82); ctx.fillRect(w * 0.72, 0, w * 0.28, h);
    drawBottomFade(w, h, 0.48); drawHeader(icon, logo, w, h);
    drawFitText(text("title").toUpperCase(), 52 * u, 168 * u, w * 0.7, { size: portrait ? 96 * u : 78 * u, min: 44 * u, maxHeight: 114 * u, color: "#fff", weight: 900 });
    drawWrappedText(text("name").toUpperCase(), 52 * u, portrait ? 312 * u : 272 * u, w * 0.62, { size: portrait ? 104 * u : 84 * u, min: 48 * u, color: b.gold, weight: 900, lineHeight: portrait ? 98 * u : 80 * u, maxLines: 3, maxHeight: portrait ? 320 * u : 260 * u, family: b.accentFont });
    drawPill(text("role"), 52 * u, h - 330 * u, Math.min(440 * u, w * 0.52), 54 * u, "#fff", b.red);
    drawWrappedText(text("details"), 56 * u, h - 240 * u, w * 0.7, { size: 28 * u, min: 18 * u, color: "#fff", family: b.bodyFont, weight: 700, lineHeight: 42 * u, maxLines: 4 });
    drawFooterBand([text("cta") || "BIENVENUE À LA MAISON"], w, h, b.dark + "ee");
  }


  function renderEvent({ format, photo, logo, icon }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    drawBg(photo, w, h, 0.2);
    ctx.fillStyle = rgba(b.blue, 0.88); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(w*0.68,0); ctx.lineTo(w*0.46,h); ctx.lineTo(0,h); ctx.closePath(); ctx.fill();
    drawHeader(icon, logo, w, h);
    drawFitText(text("subtitle").toUpperCase(), 52 * u, 170 * u, w * 0.58, { size: 32 * u, min: 20 * u, color: b.gold, weight: 900, family: b.accentFont });
    drawWrappedText(text("title").toUpperCase(), 50 * u, portrait ? 268 * u : 240 * u, w * 0.6, { size: portrait ? 88 * u : 70 * u, min: 38 * u, color: "#fff", weight: 900, lineHeight: portrait ? 86 * u : 68 * u, maxLines: 4, maxHeight: portrait ? 360 * u : 288 * u });
    drawWrappedText(text("details"), 54 * u, h - 300 * u, w * 0.6, { size: 28 * u, min: 18 * u, color: "rgba(255,255,255,0.9)", family: b.bodyFont, weight: 700, lineHeight: 40 * u, maxLines: 4, maxHeight: 166 * u });
    drawFooterBand([[text("date"), text("location")].filter(Boolean).join("  |  "), text("cta") || ""], w, h, b.red);
  }

  function renderConvivialEvent({ format, photo, logo, icon }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    drawBg(photo, w, h, 0.22);
    const fadeH = h * (portrait ? 0.62 : 0.58);
    ctx.fillStyle = blockGradient(0, 0, w, fadeH, rgba(b.blue, 0.92), rgba(b.blue, 0.04)); ctx.fillRect(0, 0, w, fadeH);
    drawHeader(icon, logo, w, h);
    ctx.save(); ctx.fillStyle = "#fff"; ctx.font = `700 ${Math.round(42 * u)}px ${b.accentFont}`; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText("BIENVENUE", 44 * u + 80 * u, 44 * u + 58 * u); ctx.restore();
    const eyebrowY = 44 * u + 80 * u + 74 * u;
    drawFitText(text("subtitle").toUpperCase(), 50 * u, eyebrowY, w * 0.76, { size: 32 * u, min: 20 * u, color: b.gold, weight: 900, family: b.accentFont });
    drawWrappedText(text("title").toUpperCase(), 50 * u, eyebrowY + (portrait ? 120 : 100) * u, w * 0.8, { size: portrait ? 128 * u : 104 * u, min: 58 * u, color: "#fff", weight: 900, lineHeight: portrait ? 120 * u : 98 * u, maxLines: 3, maxHeight: portrait ? 390 * u : 310 * u });
    drawWrappedText(text("details"), 50 * u, h - 250 * u, w * 0.72, { size: 30 * u, min: 20 * u, color: "rgba(255,255,255,0.92)", family: b.bodyFont, weight: 700, lineHeight: 42 * u, maxLines: 3, maxHeight: 132 * u });
    const ribbonH = 148 * u, ribbonY = h - ribbonH;
    ctx.fillStyle = b.red; ctx.fillRect(0, ribbonY, w, ribbonH);
    ctx.fillStyle = b.gold; ctx.fillRect(0, ribbonY, w, Math.max(3, 5 * u)); ctx.fillRect(0, h - Math.max(3, 5 * u), w, Math.max(3, 5 * u));
    const footer = [text("date"), text("location")].filter(Boolean).join("  —  ");
    drawFitText(footer, 52 * u, ribbonY + ribbonH * 0.56, w - 104 * u, { size: ribbonH * 0.3, min: 16 * u, color: "#fff", weight: 900, family: b.accentFont, align: "center", clip: false });
    drawFitText(text("cta") || "Contactez-nous", 52 * u, ribbonY + ribbonH * 0.86, w - 104 * u, { size: ribbonH * 0.22, min: 14 * u, color: "rgba(255,255,255,0.8)", weight: 700, family: b.bodyFont, align: "center", clip: false });
  }

  function renderRecruitment({ format, photo, logo, icon }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    drawBg(photo, w, h, 0.34); drawBottomFade(w, h, 0.72);
    const topH = 136 * u, botH = 136 * u;
    ctx.fillStyle = b.red; ctx.fillRect(0, 0, w, topH); ctx.fillStyle = b.gold; ctx.fillRect(0, topH - Math.max(3, 5 * u), w, Math.max(3, 5 * u));
    ctx.fillStyle = b.blue; ctx.fillRect(0, h - botH, w, botH); ctx.fillStyle = b.gold; ctx.fillRect(0, h - botH, w, Math.max(3, 5 * u));
    drawHeader(icon, logo, w, h);
    drawFitText(text("title").toUpperCase(), 130 * u, topH * 0.68, w - 260 * u, { size: 58 * u, min: 28 * u, color: "#fff", weight: 900, family: b.accentFont });
    drawWrappedText(text("subtitle").toUpperCase(), w * 0.5 - w * 0.4, h * 0.5, w * 0.8, { size: portrait ? 80 * u : 66 * u, min: 36 * u, color: "#fff", weight: 900, lineHeight: portrait ? 78 * u : 64 * u, align: "center", maxLines: 3 });
    drawWrappedText(text("details"), 72 * u, h - 290 * u, w - 144 * u, { size: 30 * u, min: 18 * u, color: "rgba(255,255,255,0.92)", family: b.bodyFont, weight: 700, lineHeight: 44 * u, align: "center", maxLines: 4 });
    drawFitText(text("cta") || "Contactez-nous", 52 * u, h - botH * 0.3, w - 104 * u, { size: 30 * u, min: 16 * u, color: b.gold, weight: 900, family: b.accentFont, align: "center", clip: false });
  }


  function renderSponsor({ format, photo, logo, icon, partnerLogo }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h);
    ctx.fillStyle = "#f4f6f9"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = b.red; ctx.fillRect(0, 0, 22 * u, h); ctx.fillStyle = b.gold; ctx.fillRect(22 * u, 0, Math.max(3, 5 * u), h);
    ctx.fillStyle = b.blue; ctx.fillRect(0, h - 130 * u, w, 130 * u);
    drawHeader(icon, logo, w, h);
    drawFitText(text("title").toUpperCase(), 56 * u, 168 * u, w * 0.72, { size: 64 * u, min: 34 * u, maxHeight: 78 * u, color: b.red, weight: 900 });
    const boxX = 56 * u, boxY = 220 * u, boxW = w - 112 * u, boxH = Math.min(340 * u, h * 0.36);
    ctx.fillStyle = "#fff"; ctx.shadowColor = "rgba(17,24,39,0.12)"; ctx.shadowBlur = 28 * u; roundRect(boxX, boxY, boxW, boxH, 12 * u); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    if (partnerLogo) drawContain(partnerLogo, boxX + 28 * u, boxY + 28 * u, boxW - 56 * u, boxH - 56 * u);
    else drawFitText(text("sponsor").toUpperCase(), boxX + boxW * 0.5, boxY + boxH * 0.56, boxW - 80 * u, { size: 54 * u, min: 28 * u, color: b.dark, weight: 900, align: "center" });
    drawFitText(text("sponsor"), 56 * u, boxY + boxH + 68 * u, w - 112 * u, { size: 38 * u, min: 22 * u, color: b.blue, weight: 900 });
    drawWrappedText(text("details"), 58 * u, boxY + boxH + 122 * u, w - 116 * u, { size: 26 * u, min: 18 * u, color: b.dark, family: b.bodyFont, weight: 700, lineHeight: 38 * u, maxLines: 4 });
    drawFitText(text("cta").toUpperCase(), 52 * u, h - 50 * u, w - 104 * u, { size: 30 * u, min: 16 * u, color: "#fff", weight: 900, align: "center", family: b.accentFont, clip: false });
  }

  function renderInfo({ format, photo, logo, icon }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    ctx.fillStyle = "#f4f6f9"; ctx.fillRect(0, 0, w, h);
    if (photo) { ctx.save(); ctx.globalAlpha = 0.18; drawCover(photo, w * 0.45, 0, w * 0.55, h, "#ccc"); ctx.globalAlpha = 1; ctx.restore(); }
    const barH = 20 * u;
    ctx.fillStyle = b.red; ctx.fillRect(0, 0, w, barH);
    ctx.fillStyle = b.gold; ctx.fillRect(0, barH, w, Math.max(2, 3 * u));
    ctx.fillStyle = b.red; ctx.fillRect(0, barH + 3 * u, 20 * u, h - barH - 3 * u - 130 * u);
    drawHeader(icon, logo, w, h);
    drawFitText(text("subtitle").toUpperCase(), 56 * u, 176 * u, w * 0.64, { size: 30 * u, min: 18 * u, color: b.red, weight: 900, family: b.accentFont });
    drawWrappedText(text("title").toUpperCase(), 54 * u, portrait ? 290 * u : 260 * u, w * 0.76, { size: portrait ? 72 * u : 58 * u, min: 34 * u, color: b.dark, weight: 900, lineHeight: portrait ? 76 * u : 62 * u, maxLines: 4, maxHeight: portrait ? 310 * u : 258 * u });
    if (text("date")) drawPill(text("date"), 54 * u, h - 348 * u, Math.min(w * 0.64, 600 * u), 58 * u, b.red, "#fff");
    drawWrappedText(text("details"), 58 * u, h - 258 * u, w * 0.72, { size: 29 * u, min: 18 * u, color: b.dark, family: b.bodyFont, weight: 600, lineHeight: 42 * u, maxLines: 4, maxHeight: 176 * u });
    ctx.fillStyle = b.blue; ctx.fillRect(0, h - 118 * u, w, 118 * u);
    drawFitText(text("cta").toUpperCase(), 52 * u, h - 50 * u, w - 104 * u, { size: 30 * u, min: 16 * u, color: "#fff", weight: 900, align: "center", family: b.accentFont, clip: false });
  }

  function renderQuote({ format, photo, logo, icon }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    drawBg(photo, w, h, 0.52); drawBottomFade(w, h, 0.3);
    ctx.fillStyle = rgba(b.red, 0.95); ctx.fillRect(0, 0, w, 140 * u);
    ctx.fillStyle = b.gold; ctx.fillRect(0, 138 * u, w, Math.max(3, 5 * u));
    drawHeader(icon, logo, w, h);
    drawFitText(text("title").toUpperCase(), 130 * u, 90 * u, w - 280 * u, { size: 56 * u, min: 28 * u, color: "#fff", weight: 900, family: b.accentFont });
    const blockY = portrait ? h * 0.22 : h * 0.2, blockH = portrait ? h * 0.44 : h * 0.42;
    ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 30 * u; roundRect(52 * u, blockY, w - 104 * u, blockH, 10 * u); ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    ctx.fillStyle = rgba(b.red, 0.14); ctx.font = `900 ${Math.round(160 * u)}px ${b.accentFont}`; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillText('"', 58 * u, blockY - 20 * u);
    drawWrappedText(`"${text("quote")}"`, 78 * u, blockY + 64 * u, w - 156 * u, { size: portrait ? 40 * u : 34 * u, min: 22 * u, color: b.dark, family: b.bodyFont, weight: 800, lineHeight: portrait ? 56 * u : 48 * u, align: "center", maxLines: 6, maxHeight: blockH - 80 * u });
    const nameY = blockY + blockH + 50 * u;
    drawFitText(text("name").toUpperCase(), w * 0.5, nameY, w * 0.74, { size: 58 * u, min: 28 * u, color: "#fff", weight: 900, align: "center" });
    drawFitText(`${text("role")}  ·  ${text("cta") || "ES Doubs"}`, w * 0.5, nameY + 62 * u, w * 0.72, { size: 26 * u, min: 16 * u, color: b.gold, weight: 800, align: "center", family: b.accentFont });
  }

  function renderCelebration({ format, photo, logo, icon }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    drawBg(photo, w, h, 0.3); ctx.fillStyle = rgba(b.red, 0.78); ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = rgba(b.gold, 0.82); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(w*0.48,0); ctx.lineTo(0,h*0.38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(b.blue, 0.72); ctx.beginPath(); ctx.moveTo(w,h); ctx.lineTo(w*0.52,h); ctx.lineTo(w,h*0.62); ctx.closePath(); ctx.fill();
    const cc = ["#ffffff", b.gold, rgba(b.blue, 0.8)];
    for (let i = 0; i < 28; i++) { const cx = ((i*137+217) % (w-40))+20, cy = ((i*97+119) % (h-40))+20, r = 4*u+(i%4)*3*u; ctx.fillStyle = cc[i%cc.length]; ctx.globalAlpha = 0.22+(i%5)*0.06; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill(); }
    ctx.globalAlpha = 1;
    drawHeader(icon, logo, w, h);
    drawFitText(text("subtitle").toUpperCase(), 52 * u, 172 * u, w * 0.7, { size: 38 * u, min: 22 * u, color: b.gold, weight: 900, family: b.accentFont });
    drawWrappedText(text("title").toUpperCase(), 50 * u, portrait ? 300 * u : 268 * u, w * 0.84, { size: portrait ? 96 * u : 78 * u, min: 44 * u, color: "#fff", weight: 900, lineHeight: portrait ? 92 * u : 74 * u, maxLines: 4, maxHeight: portrait ? 390 * u : 316 * u });
    drawWrappedText(text("details"), 56 * u, h - 290 * u, w - 112 * u, { size: 30 * u, min: 18 * u, color: "rgba(255,255,255,0.9)", family: b.bodyFont, weight: 700, lineHeight: 44 * u, maxLines: 4 });
    drawFooterBand([text("cta") || ""], w, h, rgba(b.dark, 0.88));
  }

  function renderList({ format, photo, logo, icon }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h);
    ctx.fillStyle = "#f4f6f9"; ctx.fillRect(0, 0, w, h);
    if (photo) { ctx.save(); ctx.globalAlpha = 0.14; drawCover(photo, w*0.56, 0, w*0.44, h, "#bbb"); ctx.globalAlpha = 1; ctx.restore(); }
    ctx.fillStyle = b.red;  ctx.fillRect(0, 0, 24*u, h);
    ctx.fillStyle = b.gold; ctx.fillRect(24*u, 0, Math.max(2, 4*u), h);
    ctx.fillStyle = b.blue; ctx.fillRect(0, h - 90*u, w, 90*u);
    drawHeader(icon, logo, w, h);
    drawFitText(text("title").toUpperCase(), 54*u, 162*u, w*0.64, { size: 72*u, min: 36*u, maxHeight: 86*u, color: b.dark, weight: 900 });
    drawFitText(text("subtitle"), 56*u, 204*u, w*0.6, { size: 28*u, min: 16*u, color: b.red, weight: 900, family: b.accentFont });
    drawPill(text("date"), 54*u, 226*u, Math.min(w*0.52, 520*u), 46*u, b.blue, "#fff");
    const startY = 316*u, available = h - startY - 120*u;
    const rowItems = limitVisibleLines(lines(text("items")), Math.max(1, Math.floor(available / (48*u))));
    const rowH = Math.max(44*u, Math.min(86*u, available / Math.max(rowItems.length, 1)));
    rowItems.forEach((row, i) => {
      const ry = startY + i*rowH;
      ctx.fillStyle = i%2 ? rgba(b.blue,0.07) : rgba(b.red,0.06); roundRect(52*u, ry, w*0.7, rowH-8*u, 8*u); ctx.fill();
      ctx.fillStyle = i%2 ? b.blue : b.red; ctx.fillRect(52*u, ry, 6*u, rowH-8*u);
      drawFitText(row, 72*u, ry+rowH*0.62, w*0.64, { size: Math.min(28*u,rowH*0.38), min: 18*u, color: b.dark, weight: 800 });
    });
    drawFitText(text("footer") || "Allez l'ESD !", 52*u, h-36*u, w-104*u, { size: 28*u, min: 14*u, color: "#fff", weight: 900, align: "center", family: b.accentFont, clip: false });
  }

  function renderTable({ format, photo, logo, icon }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h);
    drawBg(photo, w, h, 0.5); drawBottomFade(w, h, 0.36);
    ctx.fillStyle = b.red; ctx.fillRect(0, 0, w, 20*u); ctx.fillStyle = b.gold; ctx.fillRect(0, 20*u, w, Math.max(2, 4*u));
    drawHeader(icon, logo, w, h);
    drawFitText(text("title").toUpperCase(), 52*u, 162*u, w*0.74, { size: 80*u, min: 42*u, maxHeight: 96*u, color: "#fff", weight: 900 });
    drawFitText(text("subtitle"), 54*u, 210*u, w*0.7, { size: 30*u, min: 16*u, color: b.gold, weight: 800, family: b.accentFont });
    const boxX=52*u, boxY=264*u, boxW=w-104*u, avail=h-boxY-130*u;
    const rowItems = limitVisibleLines(lines(text("items")), Math.max(1, Math.floor(avail/(46*u))));
    const rowH = Math.max(42*u, Math.min(80*u, avail/Math.max(rowItems.length,1)));
    rowItems.forEach((row, i) => {
      const ry = boxY+i*rowH;
      ctx.fillStyle = i===0 ? b.red : (i%2 ? rgba("#ffffff",0.18) : rgba("#ffffff",0.1)); roundRect(boxX,ry,boxW,rowH-8*u,6*u); ctx.fill();
      ctx.save(); ctx.fillStyle = i===0?b.gold:rgba("#ffffff",0.5); ctx.font=`900 ${Math.round(Math.min(26*u,rowH*0.4))}px ${b.bodyFont}`; ctx.textAlign="center"; ctx.textBaseline="alphabetic"; ctx.fillText(String(i+1),boxX+30*u,ry+rowH*0.66); ctx.restore();
      drawFitText(row.replace(/^\d+\.\s*/,""), boxX+56*u, ry+rowH*0.66, boxW-72*u, { size: Math.min(30*u,rowH*0.42), min: 16*u, color: "#fff", weight: 900 });
    });
    drawFitText(text("footer")||"", 52*u, h-50*u, w-104*u, { size: 24*u, min: 14*u, color: rgba(b.gold,0.9), weight: 800, align: "center", family: b.bodyFont, clip: false });
  }

  function renderGallery({ format, photo, logo, icon, gallery }) {
    const { width: w, height: h } = format, b = state.brand, u = unit(w, h), portrait = h >= w;
    ctx.fillStyle = "#f4f6f9"; ctx.fillRect(0, 0, w, h);
    const headerH = portrait ? 128*u : 116*u;
    ctx.fillStyle = b.red; ctx.fillRect(0,0,w,headerH); ctx.fillStyle = b.gold; ctx.fillRect(0,headerH-Math.max(3,5*u),w,Math.max(3,5*u));
    drawHeader(icon, logo, w, h);
    drawFitText(text("title").toUpperCase(), 130*u, headerH*0.68, w-270*u, { size: 58*u, min: 26*u, color: "#fff", weight: 900, family: b.accentFont });
    const gap=14*u, mainY=headerH+gap, mainH=portrait?h*0.46:h*0.44;
    drawCover(photo, 44*u, mainY, w-88*u, mainH, b.dark);
    const thumbsY=mainY+mainH+gap, thumbs=(gallery.length?gallery:[photo,photo,photo]).filter(Boolean);
    const thumbW=(w-88*u-gap*2)/3, thumbH=Math.min(portrait?180*u:158*u, h*0.13);
    thumbs.slice(0,3).forEach((img,i) => drawCover(img, 44*u+i*(thumbW+gap), thumbsY, thumbW, thumbH, "#ccc"));
    const textY=thumbsY+thumbH+48*u;
    drawFitText(text("subtitle"), w*0.5, textY, w-108*u, { size: 40*u, min: 22*u, color: b.dark, weight: 900, align: "center" });
    drawWrappedText(text("details"), 70*u, textY+58*u, w-140*u, { size: 26*u, min: 16*u, color: "#555", family: b.bodyFont, weight: 700, lineHeight: 38*u, align: "center", maxLines: 3 });
    ctx.fillStyle = b.blue; ctx.fillRect(0, h-92*u, w, 92*u);
    drawFitText((text("cta")||"@esdoubs").toUpperCase(), 52*u, h-34*u, w-104*u, { size: 30*u, min: 16*u, color: "#fff", weight: 900, align: "center", family: b.accentFont, clip: false });
  }


  // ═══════════════════════════════════════════════════════════
  //  HELPERS CANVAS
  // ═══════════════════════════════════════════════════════════

  function drawCover(img, x, y, w, h, fallback) {
    if (!img) { ctx.fillStyle = fallback||"#d9dee8"; ctx.fillRect(x,y,w,h); ctx.fillStyle="rgba(255,255,255,0.12)"; for(let i=-h;i<w;i+=64){ctx.fillRect(x+i,y,20,h*2);} return; }
    const s=Math.max(w/img.width,h/img.height), sw=img.width*s, sh=img.height*s;
    ctx.drawImage(img, x+(w-sw)/2, y+(h-sh)/2, sw, sh);
  }

  function drawContain(img, x, y, w, h) {
    if (!img) return;
    const s=Math.min(w/img.width,h/img.height), sw=img.width*s, sh=img.height*s;
    ctx.drawImage(img, x+(w-sw)/2, y+(h-sh)/2, sw, sh);
  }

  function drawLogo(logo, x, y, size) {
    ctx.save(); ctx.fillStyle="rgba(255,255,255,0.96)";
    ctx.shadowColor="rgba(0,0,0,0.18)"; ctx.shadowBlur=12*unit(size,size);
    roundRect(x,y,size,size,size*0.1); ctx.fill();
    ctx.shadowColor="transparent"; ctx.shadowBlur=0;
    if(logo) drawContain(logo, x+size*0.1, y+size*0.1, size*0.8, size*0.8);
    ctx.restore();
  }

  function drawIconBadge(icon, x, y, size, fillColor, accentColor) {
    ctx.save(); ctx.fillStyle=fillColor||"#ffffff"; roundRect(x,y,size,size,size*0.14); ctx.fill();
    ctx.fillStyle=accentColor||state.brand.red; ctx.fillRect(x, y+size*0.76, size, size*0.24);
    if(icon) drawContain(icon, x+size*0.16, y+size*0.1, size*0.68, size*0.62);
    ctx.restore();
  }

  function drawPartnerBadge(partnerLogo, w, h, u) {
    if (!partnerLogo) return;
    const base=(state.partnerLogoSize||120)*u, size=Math.min(base,w*0.28,h*0.28), pad=26*u;
    let x=pad, y=h-size-pad;
    if(state.partnerLogoPosition==="bottom-right") x=w-size-pad;
    else if(state.partnerLogoPosition==="top-left") y=pad;
    else if(state.partnerLogoPosition==="top-right") { x=w-size-pad; y=pad; }
    ctx.save();
    if(state.partnerLogoStyle==="overlay") { drawContain(partnerLogo,x,y,size,size); }
    else { ctx.fillStyle="rgba(255,255,255,0.93)"; ctx.shadowColor="rgba(0,0,0,0.14)"; ctx.shadowBlur=12*u; roundRect(x,y,size,size,12*u); ctx.fill(); ctx.shadowColor="transparent"; ctx.shadowBlur=0; drawContain(partnerLogo,x+10*u,y+10*u,size-20*u,size-20*u); }
    ctx.restore();
  }

  function drawOverlay(x,y,w,h,color) { ctx.fillStyle=color; ctx.fillRect(x,y,w,h); }

  function drawBottomFade(w,h,strength) {
    const g=ctx.createLinearGradient(0,h*0.3,0,h); g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(1,`rgba(0,0,0,${strength})`);
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
  }

  function blockGradient(x,y,w,h,topColor,bottomColor) {
    const g=ctx.createLinearGradient(x,y,x,y+h); g.addColorStop(0,topColor); g.addColorStop(1,bottomColor); return g;
  }

  function drawPill(value, x, y, w, h, fillColor, color) {
    if(w<=0||h<=0) return;
    ctx.save(); ctx.fillStyle=fillColor; roundRect(x,y,w,h,Math.min(8,h*0.2)); ctx.fill();
    drawFitText(value, x+h*0.3, y+h*0.68, w-h*0.6, { size:h*0.4, min:h*0.26, color, weight:900, maxHeight:h*0.54, align:"center" });
    ctx.restore();
  }

  function roundRect(x,y,w,h,r) {
    const rad=Math.min(r,w/2,h/2);
    ctx.beginPath(); ctx.moveTo(x+rad,y); ctx.lineTo(x+w-rad,y); ctx.quadraticCurveTo(x+w,y,x+w,y+rad); ctx.lineTo(x+w,y+h-rad); ctx.quadraticCurveTo(x+w,y+h,x+w-rad,y+h); ctx.lineTo(x+rad,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-rad); ctx.lineTo(x,y+rad); ctx.quadraticCurveTo(x,y,x+rad,y); ctx.closePath();
  }


  // ═══════════════════════════════════════════════════════════
  //  HELPERS TEXTE
  // ═══════════════════════════════════════════════════════════

  function normalizeCanvasText(v, keepBreaks) {
    const s=String(v||"").replace(/\r/g,"");
    if(keepBreaks) return s.split("\n").map((l)=>l.replace(/\s+/g," ").trim()).join("\n").trim();
    return s.replace(/\s+/g," ").trim();
  }

  function setFont(size, weight, family) { ctx.font=`${weight} ${Math.max(1,Math.round(size))}px ${family||state.brand.titleFont}`; }

  function truncateText(v, maxWidth) {
    const clean=normalizeCanvasText(v); if(!clean||maxWidth<=0) return "";
    if(ctx.measureText(clean).width<=maxWidth) return clean;
    if(ctx.measureText(ELLIPSIS).width>maxWidth) return "";
    const chars=Array.from(clean); let lo=0,hi=chars.length,best="";
    while(lo<=hi){ const mid=Math.floor((lo+hi)/2), cand=`${chars.slice(0,mid).join("").trimEnd()}${ELLIPSIS}`; if(ctx.measureText(cand).width<=maxWidth){best=cand;lo=mid+1;}else hi=mid-1; }
    return best;
  }

  function wrapText(v, maxWidth) {
    const out=[];
    String(v||"").split("\n").forEach((para)=>{
      const words=para.trim().split(/\s+/).filter(Boolean); if(!words.length) return;
      let line="";
      words.forEach((w)=>{ const cand=line?`${line} ${w}`:w; if(ctx.measureText(cand).width<=maxWidth){line=cand;return;} if(line)out.push(line); if(ctx.measureText(w).width<=maxWidth){line=w;return;} const chunks=breakLongWord(w,maxWidth); out.push(...chunks.slice(0,-1)); line=chunks[chunks.length-1]||""; });
      if(line) out.push(line);
    });
    return out;
  }

  function breakLongWord(word, maxWidth) {
    const chunks=[]; let chunk="";
    Array.from(String(word||"")).forEach((c)=>{ const cand=chunk+c; if(ctx.measureText(cand).width<=maxWidth||!chunk){chunk=cand;return;} chunks.push(chunk); chunk=c; });
    if(chunk) chunks.push(chunk); return chunks;
  }

  function resolveTextBoxX(x,maxWidth,align) {
    if(align==="center"&&x+maxWidth>canvas.width*1.04&&x-maxWidth/2>=0) return x-maxWidth/2;
    if(align==="right"&&x-maxWidth>=0) return x-maxWidth;
    return x;
  }

  function xForAlign(x,maxWidth,align) { if(align==="center") return x+maxWidth/2; if(align==="right") return x+maxWidth; return x; }

  function clipTextBox(x,y,maxWidth,maxHeight,size,align) {
    const bx=resolveTextBoxX(x,maxWidth,align);
    ctx.beginPath(); ctx.rect(bx, y-size, maxWidth, Math.max(size*1.25, maxHeight||size*1.35)); ctx.clip();
    return bx;
  }

  function drawFitText(v, x, y, maxWidth, options) {
    const align=options.align||"left", family=options.family||state.brand.titleFont, weight=options.weight||800;
    let txt=normalizeCanvasText(v); if(!txt||maxWidth<=0) return;
    let size=Math.min(options.size, options.maxHeight?options.maxHeight*0.86:options.size);
    const minSize=options.min||size*0.52, maxH=options.maxHeight||size*1.25;
    ctx.save(); ctx.textAlign=align; ctx.textBaseline="alphabetic";
    while(size>minSize){ setFont(size,weight,family); if(ctx.measureText(txt).width<=maxWidth) break; size-=2; }
    setFont(size,weight,family);
    if(ctx.measureText(txt).width>maxWidth) txt=truncateText(txt,maxWidth);
    if(options.clip!==false) clipTextBox(x,y,maxWidth,maxH,size,align);
    const bx=resolveTextBoxX(x,maxWidth,align), dx=xForAlign(bx,maxWidth,align);
    if(options.stroke&&txt){ ctx.lineJoin="round"; ctx.lineWidth=Math.max(3,size*0.08); ctx.strokeStyle=options.stroke; ctx.strokeText(txt,dx,y,maxWidth); }
    ctx.fillStyle=options.color||state.brand.dark; ctx.fillText(txt,dx,y,maxWidth);
    ctx.restore();
  }

  function drawWrappedText(v, x, y, maxWidth, options) {
    const txt=normalizeCanvasText(v,true); if(!txt||maxWidth<=0) return;
    const align=options.align||"left", family=options.family||state.brand.titleFont, weight=options.weight||700;
    const origSize=options.size||24, minSize=options.min||origSize*0.52;
    const lineRatio=options.lineHeight?options.lineHeight/origSize:1.18;
    const maxLines=Math.max(1,options.maxLines||8), maxH=options.maxHeight||Infinity;
    let size=origSize, lineH=size*lineRatio, vis=maxLines, wrapped=[];
    ctx.save(); ctx.textAlign=align; ctx.textBaseline="alphabetic"; ctx.fillStyle=options.color||state.brand.dark;
    while(size>=minSize){ setFont(size,weight,family); lineH=Math.max(size*1.05,size*lineRatio); const hlim=Number.isFinite(maxH)?Math.max(1,Math.floor((maxH+size*0.18)/lineH)):maxLines; vis=Math.max(1,Math.min(maxLines,hlim)); wrapped=wrapText(txt,maxWidth); if(wrapped.length<=vis) break; size-=2; }
    setFont(size,weight,family); lineH=Math.max(size*1.05,size*lineRatio);
    const hlim=Number.isFinite(maxH)?Math.max(1,Math.floor((maxH+size*0.18)/lineH)):maxLines; vis=Math.max(1,Math.min(maxLines,hlim));
    if(wrapped.length>vis){ wrapped=wrapped.slice(0,vis); wrapped[wrapped.length-1]=truncateText(wrapped[wrapped.length-1],maxWidth); }
    else { wrapped=wrapped.map((l)=>truncateText(l,maxWidth)); }
    const bx=options.clip===false?resolveTextBoxX(x,maxWidth,align):clipTextBox(x,y,maxWidth,Number.isFinite(maxH)?maxH:vis*lineH,size,align);
    const dx=xForAlign(bx,maxWidth,align);
    wrapped.forEach((line,i)=>{ ctx.fillText(line,dx,y+i*lineH,maxWidth); });
    ctx.restore();
  }


  // ═══════════════════════════════════════════════════════════
  //  HELPERS UTILITAIRES
  // ═══════════════════════════════════════════════════════════

  function unit(w,h) { return Math.min(w,h)/1080; }
  function text(key) { return state.fields[key]||""; }
  function lines(v) { return String(v||"").split(/\n/).map((l)=>l.trim()).filter(Boolean); }

  function limitVisibleLines(items, maxItems) {
    const limit=Math.max(1,Math.floor(maxItems||1)); if(items.length<=limit) return items;
    const vis=items.slice(0,limit), hidden=items.length-limit+1;
    vis[vis.length-1]=`+ ${hidden} autre${hidden>1?"s":""}${ELLIPSIS}`; return vis;
  }

  function rgba(hex, alpha) {
    const n=String(hex||"#000").replace("#",""), v=parseInt(n.length===3?n.replace(/(.)/g,"$1$1"):n,16);
    return `rgba(${(v>>16)&255},${(v>>8)&255},${v&255},${alpha})`;
  }

  function loadImage(src) {
    if(!src) return Promise.resolve(null);
    if(imageCache.has(src)) return Promise.resolve(imageCache.get(src));
    return new Promise((resolve)=>{ const img=new Image(); img.onload=()=>{imageCache.set(src,img);resolve(img);}; img.onerror=()=>{console.warn("Image introuvable",src);resolve(null);}; img.src=src; });
  }

  function readJson(key,fallback) { try{const v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch(e){console.warn(e);return fallback;} }
  function getTemplate(id) { return data.templates.find((t)=>t.id===id)||data.templates[0]; }
  function getCategory(id) { return data.categories.find((c)=>c.id===id)||data.categories[0]; }
  function getFormat(id)   { return data.formats.find((f)=>f.id===id)||data.formats[0]; }

  function makeFilename(ext) {
    const t=getTemplate(state.templateId), f=getFormat(state.formatId), d=new Date().toISOString().slice(0,10);
    return `${slug(t.name)}-${f.id}-${d}.${ext}`;
  }

  function slug(v) { return String(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }
  function setStatus(v) { els.autosaveState.textContent=v; }
  function escapeHtml(v) { return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
  function downloadUrl(url,filename) { const a=document.createElement("a"); a.href=url; a.download=filename; a.rel="noopener"; document.body.appendChild(a); a.click(); a.remove(); }
  function downloadBlob(blob,filename) { const url=URL.createObjectURL(blob); downloadUrl(url,filename); setTimeout(()=>URL.revokeObjectURL(url),1000); }

  // ═══════════════════════════════════════════════════════════
  //  EXPORT
  // ═══════════════════════════════════════════════════════════

  function exportImage(type,ext) {
    const filename=makeFilename(ext);
    if(canvas.toBlob){ canvas.toBlob((blob)=>{ if(!blob){setStatus("Export impossible");return;} downloadBlob(blob,filename); setStatus(`${ext.toUpperCase()} exporté`); },type,type==="image/jpeg"?1:undefined); return; }
    try{ const url=canvas.toDataURL(type,type==="image/jpeg"?1:undefined); downloadUrl(url,filename); setStatus(`${ext.toUpperCase()} exporté`); }catch(e){ console.error(e); setStatus("Export bloqué par le navigateur"); }
  }

  function exportPdf() {
    try{ const blob=createPdfFromCanvas(canvas); downloadBlob(blob,makeFilename("pdf")); setStatus("PDF exporté"); }catch(e){ console.error(e); setStatus("PDF impossible à générer"); }
  }

  function createPdfFromCanvas(src) {
    const b64=src.toDataURL("image/jpeg",1).split(",")[1], bin=atob(b64);
    const bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    const enc=new TextEncoder(), parts=[], offsets=[0]; let off=0;
    const add=(t)=>{const b=enc.encode(t);parts.push(b);off+=b.length;};
    const addB=(b)=>{parts.push(b);off+=b.length;};
    const bObj=(n)=>{offsets[n]=off;add(`${n} 0 obj\n`);};
    const eObj=()=>add("\nendobj\n");
    const W=src.width, H=src.height, cnt=`q\n${W} 0 0 ${H} 0 0 cm\n/Im0 Do\nQ\n`;
    add("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
    bObj(1); add("<< /Type /Catalog /Pages 2 0 R >>"); eObj();
    bObj(2); add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"); eObj();
    bObj(3); add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`); eObj();
    bObj(4); add(`<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`); addB(bytes); add("\nendstream"); eObj();
    bObj(5); add(`<< /Length ${enc.encode(cnt).length} >>\nstream\n${cnt}endstream`); eObj();
    const xOff=off; add("xref\n0 6\n0000000000 65535 f \n");
    for(let i=1;i<=5;i++) add(`${String(offsets[i]).padStart(10,"0")} 00000 n \n`);
    add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xOff}\n%%EOF`);
    return new Blob(parts,{type:"application/pdf"});
  }

  // ─────────────────────────────────────────────
  init();

})();
