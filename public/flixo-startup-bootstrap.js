/* global window, document, console */
(() => {
  const reportStartupFailure = (label, details) => {
    const message = `[G4 STARTUP ${label}] ${details}`;
    console.error(message);
    document.documentElement.setAttribute('data-g4-startup-error', message.slice(0, 1000));
    const pre = document.createElement('pre');
    pre.setAttribute('data-g4-startup-error', 'true');
    pre.style.cssText = 'position:fixed;inset:0;margin:0;padding:24px;overflow:auto;background:#090d12;color:#fff;font:14px/1.5 monospace;white-space:pre-wrap;z-index:2147483647';
    pre.textContent = message;
    document.body?.appendChild(pre);
  };
  window.addEventListener('error', (event) => {
    reportStartupFailure('ERROR', event.error?.stack || event.message || 'unknown error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.stack || event.reason.message : String(event.reason);
    reportStartupFailure('UNHANDLED_REJECTION', reason);
  });
})();