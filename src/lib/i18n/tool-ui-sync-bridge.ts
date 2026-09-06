import { installToolUiRuntimeLocalization } from './tool-ui-runtime';
import { installToolUiRuntimeSupplement } from './tool-ui-runtime-supplement';
import { installToolUiRuntimeCompleteness } from './tool-ui-runtime-completeness';
import { installToolUiMsUkLocalization } from './tool-ui-ms-uk';

const APPLYERS = [
  installToolUiRuntimeLocalization,
  installToolUiRuntimeSupplement,
  installToolUiRuntimeCompleteness,
  installToolUiMsUkLocalization,
] as const;

function applyAll(): void {
  for (const install of APPLYERS) {
    const dispose = install();
    dispose();
  }
}

export function installToolUiSyncBridge(): () => void {
  if (typeof document === 'undefined' || !document.body || typeof MutationObserver === 'undefined') return () => undefined;
  applyAll();
  const observer = new MutationObserver(() => applyAll());
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'placeholder'],
  });
  return () => observer.disconnect();
}
