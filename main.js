/* ============================================================
   WEBP CONVERTER + COMPRESSEUR — main.js
   ============================================================ */
"use strict";

/* ── STATE ──────────────────────────────────────────────── */
const state = { files: [], nid: 0 };

/* ── UTILS ──────────────────────────────────────────────── */
function fmtBytes(b) {
  if (!b) return "0 b";
  const u = ["b", "kb", "mb", "gb"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + " " + u[i];
}
function el(id) {
  return document.getElementById(id);
}

/* ── TOASTS ─────────────────────────────────────────────── */
function toast(msg, type = "ok") {
  const n = document.createElement("div");
  n.className = `toast ${type}`;
  n.textContent = (type === "ok" ? "↗ " : "✕ ") + msg;
  el("toasts").appendChild(n);
  setTimeout(() => n.remove(), 3200);
}

/* ════════════════════════════════════════════════════════════
   PAGE TABS
   ════════════════════════════════════════════════════════════ */
document.querySelectorAll(".page-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".page-tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".page-section")
      .forEach((s) => s.classList.remove("active"));
    tab.classList.add("active");
    el("section-" + tab.dataset.tab).classList.add("active");
  });
});

/* ════════════════════════════════════════════════════════════
   CUSTOM SELECT (encodeur WebP)
   ════════════════════════════════════════════════════════════ */
(function initCustomSelect() {
  const trigger = el("method-select");
  const dropdown = el("method-dropdown");
  const label = el("method-label");
  const nativeSelect = el("method");

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = trigger.classList.toggle("open");
    dropdown.classList.toggle("open", isOpen);
  });

  dropdown.querySelectorAll(".custom-select-option").forEach((opt) => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown
        .querySelectorAll(".custom-select-option")
        .forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      label.textContent = opt.textContent
        .trim()
        .replace(/check$/, "")
        .trim();
      nativeSelect.value = opt.dataset.value;
      trigger.classList.remove("open");
      dropdown.classList.remove("open");
      // deselect preset
      document
        .querySelectorAll(".preset-card")
        .forEach((c) => c.classList.remove("active"));
    });
  });

  document.addEventListener("click", () => {
    trigger.classList.remove("open");
    dropdown.classList.remove("open");
  });
})();

/* ════════════════════════════════════════════════════════════
   WEBP CONVERTER
   ════════════════════════════════════════════════════════════ */

/* ── SUMMARY BAR ────────────────────────────────────────── */
function updateSummary() {
  const done = state.files.filter((f) => f.status === "done");
  const bar = el("summary-bar");
  const zipBtn = el("btn-zip2");
  if (!done.length) {
    bar.classList.remove("on");
    return;
  }
  const tb = done.reduce((a, f) => a + f.file.size, 0);
  const ta = done.reduce((a, f) => a + f.convBlob.size, 0);
  const pct = Math.round((1 - ta / tb) * 100);
  bar.classList.add("on");
  el("sc").textContent = done.length;
  el("sb").textContent = fmtBytes(tb);
  el("sa").textContent = fmtBytes(ta);
  el("ss").textContent = (pct >= 0 ? "−" : "+") + Math.abs(pct) + "%";
  zipBtn.style.display = "inline-flex";
}

/* ── TOOLBAR ────────────────────────────────────────────── */
function updateToolbar() {
  const n = state.files.length;
  el("toolbar").className = n ? "toolbar on" : "toolbar";
  el("tcount").innerHTML =
    `<strong>${n}</strong> fichier${n > 1 ? "s" : ""} chargé${n > 1 ? "s" : ""}`;
}

