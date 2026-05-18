/**
 * Centralised file-type classifier. We use this in three places:
 *  - the upload validator (per-kind size limits)
 *  - the table / cards (which icon to show)
 *  - the thumbnail pipeline (whether to generate one)
 */
export type FileKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "code"
  | "text"
  | "other"

const EXT_KIND: Record<string, FileKind> = {
  // Images
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  avif: "image",
  gif: "image",
  heic: "image",
  heif: "image",
  bmp: "image",
  svg: "image",
  // Video
  mp4: "video",
  m4v: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  avi: "video",
  // Audio
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  flac: "audio",
  m4a: "audio",
  aac: "audio",
  // Documents
  pdf: "pdf",
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",
  pages: "document",
  // Spreadsheets
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  ods: "spreadsheet",
  csv: "spreadsheet",
  tsv: "spreadsheet",
  numbers: "spreadsheet",
  // Presentations
  ppt: "presentation",
  pptx: "presentation",
  odp: "presentation",
  key: "presentation",
  // Archives
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  bz2: "archive",
  xz: "archive",
  // Code-ish
  ts: "code",
  tsx: "code",
  js: "code",
  jsx: "code",
  py: "code",
  rb: "code",
  go: "code",
  rs: "code",
  java: "code",
  c: "code",
  h: "code",
  cpp: "code",
  hpp: "code",
  cs: "code",
  php: "code",
  swift: "code",
  kt: "code",
  json: "code",
  yaml: "code",
  yml: "code",
  toml: "code",
  sh: "code",
  bat: "code",
  ps1: "code",
  sql: "code",
  html: "code",
  css: "code",
  scss: "code",
  // Plain-ish text
  txt: "text",
  md: "text",
  markdown: "text",
  log: "text",
  rst: "text",
}

const MIME_KIND_PREFIX: Array<[string, FileKind]> = [
  ["image/", "image"],
  ["video/", "video"],
  ["audio/", "audio"],
]

const MIME_KIND_EXACT: Record<string, FileKind> = {
  "application/pdf": "pdf",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "document",
  "application/rtf": "document",
  "application/vnd.oasis.opendocument.text": "document",
  "application/vnd.ms-excel": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "spreadsheet",
  "application/vnd.oasis.opendocument.spreadsheet": "spreadsheet",
  "text/csv": "spreadsheet",
  "text/tab-separated-values": "spreadsheet",
  "application/vnd.ms-powerpoint": "presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "presentation",
  "application/vnd.oasis.opendocument.presentation": "presentation",
  "application/zip": "archive",
  "application/x-zip-compressed": "archive",
  "application/x-rar-compressed": "archive",
  "application/x-7z-compressed": "archive",
  "application/x-tar": "archive",
  "application/gzip": "archive",
  "application/json": "code",
  "application/javascript": "code",
  "application/typescript": "code",
  "application/sql": "code",
  "application/xml": "code",
  "text/javascript": "code",
  "text/typescript": "code",
  "text/markdown": "text",
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".")
  if (dot <= 0 || dot === filename.length - 1) return ""
  return filename.slice(dot + 1).toLowerCase()
}

/**
 * Classify a file by mime type first, falling back to filename extension.
 * Returns 'other' when nothing matches.
 */
export function classifyFile(mime: string, filename = ""): FileKind {
  const m = mime.toLowerCase().trim()
  if (m && MIME_KIND_EXACT[m]) return MIME_KIND_EXACT[m]
  if (m.startsWith("text/")) return "text"
  for (const [prefix, kind] of MIME_KIND_PREFIX) {
    if (m.startsWith(prefix)) return kind
  }
  const ext = extensionOf(filename)
  if (ext && EXT_KIND[ext]) return EXT_KIND[ext]
  return "other"
}

/**
 * Reduce a fine-grained FileKind to the three media_kind enum values used
 * in the `public.media` table.
 */
export function toMediaKind(
  kind: FileKind
): "image" | "video" | "other" {
  if (kind === "image") return "image"
  if (kind === "video") return "video"
  return "other"
}
