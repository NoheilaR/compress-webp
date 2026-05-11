/* ============================================================
   WEBP CONVERTER — main.js
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

/* ── SUMMARY BAR (en haut) ──────────────────────────────── */
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
  item.outputName = baseName; // editable name

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
      <div class="card-name-row">
        <span class="card-name" id="cname-${item.id}" title="${item.file.name}">${baseName}</span>
        <button class="btn-rename" id="rename-btn-${item.id}" title="Renommer"><i class="ti ti-pencil"></i></button>
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

  card.querySelector(".thumb").addEventListener("click", () => openModal(item));
  card
    .querySelector(".btn-dl")
    .addEventListener("click", () => downloadOne(item.id));
  card
    .querySelector(".btn-rm")
    .addEventListener("click", () => removeCard(item.id));
  card
    .querySelector(".btn-rename")
    .addEventListener("click", () => openRename(item));

  el("grid").appendChild(card);
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
    } else if (rw) {
      tw = rw;
    } else if (rh) {
      th = rh;
    }
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

/* ── RENAME ─────────────────────────────────────────────── */
let _renameTarget = null;

function openRename(item) {
  _renameTarget = item;
  el("rename-input").value =
    item.outputName || item.file.name.replace(/\.[^.]+$/, "");
  el("rename-mo").classList.add("open");
  setTimeout(() => el("rename-input").select(), 50);
}

function closeRename() {
  el("rename-mo").classList.remove("open");
  _renameTarget = null;
}

function confirmRename() {
  if (!_renameTarget) return;
  const val = el("rename-input").value.trim();
  if (!val) {
    toast("nom vide", "err");
    return;
  }
  _renameTarget.outputName = val;
  const nameEl = el(`cname-${_renameTarget.id}`);
  if (nameEl) nameEl.textContent = val;
  toast(`Renommé → ${val}.webp`);
  closeRename();
}

el("rename-close").addEventListener("click", closeRename);
el("rename-cancel").addEventListener("click", closeRename);
el("rename-confirm").addEventListener("click", confirmRename);
el("rename-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") confirmRename();
  if (e.key === "Escape") closeRename();
});
el("rename-mo").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeRename();
});

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

/* ── DROP ───────────────────────────────────────────────── */
const drop = document.querySelector(".drop");
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

/* boutons % rapides */
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

/* ── RESIZE TOGGLE ──────────────────────────────────────── */
el("ren").addEventListener("change", () => {
  el("resize-row").classList.toggle("active", el("ren").checked);
});

/* ── BUTTONS ────────────────────────────────────────────── */
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
  web: { quality: 80, method: 4, lossless: false },
  photo: { quality: 90, method: 6, lossless: false },
  max: { quality: 100, method: 6, lossless: true },
  turbo: { quality: 65, method: 0, lossless: false },
};
function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  el("quality").value = p.quality;
  el("method").value = p.method;
  el("ll").checked = p.lossless;
  updateSlider();
  document
    .querySelectorAll(".preset-card")
    .forEach((c) => c.classList.remove("active"));
  document.querySelector(`[data-preset="${name}"]`)?.classList.add("active");
}
document.querySelectorAll(".preset-card").forEach((card) => {
  card.addEventListener("click", () => applyPreset(card.dataset.preset));
});
["quality", "method", "ll"].forEach((id) => {
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
