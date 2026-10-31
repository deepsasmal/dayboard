// Web edition: no extension APIs here, so reminders and the golden-hour alarm are no-ops.
// Everything else falls back to localStorage (see `store` in newtab.js). Data stays in this browser only.
globalThis.chrome = { alarms: { create() {}, clear() {} } };
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
