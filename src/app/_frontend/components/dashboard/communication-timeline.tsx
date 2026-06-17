import Link from "next/link";

export type CommunicationTimelineEntry = {
  description: string;
  href?: string;
  id: string;
  metadata?: string[];
  occurredAt: Date;
  title: string;
  tone: "amber" | "blue" | "green" | "neutral" | "red";
  type: "call" | "email" | "follow_up" | "note" | "payment" | "refund" | "whatsapp";
};

type CommunicationTimelineProps = {
  className?: string;
  emptyDescription: string;
  emptyTitle: string;
  entries: CommunicationTimelineEntry[];
  title?: string;
};

function dateTimeFormatter(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function badgeLabel(type: CommunicationTimelineEntry["type"]) {
  if (type === "email") {
    return "Email";
  }

  if (type === "call") {
    return "Call";
  }

  if (type === "whatsapp") {
    return "WhatsApp";
  }

  if (type === "follow_up") {
    return "Follow-up";
  }

  if (type === "payment") {
    return "Payment";
  }

  if (type === "refund") {
    return "Refund";
  }

  return "Note";
}

function toneClasses(tone: CommunicationTimelineEntry["tone"]) {
  if (tone === "green") {
    return "bg-[#eaf3de] text-[#3b6d11]";
  }

  if (tone === "red") {
    return "bg-[#fcebeb] text-[#a32d2d]";
  }

  if (tone === "blue") {
    return "bg-[#e6f1fb] text-[#185fa5]";
  }

  if (tone === "amber") {
    return "bg-[#faeeda] text-[#854f0b]";
  }

  return "border border-border bg-[#f8f9fa] text-muted-foreground";
}

export function CommunicationTimeline({
  className = "",
  emptyDescription,
  emptyTitle,
  entries,
  title = "Communication timeline",
}: CommunicationTimelineProps) {
  const sortedEntries = [...entries].sort(
    (firstEntry, secondEntry) =>
      secondEntry.occurredAt.getTime() - firstEntry.occurredAt.getTime(),
  );

  return (
    <section
      className={`overflow-hidden rounded-[14px] border border-border bg-white p-4 print:hidden ${className}`}
    >
      <div className="mb-[13px] flex items-center justify-between gap-4">
        <h3 className="text-[13px] font-medium">{title}</h3>
        <span className="text-[11px] text-[#94a3b8]">Timeline</span>
      </div>
      {sortedEntries.length === 0 ? (
        <div className="grid min-h-36 place-items-center text-center">
          <div>
            <p className="text-sm font-medium">{emptyTitle}</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
              {emptyDescription}
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sortedEntries.map((entry) => (
            <article
              className="grid gap-3 py-3 md:grid-cols-[112px_1fr]"
              key={entry.id}
            >
              <div className="grid content-start gap-2">
                <span
                  className={`inline-flex w-fit rounded-[5px] px-2 py-0.5 text-[9.5px] font-medium ${toneClasses(
                    entry.tone,
                  )}`}
                >
                  {badgeLabel(entry.type)}
                </span>
                <time className="text-[10.5px] leading-5 text-[#94a3b8]">
                  {dateTimeFormatter(entry.occurredAt)}
                </time>
              </div>
              <div>
                {entry.href ? (
                  <Link
                    className="text-xs font-medium text-[#185fa5]"
                    href={entry.href}
                  >
                    {entry.title}
                  </Link>
                ) : (
                  <p className="text-xs font-medium">{entry.title}</p>
                )}
                <p className="mt-1 text-[11.5px] leading-5 text-muted-foreground">
                  {entry.description}
                </p>
                {entry.metadata && entry.metadata.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {entry.metadata.map((item) => (
                      <span
                        className="rounded-[6px] bg-[#f8f9fa] px-2 py-1 text-[10.5px] font-medium text-muted-foreground"
                        key={item}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
