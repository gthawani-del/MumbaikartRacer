import theme from "../theme.json";

/** Stable cache key for the current public/assets manifest. Bump after replacing any public asset. */
export function assetUrl(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}rev=${theme.assetRevision}`;
}