/* ── CARDS ──────────────────────────────────────────────── */
function renderCard(item) {
  const ext = item.file.name.split(".").pop().toLowerCase();
  const baseName = item.file.name.replace(/\.[^.]+$/, "");
  item.outputName = baseName;

  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = item.id;
  card.innerHTML = `
    <div class="thumb">
      <img src="" alt="">
      <span class="thumb-badge b-wait" id="badge-${item.id}">en attente</span>
    </div>
    <div class="card-body">
      <div class="mini-bar"><div class="mini-fill" id="fill-${item.id}"></div></div>

      <!-- Nom affiché -->
      <div class="card-name-row" id="name-row-${item.id}">
        <span class="card-name" id="cname-${item.id}" title="${item.file.name}">${baseName}</span>
        <button class="btn-rename" id="rename-btn-${item.id}" title="Renommer"><i class="ti ti-pencil"></i></button>
      </div>

      <!-- Édition inline -->
      <div class="card-name-edit" id="name-edit-${item.id}">
        <input type="text" id="name-input-${item.id}" value="${baseName}" autocomplete="off" />
        <button class="btn-rename-ok" id="name-ok-${item.id}" title="Valider"><i class="ti ti-check"></i></button>
      </div>

      <div class="card-meta" id="sizes-${item.id}"><span>${fmtBytes(item.file.size)}</span></div>
      <div class="card-foot">
        <span class="card-ext">${ext} → webp</span>
        <div class="card-btns">
          <button class="btn-dl" id="dl-${item.id}"><i class="ti ti-download"></i> dl</button>
          <button class="btn-rm" aria-label="Supprimer">✕</button>
        </div>
      </div>
    </div>`;

  // Thumb click → modal
  card.querySelector(".thumb").addEventListener("click", () => openModal(item));
  card
    .querySelector(".btn-dl")
    .addEventListener("click", () => downloadOne(item.id));
  card
    .querySelector(".btn-rm")
    .addEventListener("click", () => removeCard(item.id));

  // Rename — clic sur le nom ou le crayon
  card.querySelector(`#cname-${item.id}`).addEventListener("click", (e) => {
    e.stopPropagation();
    openInlineRename(item);
  });
  card
    .querySelector(`#rename-btn-${item.id}`)
    .addEventListener("click", (e) => {
      e.stopPropagation();
      openInlineRename(item);
    });
  card.querySelector(`#name-ok-${item.id}`).addEventListener("click", (e) => {
    e.stopPropagation();
    confirmInlineRename(item);
  });
  card
    .querySelector(`#name-input-${item.id}`)
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        confirmInlineRename(item);
        focusNextRename(item);
      }
      if (e.key === "Tab") {
        e.preventDefault();
        confirmInlineRename(item);
        focusNextRename(item);
      }
      if (e.key === "Escape") {
        closeInlineRename(item);
      }
    });

  el("grid").appendChild(card);
}

function openInlineRename(item) {
  el(`name-row-${item.id}`).style.display = "none";
  const editRow = el(`name-edit-${item.id}`);
  editRow.classList.add("active");
  const input = el(`name-input-${item.id}`);
  input.value = item.outputName;
  setTimeout(() => {
    input.focus();
    input.select();
  }, 30);
}

function closeInlineRename(item) {
  el(`name-row-${item.id}`).style.display = "";
  el(`name-edit-${item.id}`).classList.remove("active");
}

function focusNextRename(item) {
  const idx = state.files.findIndex((f) => f.id === item.id);
  const next = state.files[idx + 1];
  if (next) openInlineRename(next);
}

function confirmInlineRename(item) {
  const val = el(`name-input-${item.id}`).value.trim();
  if (!val) {
    toast("nom vide", "err");
    return;
  }
  item.outputName = val;
  el(`cname-${item.id}`).textContent = val;
  closeInlineRename(item);
  toast(`Renommé → ${val}.webp`);
}

function updateCard(item) {
  const card = document.querySelector(`[data-id="${item.id}"]`);
  if (!card) return;
  const badge = el(`badge-${item.id}`);
  const fill = el(`fill-${item.id}`);
  const sizes = el(`sizes-${item.id}`);
  const dlBtn = el(`dl-${item.id}`);

  if (item.status === "converting") {
    card.className = "card converting";
    badge.className = "thumb-badge b-conv";
    badge.textContent = "conversion…";
    fill.style.width = "45%";
    if (!card.querySelector(".spinner")) {
      const sp = document.createElement("div");
      sp.className = "spinner";
      card.querySelector(".thumb").appendChild(sp);
    }
  }
  if (item.status === "done") {
    card.className = "card done";
    badge.className = "thumb-badge b-done";
    badge.textContent = "ok";
    fill.className = "mini-fill done";
    fill.style.width = "100%";
    card.querySelector(".spinner")?.remove();
    const pct = Math.round((1 - item.convBlob.size / item.file.size) * 100);
    sizes.innerHTML = `
      <span>${fmtBytes(item.file.size)}</span>
      <span class="meta-arr">→</span>
      <span>${fmtBytes(item.convBlob.size)}</span>
      <span class="meta-arr">·</span>
      <span class="${pct >= 0 ? "meta-pos" : "meta-neg"}">${pct >= 0 ? "−" + pct : "+" + Math.abs(pct)}%</span>`;
    dlBtn.classList.add("on");
  }
  if (item.status === "error") {
    card.className = "card error";
    badge.className = "thumb-badge b-err";
    badge.textContent = "erreur";
    fill.className = "mini-fill err";
    fill.style.width = "100%";
    card.querySelector(".spinner")?.remove();
  }
}

