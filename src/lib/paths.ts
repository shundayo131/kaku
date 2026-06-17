// Pure helpers for working with vault file paths.

const MD_EXT = /\.md$/i;

/** Display title — the file name without the .md extension. */
export const titleOf = (name: string): string => name.replace(MD_EXT, "");

/** The file name from an absolute path. */
export const nameOf = (path: string): string =>
  path.slice(path.lastIndexOf("/") + 1);

/** The parent directory of an absolute path. */
export const dirOf = (path: string): string =>
  path.slice(0, path.lastIndexOf("/"));

/** Ensure a name ends in .md. */
export const ensureMd = (name: string): string =>
  MD_EXT.test(name) ? name : `${name}.md`;
