(function () {
  const main = document.querySelector("#main");
  const status = document.querySelector("#status");
  const disclaimer = document.querySelector("#disclaimer");
  const strip = document.querySelector("#alert-strip");
  const viewerSelect = document.querySelector("#viewer");
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
    return (fromQuery || window.CREW_HEALTH_API_BASE || "http://127.0.0.1:8080").replace(/\/$/, "");
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
    return "dashboard";
  }

  function setStatus(text) {
    status.textContent = text;
  }

  function renderAlertStrip() {
    const alerts = (state.payload && state.payload.alerts) || [];
    const critical = alerts.filter(function (item) { return item.severity === "critical"; });
    strip.replaceChildren();
    if (!critical.length) return;
    const top = critical[0];
    strip.append(el("a", { class: "alert-strip", href: "#/alerts" }, [
      el("strong", null, ["Emergency · " + top.title + ". "]),
      top.detail,
    ]));
  }

  function sourceList(sources) {
    return el("p", null, (sources || []).flatMap(function (source, index) {
      const link = el("a", { href: source.url }, [source.title]);
      return index ? [" · ", link] : [link];
    }));
  }

  function renderDashboard() {
    const crew = state.payload.crew || [];
    main.dataset.state = crew.length ? "ready" : "empty";
    if (!crew.length) {
      main.replaceChildren(el("p", null, ["No crew members are loaded."]));
      return;
    }
    main.replaceChildren(el("div", { class: "crew-grid" }, crew.map(renderCrew)));
    setStatus("Showing " + crew.length + " crew members in " + state.payload.group.name + ".");
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
        "Sharing alerts only. Full vitals and lab numbers are hidden in this view. Emergency alerts still broadcast.",
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
    const blocks = [el("h2", null, ["Alerts broadcast to the crew"])];
    if (!alerts.length) blocks.push(el("p", null, ["No alerts."]));
    alerts.forEach(function (alert) {
      blocks.push(el("article", { class: alert.severity === "critical" ? "alert-strip" : "notice notice-watch" }, [
        el("div", { class: "badge-row" }, [
          originBadge(alert.origin),
          el("strong", null, [alert.severity + " · " + alert.title]),
        ]),
        el("p", null, [alert.detail]),
        el("p", null, ["Suggested action: " + alert.suggested_action]),
        sourceList(alert.sources),
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
      el("p", { class: "eyebrow" }, [step.kicker + " of " + steps.length]),
      el("h2", null, [step.title]),
      el("p", null, [step.body]),
    ];
    if (step.alert) body.push(renderNotice(step.alert));
    if (step.recommendation) body.push(renderNotice(step.recommendation));
    if (step.hygiene) body.push(el("p", null, [step.hygiene.suggestion || ""]));
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
      el("p", null, [item.detail]),
      el("p", null, ["Suggested action: " + item.suggested_action]),
      sourceList(item.sources),
    ]);
  }

  function renderSchedule() {
    const hygiene = state.payload.hygiene || {};
    main.dataset.state = "ready";
    main.replaceChildren(el("section", { class: "card" }, [
      el("div", { class: "badge-row" }, [originBadge("simulated"), el("h2", null, [hygiene.station || "Hygiene station"])]),
      el("p", null, [hygiene.suggestion || ""]),
      el("p", null, ["Suggested order: " + (hygiene.order || []).join(", ")]),
      el("p", { class: "hidden-note" }, [
        "Windows are estimates from simulated fluid intake and clock time. They are not measured bathroom events.",
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
      el("h2", null, ["Insights across the crew"]),
      el("p", null, [
        "Common out-of-range CBC and CMP flags in the Inspiration4 file. A repeat that moves further out of range is counted as something an earlier check could have caught. " + preventable.length + " of those worsening pairs are in the recommendation list.",
      ]),
      el("div", { class: "insight-grid" }, issueCards),
      el("h3", null, ["Extremes"]),
      el("table", null, [el("tbody", null, extremeRows)]),
      el("p", null, ["DONKI SEP rows loaded: " + (insights.space_weather_events_in_file || 0) + ". All of these figures are real NASA rows."]),
    ]));
    setStatus("Insights use the committed NASA tables.");
  }

  function renderUpload() {
    main.dataset.state = "ready";
    const form = el("form", { class: "upload-card", onsubmit: submitUpload }, [
      el("h2", null, ["Upload a vitals CSV"]),
      el("p", null, [
        "Columns: crew_id, indicator, value, recorded_at. Optional uploads are stored as simulated, not as NASA data. Real labs, DosTel, and DONKI load from the data/ folder when the API starts.",
      ]),
      el("input", { type: "file", id: "csv-file", accept: ".csv,text/csv", required: "true" }),
      el("button", { type: "submit" }, ["Upload"]),
      el("p", { id: "upload-result", class: "status" }, [""]),
    ]);
    main.replaceChildren(form);
    setStatus("Upload is ready.");
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
    setStatus("Loading the crew board.");
    try {
      const response = await fetch(apiBase() + "/api/dashboard?viewer=" + encodeURIComponent(viewer), {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("API " + response.status);
      const body = await response.json();
      if (seq !== state.requestSeq) return;
      state.payload = body;
      state.error = "";
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
  window.addEventListener("hashchange", function () {
    state.view = viewFromHash();
    if (state.view === "demo") state.demoStep = 0;
    render();
  });
  docs.href = apiBase() + "/docs";
  state.view = viewFromHash();
  load();
})();