/* ── FILES ──────────────────────────────────────────────── */
function readFile(item) {
  const r = new FileReader();
  r.onload = (e) => {
    item.origUrl = e.target.result;
    const img = document.querySelector(`[data-id="${item.id}"] .thumb img`);
    if (img) img.src = item.origUrl;
  };
  r.readAsDataURL(item.file);
}

function addFiles(files) {
  const valid = files.filter(
    (f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name),
  );
  if (!valid.length) {
    toast("aucun format reconnu", "err");
    return;
  }
  valid.forEach((file) => {
    const item = {
      id: state.nid++,
      file,
      status: "pending",
      origUrl: null,
      convBlob: null,
      convUrl: null,
      outputName: "",
    };
    state.files.push(item);
    renderCard(item);
    readFile(item);
  });
  updateToolbar();
  el("btn-convert").disabled = false;
}

function removeCard(id) {
  state.files = state.files.filter((f) => f.id !== id);
  document.querySelector(`[data-id="${id}"]`)?.remove();
  updateToolbar();
  updateSummary();
}

/* ── RESIZE HELPERS ─────────────────────────────────────── */
function getResizeDims(origW, origH) {
  const doResize = el("ren").checked;
  if (!doResize) return { tw: origW, th: origH };
  const mode =
    document.querySelector(".rmode-tab.active")?.dataset.mode || "px";
  const keep = el("kr").checked;
  let tw = origW,
    th = origH;
  if (mode === "pct") {
    const pct = parseFloat(el("rpct").value) || 100;
    tw = Math.round((origW * pct) / 100);
    th = Math.round((origH * pct) / 100);
  } else {
    const rw = parseInt(el("rw").value) || 0;
    const rh = parseInt(el("rh").value) || 0;
    if (rw && rh) {
      tw = rw;
      th = rh;
    } else if (rw && keep) {
      th = Math.round((rw * origH) / origW);
      tw = rw;
    } else if (rh && keep) {
      tw = Math.round((rh * origW) / origH);
      th = rh;
    } else if (rw) tw = rw;
    else if (rh) th = rh;
  }
  return { tw: Math.max(1, tw), th: Math.max(1, th) };
}

/* ── CONVERSION ─────────────────────────────────────────── */
function convertItem(item) {
  item.status = "converting";
  updateCard(item);
  return new Promise((resolve) => {
    const quality = parseInt(el("quality").value);
    const lossless = el("ll").checked;
    const draw = (imgEl) => {
      const origW = imgEl.naturalWidth || 800;
      const origH = imgEl.naturalHeight || 600;
      const { tw, th } = getResizeDims(origW, origH);
      try {
        const cv = document.createElement("canvas");
        cv.width = tw;
        cv.height = th;
        cv.getContext("2d").drawImage(imgEl, 0, 0, tw, th);
        cv.toBlob(
          (blob) => {
            if (!blob) {
              item.status = "error";
              updateCard(item);
              resolve();
              return;
            }
            item.convBlob = blob;
            item.convUrl = URL.createObjectURL(blob);
            item.status = "done";
            updateCard(item);
            resolve();
          },
          "image/webp",
          lossless ? 1.0 : quality / 100,
        );
      } catch {
        item.status = "error";
        updateCard(item);
        resolve();
      }
    };
    const img = new Image();
    img.onload = () => draw(img);
    img.onerror = () => {
      const r = new FileReader();
      r.onload = (e) => {
        const i2 = new Image();
        i2.onload = () => draw(i2);
        i2.onerror = () => {
          item.status = "error";
          updateCard(item);
          resolve();
        };
        i2.src = e.target.result;
      };
      r.readAsDataURL(item.file);
    };
    if (item.origUrl?.startsWith("data:")) img.src = item.origUrl;
    else {
      const r = new FileReader();
      r.onload = (e) => (img.src = e.target.result);
      r.readAsDataURL(item.file);
    }
  });
}

