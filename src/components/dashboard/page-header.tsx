import * as React from "react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type Crumb = {
  label: string
  href?: string
}

type PageHeaderProps = {
  title: string
  subtitle?: string
  crumbs?: Crumb[]
  actions?: React.ReactNode
}

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: PageHeaderProps) {
  return (
    <div className="space-y-4">
      {crumbs?.length ? (
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1
              return (
                <React.Fragment key={`${c.label}-${i}`}>
                  <BreadcrumbItem>
                    {isLast || !c.href ? (
                      <BreadcrumbPage>{c.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={c.href}>{c.label}</BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast ? <BreadcrumbSeparator /> : null}
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  )
}
