// API origin for the dashboard. No secrets belong in this file.
// A page served from this machine's static server (not port 8080) calls the
// local API. Any other host, including Vercel, uses the same origin.
(function () {
  var host = window.location.hostname;
  var port = window.location.port;
  var localStatic = (host === "127.0.0.1" || host === "localhost") && port !== "8080";
  window.CREW_HEALTH_API_BASE = localStatic ? "http://127.0.0.1:8080" : "";
})();