async function convertAll() {
  const pending = state.files.filter(
    (f) => f.status === "pending" || f.status === "error",
  );
  if (!pending.length) {
    toast("tout est déjà converti");
    return;
  }
  el("btn-convert").disabled = true;
  const prog = el("progress");
  prog.classList.add("on");
  const pbar = el("pbar");
  let done = 0;
  for (const item of pending) {
    await convertItem(item);
    pbar.style.width = Math.round((++done / pending.length) * 100) + "%";
  }
  const ok = state.files.filter((f) => f.status === "done");
  if (ok.length) {
    el("btn-zip").disabled = false;
    toast(
      `${ok.length} image${ok.length > 1 ? "s" : ""} convertie${ok.length > 1 ? "s" : ""}`,
    );
    updateSummary();
  }
  setTimeout(() => prog.classList.remove("on"), 600);
  updateToolbar();
}

/* ── DOWNLOADS ──────────────────────────────────────────── */
function downloadOne(id) {
  const item = state.files.find((f) => f.id === id);
  if (!item?.convUrl) return;
  const a = document.createElement("a");
  a.href = item.convUrl;
  a.download =
    (item.outputName || item.file.name.replace(/\.[^.]+$/, "")) + ".webp";
  a.click();
}

async function downloadZip() {
  const done = state.files.filter((f) => f.status === "done");
  if (!done.length) {
    toast("aucune image convertie", "err");
    return;
  }
  const zip = new JSZip();
  for (const item of done) {
    zip.file(
      (item.outputName || item.file.name.replace(/\.[^.]+$/, "")) + ".webp",
      await item.convBlob.arrayBuffer(),
    );
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "webp-" + Date.now() + ".zip";
  a.click();
  toast(`zip — ${done.length} fichiers`);
}

/* ── MODAL avant/après ──────────────────────────────────── */
function setSlider(pct) {
  el("mdivider").style.left = pct + "%";
  el("mhandle").style.left = pct + "%";
  el("mlayer-before").style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
}

function openModal(item) {
  if (!item.convUrl) return;
  el("mfname").textContent = item.outputName
    ? item.outputName + ".webp"
    : item.file.name;
  el("mimg-before").src = item.origUrl;
  el("mimg-after").src = item.convUrl;
  el("mbl").textContent = fmtBytes(item.file.size);
  el("mal").textContent = fmtBytes(item.convBlob.size);
  const pct = Math.round((1 - item.convBlob.size / item.file.size) * 100);
  el("mgain").textContent = (pct >= 0 ? "−" : "+") + Math.abs(pct) + "%";
  setSlider(50);
  el("mo").classList.add("open");
}
function closeModal() {
  el("mo").classList.remove("open");
}

(() => {
  const stage = el("mstage");
  let drag = false;
  function getPct(e) {
    const r = stage.getBoundingClientRect(),
      x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    return Math.max(0, Math.min(100, (x / r.width) * 100));
  }
  stage.addEventListener("mousedown", (e) => {
    drag = true;
    setSlider(getPct(e));
    e.preventDefault();
  });
  stage.addEventListener(
    "touchstart",
    (e) => {
      drag = true;
      setSlider(getPct(e));
    },
    { passive: true },
  );
  window.addEventListener("mousemove", (e) => {
    if (drag) setSlider(getPct(e));
  });
  window.addEventListener(
    "touchmove",
    (e) => {
      if (drag) setSlider(getPct(e));
    },
    { passive: true },
  );
  window.addEventListener("mouseup", () => {
    drag = false;
  });
  window.addEventListener("touchend", () => {
    drag = false;
  });
})();

el("mclose").addEventListener("click", closeModal);
el("mo").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

/* ── DROP (WebP) ────────────────────────────────────────── */
const drop = document.querySelector("#section-webp .drop");
const fi = el("fi");
drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("over");
  addFiles([...e.dataTransfer.files]);
});
fi.addEventListener("change", () => {
  addFiles([...fi.files]);
  fi.value = "";
});

/* ── QUALITY SLIDER ─────────────────────────────────────── */
function updateSlider() {
  const val = el("quality").value;
  el("qv").textContent = val;
  el("quality").style.background =
    `linear-gradient(to right, #eab308 ${val}%, #334155 ${val}%)`;
}
el("quality").addEventListener("input", updateSlider);
updateSlider();

