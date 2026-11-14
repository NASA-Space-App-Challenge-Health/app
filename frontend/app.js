(function () {
  const main = document.querySelector("#main");
  const status = document.querySelector("#status");
  const disclaimer = document.querySelector("#disclaimer");
  const reload = document.querySelector("#reload");
  const docs = document.querySelector("#api-docs");

  const state = {
    status: "loading",
    error: "",
    dashboard: null,
    selectedId: null,
    restoreFocus: false,
    requestSeq: 0,
  };

  function apiBase() {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    const configured = window.CREW_HEALTH_API_BASE || "http://127.0.0.1:8080";
    return (fromQuery || configured).replace(/\/$/, "");
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(function (entry) {
      const key = entry[0];
      const value = entry[1];
      if (value === null || value === undefined) return;
      if (key === "class") node.className = value;
      else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2), value);
      } else node.setAttribute(key, String(value));
    });
    (children || []).forEach(function (child) {
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function crewIdFromHash() {
    const match = /^#crew=([0-9a-f-]{36})$/i.exec(window.location.hash);
    return match ? match[1].toLowerCase() : null;
  }

  function selectedCrew() {
    const crew = (state.dashboard && state.dashboard.crew) || [];
    const wanted = (state.selectedId || crewIdFromHash() || "").toLowerCase();
    return crew.find(function (member) {
      return String(member.id).toLowerCase() === wanted;
    }) || crew[0] || null;
  }

  function formatNumber(value, decimals) {
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  function formatWhen(iso) {
    if (!iso) return "No timestamp";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function bandLabel(band) {
    if (band === "nominal") return "Nominal";
    if (band === "watch") return "Watch";
    if (band === "concern") return "Concern";
    return "No reading";
  }

  function sourceLabel(source) {
    if (source === "simulated") return "Source: simulated";
    if (source === "manual") return "Source: manual entry, still a demonstration";
    return "Source: no reading yet";
  }

  function setStatus(text) {
    status.textContent = text;
  }

  function renderEmpty() {
    main.dataset.state = "empty";
    main.replaceChildren(
      el("section", { class: "empty" }, [
        el("h2", null, ["No crew yet"]),
        el("p", null, [
          "The database has no crew members. The shipped demo seeds four simulated astronauts when the API starts against an empty table.",
        ]),
      ])
    );
  }

  function renderError() {
    main.dataset.state = "error";
    main.replaceChildren(
      el("section", { class: "error-box", role: "alert" }, [
        el("h2", null, ["Crew readings are unavailable"]),
        el("p", null, [state.error]),
        el("button", { type: "button", onclick: function () { load(); } }, ["Try again"]),
      ])
    );
  }

  function renderLoading() {
    main.dataset.state = "loading";
    main.replaceChildren(el("p", { class: "status" }, ["Loading simulated crew readings."]));
  }

  function renderDashboard() {
    const crew = state.dashboard.crew;
    if (!crew.length) {
      renderEmpty();
      setStatus("No simulated crew members are stored yet.");
      return;
    }
    const current = selectedCrew();
    state.selectedId = current.id;
    main.dataset.state = "ready";
    disclaimer.textContent = state.dashboard.disclaimer;

    const list = el("ul", { class: "crew-list" });
    crew.forEach(function (member) {
      const pressed = String(member.id) === String(current.id);
      list.append(
        el("li", null, [
          el(
            "button",
            {
              type: "button",
              class: "crew-button",
              id: "crew-" + member.id,
              "aria-pressed": pressed ? "true" : "false",
              onclick: function () { selectCrew(member.id); },
            },
            [
              el("span", { class: "crew-name" }, [member.full_name]),
              el("span", { class: "crew-meta" }, [member.call_sign + " · " + member.role]),
              el("span", { class: "band band-" + (member.overall_band || "unknown") }, [
                "Overall " + bandLabel(member.overall_band),
              ]),
            ]
          ),
        ])
      );
    });

    const groups = [];
    current.readings.forEach(function (reading) {
      let group = groups.find(function (item) { return item.name === reading.group; });
      if (!group) {
        group = { name: reading.group, readings: [] };
        groups.push(group);
      }
      group.readings.push(reading);
    });

    const detailChildren = [
      el("div", { class: "identity" }, [
        el("div", null, [
          el("h2", { id: "detail-heading" }, [current.full_name]),
          el("p", { class: "crew-meta" }, [
            current.call_sign + " · " + current.role + " · " + current.mission,
          ]),
        ]),
        el("span", { class: "band band-" + (current.overall_band || "unknown") }, [
          "Overall " + bandLabel(current.overall_band),
        ]),
      ]),
    ];

    groups.forEach(function (group) {
      detailChildren.push(el("h3", null, [group.name]));
      detailChildren.push(
        el(
          "div",
          { class: "readings" },
          group.readings.map(function (reading) {
            const valueText = reading.value === null || reading.value === undefined
              ? "No reading"
              : formatNumber(reading.value, reading.decimals) + " " + reading.unit;
            const children = [
              el("header", null, [
                el("h4", null, [reading.label]),
                el("span", { class: "band band-" + (reading.risk_band || "unknown") }, [
                  bandLabel(reading.risk_band),
                ]),
              ]),
              el("p", { class: "value" }, [valueText]),
              el("p", { class: "source" }, [
                sourceLabel(reading.source) +
                  (reading.recorded_at ? " · " + formatWhen(reading.recorded_at) : ""),
              ]),
              el("p", null, [reading.explanation]),
            ];
            if (reading.guidance) children.push(el("p", null, [reading.guidance]));
            else children.push(el("p", null, ["No simulated reading has been stored for this indicator."]));
            return el("article", { class: "reading" }, children);
          })
        )
      );
    });

    main.replaceChildren(
      el("div", { class: "layout" }, [
        el("section", { "aria-labelledby": "crew-heading" }, [
          el("h2", { id: "crew-heading" }, ["Crew"]),
          list,
        ]),
        el("section", { class: "panel", "aria-labelledby": "detail-heading" }, detailChildren),
      ])
    );

    const sourceNote = state.dashboard.data_source === "simulated"
      ? "Showing simulated readings for " + crew.length + " crew members."
      : "Showing demonstration readings for " + crew.length + " crew members. Some rows were entered in this demo.";
    setStatus(sourceNote);

    if (state.restoreFocus) {
      const selected = document.getElementById("crew-" + current.id);
      if (selected) selected.focus();
      state.restoreFocus = false;
    }
  }

  function render() {
    if (state.status === "loading" && !state.dashboard) {
      setStatus("Loading simulated crew readings.");
      renderLoading();
      return;
    }
    if (state.status === "error" && !state.dashboard) {
      setStatus(state.error);
      renderError();
      return;
    }
    if (state.status === "error") setStatus(state.error);
    renderDashboard();
  }

  function selectCrew(id) {
    state.selectedId = id;
    state.restoreFocus = true;
    const next = "#crew=" + id;
    if (window.location.hash !== next) {
      history.replaceState(null, "", next);
    }
    render();
  }

  async function load() {
    const seq = ++state.requestSeq;
    state.status = "loading";
    state.error = "";
    if (!state.dashboard) render();
    else setStatus("Refreshing simulated readings.");
    const controller = new AbortController();
    const timer = window.setTimeout(function () { controller.abort(); }, 8000);
    try {
      const response = await fetch(apiBase() + "/api/dashboard", {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (seq !== state.requestSeq) return;
      if (!response.ok) throw new Error("status " + response.status);
      const body = await response.json();
      if (!body || !Array.isArray(body.crew) || body.data_source !== "simulated" && body.data_source !== "mixed") {
        throw new Error("unexpected payload");
      }
      state.dashboard = body;
      state.status = "ready";
      if (!state.selectedId) state.selectedId = crewIdFromHash();
      render();
    } catch (error) {
      if (seq !== state.requestSeq) return;
      state.status = "error";
      state.error = error && error.name === "AbortError"
        ? "The health API took too long to answer. Check that the backend is running, then try again."
        : "The health API did not respond. Start the backend, then try again.";
      render();
    } finally {
      window.clearTimeout(timer);
    }
  }

  reload.addEventListener("click", function () { load(); });
  window.addEventListener("hashchange", function () {
    state.selectedId = crewIdFromHash();
    if (state.dashboard) render();
  });
  docs.href = apiBase() + "/docs";
  load();
})();
