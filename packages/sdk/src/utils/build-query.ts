export function buildQuery(query: Record<string, unknown> | undefined): string {
  if (!query) {
    return '';
  }

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const member of value) {
        search.append(key, String(member));
      }

      continue;
    }

    search.append(key, String(value));
  }

  return search.toString();
}