/* ── RESIZE MODE TABS ───────────────────────────────────── */
document.querySelectorAll(".rmode-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".rmode-tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const mode = tab.dataset.mode;
    el("resize-px").classList.toggle("hidden", mode !== "px");
    el("resize-pct").classList.toggle("hidden", mode !== "pct");
  });
});
document.querySelectorAll(".pct-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".pct-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    el("rpct").value = btn.dataset.pct;
  });
});
el("rpct").addEventListener("input", () => {
  document
    .querySelectorAll(".pct-btn")
    .forEach((b) => b.classList.remove("active"));
});
el("ren").addEventListener("change", () => {
  el("resize-row").classList.toggle("active", el("ren").checked);
});

/* ── BUTTONS (WebP) ─────────────────────────────────────── */
el("btn-convert").addEventListener("click", convertAll);
el("btn-zip").addEventListener("click", downloadZip);
el("btn-zip2").addEventListener("click", downloadZip);
el("btn-clear").addEventListener("click", () => {
  state.files = [];
  el("grid").innerHTML = "";
  el("summary-bar").classList.remove("on");
  el("btn-zip").disabled = true;
  el("btn-convert").disabled = true;
  updateToolbar();
});

/* ── PRESETS ────────────────────────────────────────────── */
const PRESETS = {
  web: { quality: 80, method: "4", lossless: false },
  photo: { quality: 90, method: "6", lossless: false },
  max: { quality: 100, method: "6", lossless: true },
  turbo: { quality: 65, method: "0", lossless: false },
};
const METHOD_LABELS = {
  6: "Max — meilleure qualité",
  4: "Équilibrée — recommandée",
  2: "Rapide",
  0: "Ultra-rapide",
};

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  el("quality").value = p.quality;
  el("method").value = p.method;
  el("ll").checked = p.lossless;
  updateSlider();
  // sync custom select
  document
    .querySelectorAll("#method-dropdown .custom-select-option")
    .forEach((o) => {
      o.classList.toggle("selected", o.dataset.value === p.method);
    });
  el("method-label").textContent = METHOD_LABELS[p.method] || "";
  // active preset
  document
    .querySelectorAll(".preset-card")
    .forEach((c) => c.classList.remove("active"));
  document.querySelector(`[data-preset="${name}"]`)?.classList.add("active");
}
document.querySelectorAll(".preset-card").forEach((card) => {
  card.addEventListener("click", () => applyPreset(card.dataset.preset));
});
["quality", "ll"].forEach((id) => {
  el(id).addEventListener(id === "ll" ? "change" : "input", () => {
    document
      .querySelectorAll(".preset-card")
      .forEach((c) => c.classList.remove("active"));
  });
});

/* ── WEBP CHECK ─────────────────────────────────────────── */
(() => {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  c.toBlob((b) => {
    if (!b) el("nav-badge").textContent = "webp non supporté";
  }, "image/webp");
})();

/* ════════════════════════════════════════════════════════════
   COMPRESSEUR JPG / PNG
   ════════════════════════════════════════════════════════════ */
const compState = { files: [], nid: 0 };
let compFmt = "jpeg"; // format de sortie actif

/* ── Format buttons ─────────────────────────────────────── */
document.querySelectorAll(".comp-fmt-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".comp-fmt-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    compFmt = btn.dataset.fmt;
  });
});

/* ── Quality slider (compresseur) ───────────────────────── */
function updateCompSlider() {
  const val = el("comp-quality").value;
  el("comp-qv").textContent = val;
  el("comp-quality").style.background =
    `linear-gradient(to right, #eab308 ${val}%, #334155 ${val}%)`;
}
el("comp-quality").addEventListener("input", updateCompSlider);
updateCompSlider();

/* ── Drop (compresseur) ─────────────────────────────────── */
const compDrop = el("comp-drop");
const compFi = el("comp-fi");

compDrop.addEventListener("dragover", (e) => {
  e.preventDefault();
  compDrop.classList.add("over");
});
compDrop.addEventListener("dragleave", () => compDrop.classList.remove("over"));
compDrop.addEventListener("drop", (e) => {
  e.preventDefault();
  compDrop.classList.remove("over");
  compAddFiles([...e.dataTransfer.files]);
});
compFi.addEventListener("change", () => {
  compAddFiles([...compFi.files]);
  compFi.value = "";
});

