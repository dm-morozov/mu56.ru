"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import { Part } from "@/lib/types";

export function PackagePart({ part, description }: { part: Part; description?: string }) {
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  return <div className="show-addon" onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false);
    }
  }}>
    <div className="show-addon-row">
      <label><input type="checkbox" checked disabled /><span className="show-addon-copy">{part.title}<small>{part.is_approximate ? "Около " : ""}{part.duration_minutes} минут{!part.led_by_performer && !part.title.toLowerCase().includes("без ведущ") ? " · без ведущих" : ""}</small></span></label>
      {description && <div className="show-addon-info"><button type="button" className="show-info-button" aria-label={`Описание: ${part.title}`} aria-expanded={open} aria-controls={descriptionId} onClick={() => setOpen(value => !value)}><Info size={18} aria-hidden="true" /></button></div>}
    </div>
    {description && <div id={descriptionId} className="show-addon-description" hidden={!open}><strong>{part.title}</strong><p>{description}</p></div>}
  </div>;
}
