const normalizeTechnicalText = (value: string): string => {
  const trimmed = value.replace(/\s+/gu, ' ').trim();

  if (/^(?:WebGPU|WASM|CPU)(?:\s+(?:WebGPU|WASM|CPU))*$/u.test(trimmed)) {
    return trimmed.replace(/\s+/gu, ' · ');
  }

  if (/^(?:WebP|JPG|PNG)(?:\s+(?:WebP|JPG|PNG))*$/u.test(trimmed)) {
    return trimmed.replace(/\s+/gu, ' · ');
  }

  if (/^(?:SHA-\d+)(?:\s+SHA-\d+)*$/u.test(trimmed)) {
    return trimmed.replace(/\s+(?=SHA-\d+)/gu, ' · ');
  }

  if (/^[0-9]+(?::[0-9]+)+$/u.test(trimmed)) {
    return trimmed.replace(/:/gu, ' : ');
  }

  if (/^#[0-9A-Fa-f]{3,8}$/u.test(trimmed)) {
    return `HEX ${trimmed}`;
  }

  return value;
};

export function installToolUiTechnicalValueNormalization(): () => void {
  const root = document.getElementById('root');
  if (!root) return () => undefined;

  const apply = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      const next = normalizeTechnicalText(text);
      if (next !== text) node.textContent = next;
      return;
    }

    const element = node as Element;
    if (element.hasAttribute?.('placeholder')) {
      const value = element.getAttribute('placeholder') ?? '';
      const next = normalizeTechnicalText(value);
      if (next !== value) element.setAttribute('placeholder', next);
    }
    if (element.hasAttribute?.('aria-label')) {
      const value = element.getAttribute('aria-label') ?? '';
      const next = normalizeTechnicalText(value);
      if (next !== value) element.setAttribute('aria-label', next);
    }
  };

  apply(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) apply(node);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true });

  return () => observer.disconnect();
}