function compAddFiles(files) {
  const valid = files.filter((f) => f.type.startsWith("image/"));
  if (!valid.length) {
    toast("aucun format reconnu", "err");
    return;
  }
  valid.forEach((file) => {
    const item = {
      id: compState.nid++,
      file,
      status: "pending",
      origUrl: null,
      compBlob: null,
      compUrl: null,
    };
    compState.files.push(item);
    compRenderCard(item);
    // read preview
    const r = new FileReader();
    r.onload = (e) => {
      item.origUrl = e.target.result;
      const thumb = document.querySelector(
        `[data-cid="${item.id}"] .comp-thumb`,
      );
      if (thumb) thumb.src = item.origUrl;
    };
    r.readAsDataURL(file);
  });
  el("comp-results").classList.add("on");
  el("comp-btn-run").disabled = false;
  el("comp-btn-clear").disabled = false;
  compUpdateResultsTitle();
}

/* ── Render card (compresseur) ──────────────────────────── */
function compRenderCard(item) {
  const card = document.createElement("div");
  card.className = "comp-card";
  card.dataset.cid = item.id;
  card.innerHTML = `
    <img class="comp-thumb" src="" alt="" />
    <div class="comp-info">
      <div class="comp-name">${item.file.name}</div>
      <div class="comp-sizes" id="comp-sizes-${item.id}">
        <span class="comp-size-before">${fmtBytes(item.file.size)}</span>
        <span class="comp-status" id="comp-status-${item.id}">en attente</span>
      </div>
    </div>
    <div class="comp-actions">
      <button class="comp-dl-btn" id="comp-dl-${item.id}"><i class="ti ti-download"></i> dl</button>
      <button class="comp-rm-btn" title="Supprimer">✕</button>
    </div>`;

  card
    .querySelector(".comp-dl-btn")
    .addEventListener("click", () => compDownloadOne(item.id));
  card
    .querySelector(".comp-rm-btn")
    .addEventListener("click", () => compRemoveCard(item.id));
  el("comp-grid").appendChild(card);
}

function compUpdateCard(item) {
  const card = document.querySelector(`[data-cid="${item.id}"]`);
  if (!card) return;
  const sizesEl = el(`comp-sizes-${item.id}`);
  const statusEl = el(`comp-status-${item.id}`);
  const dlBtn = el(`comp-dl-${item.id}`);

  if (item.status === "compressing") {
    card.className = "comp-card";
    statusEl.textContent = "compression…";
    // add spinner
    if (!sizesEl.querySelector(".comp-spinner")) {
      const sp = document.createElement("div");
      sp.className = "comp-spinner";
      sizesEl.appendChild(sp);
    }
  }
  if (item.status === "done") {
    card.className = "comp-card done";
    sizesEl.querySelector(".comp-spinner")?.remove();
    const pct = Math.round((1 - item.compBlob.size / item.file.size) * 100);
    sizesEl.innerHTML = `
      <span class="comp-size-before">${fmtBytes(item.file.size)}</span>
      <span class="comp-size-arrow">→</span>
      <span class="comp-size-after">${fmtBytes(item.compBlob.size)}</span>
      <span class="comp-gain ${pct < 0 ? "neg" : ""}">${pct >= 0 ? "−" + pct : "+" + Math.abs(pct)}%</span>`;
    dlBtn.classList.add("on");
  }
  if (item.status === "error") {
    card.className = "comp-card error";
    sizesEl.querySelector(".comp-spinner")?.remove();
    statusEl.textContent = "erreur";
  }
}

function compRemoveCard(id) {
  compState.files = compState.files.filter((f) => f.id !== id);
  document.querySelector(`[data-cid="${id}"]`)?.remove();
  compUpdateResultsTitle();
  compUpdateSummary();
  if (!compState.files.length) {
    el("comp-results").classList.remove("on");
    el("comp-btn-run").disabled = true;
    el("comp-btn-clear").disabled = true;
  }
}

function compUpdateResultsTitle() {
  const n = compState.files.length;
  el("comp-results-title").textContent = `${n} fichier${n > 1 ? "s" : ""}`;
}

