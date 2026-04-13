const HELP_ICON_SELECTOR = 'svg.lucide-info, svg.lucide-circle-help, svg.lucide-help-circle';

const normalizeWhitespace = (value: string): string => String(value || '').replace(/\s+/g, ' ').trim();

const truncate = (value: string, max = 120): string =>
  value.length <= max ? value : `${value.slice(0, Math.max(0, max - 3)).trim()}...`;

const extractContextText = (element: Element | null): string => {
  if (!element) return '';
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('svg,button,[aria-hidden="true"]').forEach((node) => node.remove());
  return normalizeWhitespace(clone.textContent || '');
};

const resolveHelpText = (icon: Element): string => {
  const explicit = normalizeWhitespace(
    icon.getAttribute('data-help-text')
      || icon.closest('[data-help-text]')?.getAttribute('data-help-text')
      || '',
  );
  if (explicit) return truncate(explicit);

  const nearestLabel = icon.closest('label, th, legend, h1, h2, h3, h4, h5, h6, [data-help-label]');
  const labelText = extractContextText(nearestLabel);
  if (labelText) return truncate(labelText);

  const parentText = extractContextText(icon.parentElement);
  if (parentText) return truncate(parentText);

  return 'Help';
};

/**
 * Adds native tooltip text (title/aria-label) to all help icons that currently
 * render without help text. This preserves existing explicit tooltips.
 */
export const applyAutoHelpTitles = (root: ParentNode = document): number => {
  if (!root) return 0;
  const icons = Array.from(root.querySelectorAll(HELP_ICON_SELECTOR));
  let updated = 0;

  icons.forEach((icon) => {
    const existingTitle = normalizeWhitespace(icon.getAttribute('title') || '');
    const existingAria = normalizeWhitespace(icon.getAttribute('aria-label') || '');
    if (existingTitle || existingAria) return;

    const resolved = resolveHelpText(icon);
    if (!resolved) return;

    const tooltip = resolved.toLowerCase() === 'help' ? 'Help information' : `${resolved}`;
    icon.setAttribute('title', tooltip);
    icon.setAttribute('aria-label', tooltip);
    icon.setAttribute('focusable', 'true');
    updated += 1;
  });

  return updated;
};

