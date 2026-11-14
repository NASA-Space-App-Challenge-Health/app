(function () {
  const main = document.querySelector("#main");
  const status = document.querySelector("#status");
  const disclaimer = document.querySelector("#disclaimer");
  const strip = document.querySelector("#alert-strip");
  const viewerSelect = document.querySelector("#viewer");
  const roleSelect = document.querySelector("#role");
  const demoBanner = document.querySelector("#demo-banner");
  const docs = document.querySelector("#api-docs");
  const navLinks = Array.from(document.querySelectorAll(".nav a"));

  const state = {
    payload: null,
    view: "dashboard",
    demoStep: 0,
    error: "",
    requestSeq: 0,
  };

  function apiBase() {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    if (fromQuery) return fromQuery.replace(/\/$/, "");
    if (typeof window.CREW_HEALTH_API_BASE === "string") {
      return window.CREW_HEALTH_API_BASE.replace(/\/$/, "");
    }
    return "http://127.0.0.1:8080";
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(function (entry) {
      const key = entry[0];
      const value = entry[1];
      if (value == null) return;
      if (key === "class") node.className = value;
      else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, String(value));
    });
    (children || []).forEach(function (child) {
      if (child == null || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function originBadge(origin) {
    const real = origin === "real";
    return el("span", { class: real ? "origin origin-real" : "origin origin-simulated" }, [
      real ? "Real NASA" : "Simulated",
    ]);
  }

  function bandLabel(band) {
    if (band === "nominal") return "Nominal";
    if (band === "watch") return "Watch";
    if (band === "concern" || band === "critical") return "Concern";
    return "No reading";
  }

  function formatNumber(value, digits) {
    if (value == null || Number.isNaN(Number(value))) return "No reading";
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: digits || 0,
      maximumFractionDigits: digits || 0,
    });
  }

  function viewFromHash() {
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (hash.startsWith("alerts")) return "alerts";
    if (hash.startsWith("demo")) return "demo";
    if (hash.startsWith("schedule")) return "schedule";
    if (hash.startsWith("insights")) return "insights";
    if (hash.startsWith("upload")) return "upload";
    if (hash.startsWith("check")) return "check";
    return "dashboard";
  }

  function setStatus(text) {
    status.textContent = text;
  }

  function firstSentence(text) {
    const clean = String(text || "").trim();
    const cut = clean.split(/(?<=\.)\s/)[0];
    return cut || clean;
  }

  function learnMore(parts) {
    const body = (parts || []).filter(Boolean);
    if (!body.length) return null;
    return el("details", { class: "learn-more" }, [
      el("summary", null, ["Learn more"]),
    ].concat(body));
  }

  function renderAlertStrip() {
    const alerts = (state.payload && state.payload.alerts) || [];
    const critical = alerts.filter(function (item) { return item.severity === "critical"; });
    strip.replaceChildren();
    if (!critical.length) return;
    const top = critical[0];
    const headline = top.public_title || top.title || "Emergency";
    const sentence = top.public_detail || firstSentence(top.detail);
    strip.append(el("article", { class: "alert-card" }, [
      el("a", { class: "alert-head", href: "#/alerts" }, [headline]),
      el("p", null, [sentence]),
      learnMore([
        top.detail && top.detail !== sentence ? el("p", null, [top.detail]) : null,
        top.suggested_action ? el("p", null, [top.suggested_action]) : null,
        sourceList(top.sources),
      ]),
    ]));
  }

  function sourceList(sources) {
    return el("p", null, (sources || []).flatMap(function (source, index) {
      const link = el("a", { href: source.url }, [source.title]);
      return index ? [" · ", link] : [link];
    }));
  }

  function renderDashboard() {
    const regions = state.payload.body || [];
    const selected = state.region || (regions[0] && regions[0].id) || "heart";
    state.region = selected;
    const region = regions.find(function (item) { return item.id === selected; }) || regions[0];
    main.dataset.state = region ? "ready" : "empty";
    if (!region) {
      main.replaceChildren(el("p", null, ["Body map is not loaded."]));
      return;
    }
    main.replaceChildren(el("div", { class: "body-layout" }, [
      bodySvg(regions, selected),
      el("article", { class: "card", id: "region-panel" }, [
        el("p", { class: "eyebrow" }, [(state.payload.viewer || "") + " · " + (state.payload.role || "")]),
        el("h2", null, [region.label]),
        el("p", null, [region.function]),
        learnMore([
          el("p", null, [region.why]),
          el("p", null, [region.spaceflight]),
          el("p", null, [region.prevention]),
          sourceList(region.sources),
        ]),
        memberSnapshot(),
      ]),
    ]));
    setStatus((state.payload.viewer || "Crew") + " · " + state.payload.role + ".");
  }

  function bodySvg(regions, selected) {
    const status = {};
    regions.forEach(function (region) { status[region.id] = region.status || "ready"; });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 220 460");
    svg.setAttribute("class", "body-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Clickable crew member figure");
    const parts = [
      ["head", "M110 28c22 0 36 16 36 36s-14 34-36 34-36-14-36-34 14-36 36-36z"],
      ["eyes", "M86 52h18M116 52h18", true],
      ["heart", "M110 150c-18-16-34-8-34 10 0 22 34 40 34 40s34-18 34-40c0-18-16-26-34-10z"],
      ["blood", "M78 168h64v28H78z"],
      ["muscles", "M62 210c-16 20-18 70-8 110h28V210z M138 210h28c10 40 8 90-8 110h-20z"],
      ["bones", "M96 250h28v120H96z"],
      ["environment", "M70 390h80v28H70z"],
    ];
    parts.forEach(function (part) {
      const id = part[0];
      const shape = document.createElementNS("http://www.w3.org/2000/svg", part[2] ? "path" : "path");
      shape.setAttribute("d", part[1]);
      shape.setAttribute("class", "region status-" + (status[id] || "ready") + (id === selected ? " selected" : ""));
      shape.setAttribute("tabindex", "0");
      shape.setAttribute("role", "button");
      shape.setAttribute("aria-label", id);
      if (part[2]) {
        shape.setAttribute("fill", "none");
        shape.setAttribute("stroke", "#00E5FF");
        shape.setAttribute("stroke-width", "4");
      }
      const choose = function () { state.region = id; render(); };
      shape.addEventListener("click", choose);
      shape.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(); }
      });
      svg.appendChild(shape);
    });
    return svg;
  }

  function memberSnapshot() {
    const member = (state.payload.crew || []).find(function (item) { return item.call_sign === state.payload.viewer; });
    if (!member || member.visible !== "full") {
      return el("p", { class: "hidden-note" }, ["Numbers for this member are hidden for this role. Emergency notices stay generic."]);
    }
    const lines = [el("h3", null, ["Visible indicators"])];
    (member.readings || []).slice(0, 4).forEach(function (reading) {
      lines.push(el("p", null, [originBadge(reading.origin), " " + reading.label + " " + formatNumber(reading.value, reading.decimals) + " " + reading.unit]));
    });
    (member.labs || []).slice(0, 4).forEach(function (lab) {
      lines.push(el("p", null, [originBadge("real"), " " + lab.analyte + " " + formatNumber(lab.value, 1) + " " + (lab.unit || "")]));
    });
    return el("div", null, lines);
  }

  function renderCrew(member) {
    const head = [
      el("div", { class: "badge-row" }, [
        el("h2", null, [member.call_sign]),
        el("span", { class: "band band-" + (member.overall_band || "unknown") }, ["Overall " + bandLabel(member.overall_band)]),
      ]),
      el("p", { class: "crew-meta" }, [member.role]),
    ];
    if (member.visible !== "full") {
      head.push(el("p", { class: "hidden-note" }, [
        "Alerts only. Numbers stay private.",
      ]));
      return el("article", { class: "card" }, head);
    }
    if (state.payload.viewer === member.call_sign) {
      head.push(el("button", {
        type: "button",
        onclick: function () { toggleShare(member); },
      }, [member.share_mode === "alerts_only" ? "Share full overview" : "Share alerts only"]));
    }
    head.push(el("h3", null, ["Simulated vitals"]));
    (member.readings || []).forEach(function (reading) {
      if (reading.indicator === "hygiene_hour") return;
      head.push(el("p", null, [
        originBadge(reading.origin),
        " " + reading.label + " " + formatNumber(reading.value, reading.decimals) + " " + reading.unit
          + " · " + bandLabel(reading.risk_band),
      ]));
    });
    head.push(el("h3", null, ["Real NASA labs, latest sample"]));
    (member.labs || []).forEach(function (lab) {
      head.push(el("p", null, [
        originBadge("real"),
        " " + lab.analyte + " " + formatNumber(lab.value, 1) + " " + lab.unit
          + " · " + (lab.flag || "no flag") + " · " + lab.timepoint + " · " + lab.source_study,
      ]));
    });
    return el("article", { class: "card" }, head);
  }

  function renderAlerts() {
    const alerts = state.payload.alerts || [];
    main.dataset.state = alerts.length ? "ready" : "empty";
    const blocks = [el("h2", null, ["Crew alerts"])];
    if (!alerts.length) blocks.push(el("p", null, ["No alerts."]));
    alerts.forEach(function (alert) {
      const sentence = alert.public_detail || firstSentence(alert.detail);
      blocks.push(el("article", { class: "alert-card" }, [
        el("div", { class: "badge-row" }, [
          originBadge(alert.origin),
          el("strong", null, [alert.public_title || alert.title]),
        ]),
        el("p", null, [sentence]),
        learnMore([
          alert.detail && alert.detail !== sentence ? el("p", null, [alert.detail]) : null,
          alert.suggested_action ? el("p", null, [alert.suggested_action]) : null,
          sourceList(alert.sources),
        ]),
      ]));
    });
    main.replaceChildren(el("section", null, blocks));
    setStatus(alerts.length + " alerts.");
  }

  function renderDemo() {
    const steps = (state.payload.demo && state.payload.demo.steps) || [];
    const step = steps[state.demoStep] || steps[0];
    main.dataset.state = step ? "ready" : "empty";
    if (!step) {
      main.replaceChildren(el("p", null, ["Demo script is not loaded."]));
      return;
    }
    const body = [
      el("p", { class: "eyebrow" }, [step.kicker + " / " + steps.length]),
      el("h2", null, [step.title]),
      el("p", null, [firstSentence(step.body)]),
    ];
    body.push(learnMore([
      el("p", null, [step.body]),
      step.alert ? renderNotice(step.alert) : null,
      step.recommendation ? renderNotice(step.recommendation) : null,
      step.hygiene ? el("p", null, [step.hygiene.suggestion || ""]) : null,
    ]));
    body.push(el("div", { class: "step-actions" }, [
      el("button", { type: "button", onclick: function () { moveDemo(-1); }, disabled: state.demoStep === 0 ? "true" : null }, ["Back"]),
      el("button", { type: "button", onclick: function () { moveDemo(1); }, disabled: state.demoStep >= steps.length - 1 ? "true" : null }, ["Next"]),
    ]));
    main.replaceChildren(el("section", { class: "step-card" }, body));
    setStatus("Guided demo, " + step.kicker + ".");
  }

  function renderNotice(item) {
    return el("article", null, [
      el("div", { class: "badge-row" }, [originBadge(item.origin), el("strong", null, [item.title])]),
      el("p", null, [firstSentence(item.detail)]),
      learnMore([
        el("p", null, [item.detail]),
        item.suggested_action ? el("p", null, [item.suggested_action]) : null,
        sourceList(item.sources),
      ]),
    ]);
  }

  function renderSchedule() {
    const hygiene = state.payload.hygiene || {};
    main.dataset.state = "ready";
    main.replaceChildren(el("section", { class: "card" }, [
      el("div", { class: "badge-row" }, [originBadge("simulated"), el("h2", null, [hygiene.station || "Hygiene station"])]),
      el("p", null, [(hygiene.order || []).join(" → ")]),
      learnMore([
        el("p", null, [hygiene.suggestion || ""]),
        el("p", null, ["Estimated from simulated fluid intake. Not a measured bathroom time."]),
      ]),
    ]));
    setStatus("Hygiene estimate ready.");
  }

  function renderInsights() {
    const insights = state.payload.insights || {};
    const issues = insights.common_issues || [];
    const maxCount = issues.reduce(function (max, item) { return Math.max(max, item.count); }, 1);
    const preventable = insights.preventable || [];
    const extremes = insights.extremes || {};
    main.dataset.state = "ready";
    const issueCards = issues.map(function (item) {
      return el("article", { class: "card" }, [
        el("h3", null, [item.analyte]),
        el("p", null, [item.flag + " · " + item.panel + " · " + item.count + " samples"]),
        el("div", { class: "bar", style: "width:" + Math.max(8, (item.count / maxCount) * 100) + "%" }),
      ]);
    });
    const extremeRows = Object.entries(extremes).filter(function (entry) { return entry[1]; }).map(function (entry) {
      const value = entry[1];
      const label = value.crew_id
        ? value.crew_id + " " + value.timepoint + " " + value.value + " " + (value.unit || "")
        : value.instrument_id + " " + value.value + " " + value.unit + " at " + value.recorded_at;
      return el("tr", null, [el("th", null, [entry[0].replaceAll("_", " ")]), el("td", null, [label])]);
    });
    main.replaceChildren(el("section", null, [
      el("h2", null, ["Out-of-range labs"]),
      el("p", null, [issues.length + " common flags. " + preventable.length + " got worse on the next draw."]),
      learnMore([el("p", null, ["Counts use the reference range printed on each Inspiration4 row. Real NASA."])]),
      el("div", { class: "insight-grid" }, issueCards),
      el("h3", null, ["Extremes"]),
      el("table", null, [el("tbody", null, extremeRows)]),
      el("p", null, [(insights.space_weather_events_in_file || 0) + " SEP rows. Real NASA."]),
    ]));
    setStatus("Insights use the committed NASA tables.");
  }

  function renderUpload() {
    main.dataset.state = "ready";
    const form = el("form", { class: "upload-card", onsubmit: submitUpload }, [
      el("h2", null, ["Upload a vitals CSV"]),
      el("p", null, ["CSV columns: crew_id, indicator, value, recorded_at."]),
      learnMore([el("p", null, ["Uploads are stored as simulated, not as NASA data."])]),
      el("input", { type: "file", id: "csv-file", accept: ".csv,text/csv", required: "true" }),
      el("button", { type: "submit" }, ["Upload"]),
      el("p", { id: "upload-result", class: "status" }, [""]),
    ]);
    main.replaceChildren(form);
    setStatus("Upload is ready.");
  }

  function renderCheck() {
    const member = (state.payload.crew || []).find(function (item) { return item.call_sign === state.payload.viewer; });
    main.dataset.state = "ready";
    if (!member) {
      main.replaceChildren(el("p", null, ["Choose a member first."]));
      return;
    }
    const form = el("form", { class: "upload-card", onsubmit: submitNote }, [
      el("h2", null, ["Typed check-in"]),
      el("p", null, ["Private to you, the CMO, and the flight surgeon."]),
      learnMore([el("p", null, ["OCHMO-TB-044 page 9 shows a 15-minute private medical conference, including before and after EVA."])]),
      el("label", { for: "note-kind" }, ["Kind"]),
      el("select", { id: "note-kind" }, [
        el("option", { value: "symptom" }, ["Symptom or periodic status"]),
        el("option", { value: "space_sickness" }, ["Space-sickness self-check"]),
        el("option", { value: "eva" }, ["Pre/post-EVA checklist"]),
        el("option", { value: "noise" }, ["Noise or hearing note"]),
        el("option", { value: "exercise" }, ["Exercise log"]),
      ]),
      el("label", { for: "note-region" }, ["Body region"]),
      el("select", { id: "note-region" }, (state.payload.body || []).map(function (region) {
        return el("option", { value: region.id }, [region.label]);
      })),
      el("textarea", { id: "note-text", required: "true", rows: "4" }, []),
      el("button", { type: "submit" }, ["Save note"]),
      el("p", { id: "note-result", class: "status" }, [""]),
    ]);
    const image = el("form", { class: "upload-card", onsubmit: submitImage }, [
      el("h2", null, ["Ultrasound or camera image"]),
      el("p", null, ["Queued for review. The app does not read the image."]),
      el("input", { type: "file", id: "image-file", accept: "image/*", required: "true" }),
      el("button", { type: "submit" }, ["Queue image"]),
      el("p", { id: "image-result", class: "status" }, [""]),
    ]);
    main.replaceChildren(el("div", { class: "insight-grid" }, [form, image]));
    setStatus("Check-in forms are private to self, CMO, and flight surgeon.");
  }

  async function submitNote(event) {
    event.preventDefault();
    const member = (state.payload.crew || []).find(function (item) { return item.call_sign === state.payload.viewer; });
    const result = document.querySelector("#note-result");
    const response = await fetch(apiBase() + "/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        crew_id: member.id,
        kind: document.querySelector("#note-kind").value,
        body_region: document.querySelector("#note-region").value,
        note: document.querySelector("#note-text").value,
      }),
    });
    const body = await response.json();
    result.textContent = response.ok ? "Saved for " + body.audience + "." : (body.detail || "Could not save.");
  }

  async function submitImage(event) {
    event.preventDefault();
    const member = (state.payload.crew || []).find(function (item) { return item.call_sign === state.payload.viewer; });
    const result = document.querySelector("#image-result");
    const data = new FormData();
    data.append("file", document.querySelector("#image-file").files[0]);
    const region = (state.payload.body && state.payload.body[0] && state.payload.body[0].id) || "heart";
    const response = await fetch(apiBase() + "/api/images?crew_id=" + member.id + "&body_region=" + region + "&note=ultrasound", {
      method: "POST",
      body: data,
    });
    const body = await response.json();
    result.textContent = response.ok ? body.review : (body.detail || "Could not queue the image.");
  }

  async function submitUpload(event) {
    event.preventDefault();
    const input = document.querySelector("#csv-file");
    const result = document.querySelector("#upload-result");
    const data = new FormData();
    data.append("file", input.files[0]);
    result.textContent = "Uploading.";
    try {
      const response = await fetch(apiBase() + "/api/uploads", { method: "POST", body: data });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || "Upload failed");
      result.textContent = "Stored " + body.inserted + " row(s) as " + body.origin + ".";
      load();
    } catch (error) {
      result.textContent = error.message || "Upload failed.";
    }
  }

  async function toggleShare(member) {
    const next = member.share_mode === "alerts_only" ? "full" : "alerts_only";
    await fetch(apiBase() + "/api/crew/" + member.id + "/sharing", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ share_mode: next }),
    });
    load();
  }

  function moveDemo(delta) {
    const steps = (state.payload.demo && state.payload.demo.steps) || [];
    state.demoStep = Math.max(0, Math.min(steps.length - 1, state.demoStep + delta));
    render();
  }

  function render() {
    navLinks.forEach(function (link) {
      const href = link.getAttribute("href");
      const current = (href === "#/" && state.view === "dashboard") || href === "#/" + state.view;
      if (current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (!state.payload) {
      main.dataset.state = state.error ? "error" : "loading";
      main.replaceChildren(el("p", { class: state.error ? "error-box" : "status", role: state.error ? "alert" : null }, [
        state.error || "Loading the crew board.",
      ]));
      return;
    }
    disclaimer.textContent = state.payload.disclaimer || "";
    renderAlertStrip();
    if (state.view === "alerts") renderAlerts();
    else if (state.view === "demo") renderDemo();
    else if (state.view === "schedule") renderSchedule();
    else if (state.view === "insights") renderInsights();
    else if (state.view === "upload") renderUpload();
    else if (state.view === "check") renderCheck();
    else renderDashboard();
  }

  function fillViewer() {
    const crew = (state.payload && state.payload.crew) || [];
    const current = viewerSelect.value;
    viewerSelect.replaceChildren();
    crew.forEach(function (member) {
      viewerSelect.append(el("option", { value: member.call_sign }, [member.call_sign + " · " + member.full_name]));
    });
    if (current) viewerSelect.value = current;
    else if (state.payload && state.payload.viewer) viewerSelect.value = state.payload.viewer;
  }

  async function load() {
    const seq = ++state.requestSeq;
    const viewer = viewerSelect.value || "C001";
    const role = roleSelect.value || "self";
    setStatus("Loading the crew board.");
    try {
      const response = await fetch(apiBase() + "/api/dashboard?viewer=" + encodeURIComponent(viewer) + "&role=" + encodeURIComponent(role), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("API " + response.status);
      const body = await response.json();
      if (seq !== state.requestSeq) return;
      state.payload = body;
      state.error = "";
      demoBanner.textContent = "Demo only";
      fillViewer();
      render();
    } catch (error) {
      if (seq !== state.requestSeq) return;
      state.error = "The health API did not respond. Start the backend, then reload.";
      state.payload = null;
      render();
    }
  }

  document.querySelector("#reload").addEventListener("click", load);
  viewerSelect.addEventListener("change", load);
  roleSelect.addEventListener("change", load);
  window.addEventListener("hashchange", function () {
    state.view = viewFromHash();
    if (state.view === "demo") state.demoStep = 0;
    render();
  });
  docs.href = apiBase() + "/docs";
  state.view = viewFromHash();
  load();
})();