/* ── Compression engine ─────────────────────────────────── */
function compressItem(item) {
  item.status = "compressing";
  compUpdateCard(item);
  return new Promise((resolve) => {
    const quality = parseInt(el("comp-quality").value) / 100;
    const mimeOut =
      compFmt === "png"
        ? "image/png"
        : compFmt === "webp"
          ? "image/webp"
          : "image/jpeg";

    const draw = (imgEl) => {
      const cv = document.createElement("canvas");
      cv.width = imgEl.naturalWidth || 800;
      cv.height = imgEl.naturalHeight || 600;
      cv.getContext("2d").drawImage(imgEl, 0, 0);
      cv.toBlob(
        (blob) => {
          if (!blob) {
            item.status = "error";
            compUpdateCard(item);
            resolve();
            return;
          }
          item.compBlob = blob;
          item.compUrl = URL.createObjectURL(blob);
          item.status = "done";
          compUpdateCard(item);
          resolve();
        },
        mimeOut,
        mimeOut === "image/png" ? undefined : quality,
      );
    };

    const img = new Image();
    img.onload = () => draw(img);
    img.onerror = () => {
      item.status = "error";
      compUpdateCard(item);
      resolve();
    };
    if (item.origUrl) img.src = item.origUrl;
    else {
      const r = new FileReader();
      r.onload = (e) => (img.src = e.target.result);
      r.readAsDataURL(item.file);
    }
  });
}

async function compressAll() {
  const pending = compState.files.filter(
    (f) => f.status === "pending" || f.status === "error",
  );
  if (!pending.length) {
    toast("tout est déjà compressé");
    return;
  }
  el("comp-btn-run").disabled = true;
  for (const item of pending) {
    await compressItem(item);
  }
  const ok = compState.files.filter((f) => f.status === "done");
  if (ok.length) {
    toast(
      `${ok.length} image${ok.length > 1 ? "s" : ""} compressée${ok.length > 1 ? "s" : ""}`,
    );
    compUpdateSummary();
  }
  el("comp-btn-run").disabled = false;
}

/* ── Summary (compresseur) ──────────────────────────────── */
function compUpdateSummary() {
  const done = compState.files.filter((f) => f.status === "done");
  const bar = el("comp-summary");
  if (!done.length) {
    bar.classList.remove("on");
    return;
  }
  const tb = done.reduce((a, f) => a + f.file.size, 0);
  const ta = done.reduce((a, f) => a + f.compBlob.size, 0);
  const pct = Math.round((1 - ta / tb) * 100);
  bar.classList.add("on");
  el("csc").textContent = done.length;
  el("csb").textContent = fmtBytes(tb);
  el("csa").textContent = fmtBytes(ta);
  el("css2").textContent = (pct >= 0 ? "−" : "+") + Math.abs(pct) + "%";
}

/* ── Downloads (compresseur) ────────────────────────────── */
function compDownloadOne(id) {
  const item = compState.files.find((f) => f.id === id);
  if (!item?.compUrl) return;
  const ext = compFmt === "png" ? "png" : compFmt === "webp" ? "webp" : "jpg";
  const a = document.createElement("a");
  a.href = item.compUrl;
  a.download = item.file.name.replace(/\.[^.]+$/, "") + "-compressed." + ext;
  a.click();
}

async function compDownloadZip() {
  const done = compState.files.filter((f) => f.status === "done");
  if (!done.length) {
    toast("aucune image compressée", "err");
    return;
  }
  const ext = compFmt === "png" ? "png" : compFmt === "webp" ? "webp" : "jpg";
  const zip = new JSZip();
  for (const item of done) {
    zip.file(
      item.file.name.replace(/\.[^.]+$/, "") + "-compressed." + ext,
      await item.compBlob.arrayBuffer(),
    );
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "compressed-" + Date.now() + ".zip";
  a.click();
  toast(`zip — ${done.length} fichiers`);
}

el("comp-btn-run").addEventListener("click", compressAll);
el("comp-btn-zip").addEventListener("click", compDownloadZip);
el("comp-btn-zip-top").addEventListener("click", compDownloadZip);
el("comp-btn-clear").addEventListener("click", () => {
  compState.files = [];
  el("comp-grid").innerHTML = "";
  el("comp-results").classList.remove("on");
  el("comp-summary").classList.remove("on");
  el("comp-btn-run").disabled = true;
  el("comp-btn-clear").disabled = true;
});
