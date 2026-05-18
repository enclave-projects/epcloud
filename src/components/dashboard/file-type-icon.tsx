import {
  RiArchiveLine,
  RiCodeBoxLine,
  RiFileExcel2Line,
  RiFileImageLine,
  RiFileLine,
  RiFilePdf2Line,
  RiFilePpt2Line,
  RiFileTextLine,
  RiFileWord2Line,
  RiMusic2Line,
  RiVideoLine,
} from "@remixicon/react"

import { classifyFile, type FileKind } from "@/lib/mime"
import { cn } from "@/lib/utils"

type Props = {
  /** Either pass mime+filename, or pass a pre-classified `kind` directly. */
  mime?: string
  filename?: string
  kind?: FileKind
  className?: string
}

const ICONS: Record<FileKind, React.ComponentType<{ className?: string }>> = {
  image: RiFileImageLine,
  video: RiVideoLine,
  audio: RiMusic2Line,
  pdf: RiFilePdf2Line,
  document: RiFileWord2Line,
  spreadsheet: RiFileExcel2Line,
  presentation: RiFilePpt2Line,
  archive: RiArchiveLine,
  code: RiCodeBoxLine,
  text: RiFileTextLine,
  other: RiFileLine,
}

const ACCENTS: Record<FileKind, string> = {
  image: "text-emerald-600 dark:text-emerald-400",
  video: "text-amber-600 dark:text-amber-400",
  audio: "text-pink-600 dark:text-pink-400",
  pdf: "text-rose-600 dark:text-rose-400",
  document: "text-sky-600 dark:text-sky-400",
  spreadsheet: "text-emerald-700 dark:text-emerald-400",
  presentation: "text-orange-600 dark:text-orange-400",
  archive: "text-violet-600 dark:text-violet-400",
  code: "text-indigo-600 dark:text-indigo-400",
  text: "text-muted-foreground",
  other: "text-muted-foreground",
}

export function FileTypeIcon({
  mime,
  filename,
  kind,
  className,
}: Props) {
  const resolved =
    kind ?? classifyFile(mime ?? "", filename ?? "")
  const Icon = ICONS[resolved]
  return (
    <Icon
      className={cn("size-4", ACCENTS[resolved], className)}
      aria-hidden
    />
  )
}
