export function buildPath(basePath: string, ...segments: string[]): string {
  const encoded = segments.map((segment) => {
    return encodeURIComponent(segment);
  });

  return [basePath, ...encoded].join('/');
}
