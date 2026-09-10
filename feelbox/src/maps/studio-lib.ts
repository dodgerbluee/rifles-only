/**
 * Named studio maps, autosave, and version checkpoints in localStorage.
 */
import type { LayoutSpec } from "./layout";

export const STUDIO_LIB = "rifles-studio-lib-v1";
export const STUDIO_STORE = "rifles-studio-spec";
export const VERSION_MAX = 40;

export type StudioVersion = { at: number; spec: LayoutSpec };
export type StudioDoc = {
  id: string;
  title: string;
  updatedAt: number;
  spec: LayoutSpec;
  versions: StudioVersion[];
};
export type StudioLibrary = { activeId: string; docs: StudioDoc[] };

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function slugTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "draft";
}

export function newDocId(title: string) {
  return `${slugTitle(title)}-${Date.now().toString(36)}`;
}

export function emptyLibrary(fallback: LayoutSpec): StudioLibrary {
  const spec = clone(fallback);
  const id = spec.id && spec.id !== "draft" ? spec.id : newDocId(spec.title || "Draft");
  spec.id = id;
  const now = Date.now();
  const doc: StudioDoc = {
    id,
    title: spec.title || "Draft",
    updatedAt: now,
    spec,
    versions: [{ at: now, spec: clone(spec) }],
  };
  return { activeId: id, docs: [doc] };
}

export function parseLibrary(raw: string | null, fallback: LayoutSpec): StudioLibrary {
  if (raw) {
    try {
      const lib = JSON.parse(raw) as StudioLibrary;
      if (lib?.docs?.length && lib.activeId) return lib;
    } catch {
      /* ignore */
    }
  }
  return emptyLibrary(fallback);
}

export function activeDoc(lib: StudioLibrary): StudioDoc | undefined {
  return lib.docs.find((d) => d.id === lib.activeId) ?? lib.docs[0];
}

export function writeActive(lib: StudioLibrary, spec: LayoutSpec): StudioLibrary {
  const next = clone(lib);
  const doc = next.docs.find((d) => d.id === next.activeId);
  if (!doc) return next;
  doc.spec = clone(spec);
  doc.title = spec.title || doc.title;
  doc.updatedAt = Date.now();
  return next;
}

export function addVersion(lib: StudioLibrary, spec: LayoutSpec): StudioLibrary {
  const next = writeActive(lib, spec);
  const doc = next.docs.find((d) => d.id === next.activeId);
  if (!doc) return next;
  const prev = doc.versions[0]?.spec;
  if (prev && JSON.stringify(prev) === JSON.stringify(spec)) return next;
  doc.versions.unshift({ at: Date.now(), spec: clone(spec) });
  if (doc.versions.length > VERSION_MAX) doc.versions.length = VERSION_MAX;
  return next;
}

export function revertVersion(lib: StudioLibrary, index: number): { lib: StudioLibrary; spec: LayoutSpec } | null {
  const doc = activeDoc(lib);
  const ver = doc?.versions[index];
  if (!doc || !ver) return null;
  const spec = clone(ver.spec);
  spec.title = doc.title;
  spec.id = doc.id;
  return { lib: writeActive(lib, spec), spec };
}

export function addDoc(lib: StudioLibrary, spec: LayoutSpec): StudioLibrary {
  const next = clone(lib);
  const id = spec.id || newDocId(spec.title || "Draft");
  spec.id = id;
  const now = Date.now();
  next.docs.unshift({
    id,
    title: spec.title || "Draft",
    updatedAt: now,
    spec: clone(spec),
    versions: [{ at: now, spec: clone(spec) }],
  });
  next.activeId = id;
  return next;
}

export function selectDoc(lib: StudioLibrary, id: string): StudioLibrary | null {
  if (!lib.docs.some((d) => d.id === id)) return null;
  return { ...lib, activeId: id };
}

export function seedCatalog(lib: StudioLibrary, builtins: LayoutSpec[]): StudioLibrary {
  const next = clone(lib);
  for (const spec of builtins) {
    if (next.docs.some((d) => d.id === spec.id)) continue;
    const now = Date.now();
    const copy = clone(spec);
    next.docs.push({
      id: spec.id,
      title: spec.title || spec.id,
      updatedAt: now,
      spec: copy,
      versions: [{ at: now, spec: clone(copy) }],
    });
  }
  return next;
}

export function readBrowserLibrary(fallback: LayoutSpec): StudioLibrary {
  try {
    const lib = parseLibrary(localStorage.getItem(STUDIO_LIB), fallback);
    if (localStorage.getItem(STUDIO_LIB)) return lib;
    const old = localStorage.getItem(STUDIO_STORE);
    if (old) {
      const spec = JSON.parse(old) as LayoutSpec;
      if (spec?.bounds) return emptyLibrary(spec);
    }
    return lib;
  } catch {
    return emptyLibrary(fallback);
  }
}

export function writeBrowserLibrary(lib: StudioLibrary) {
  try {
    localStorage.setItem(STUDIO_LIB, JSON.stringify(lib));
    const doc = activeDoc(lib);
    if (doc) localStorage.setItem(STUDIO_STORE, JSON.stringify(doc.spec));
  } catch {
    /* quota */
  }
}
