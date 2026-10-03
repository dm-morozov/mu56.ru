"use client";

import { useId, useState } from "react";
import { Clock3, Info } from "lucide-react";
import { Offering, duration } from "@/lib/types";

export function ShowAddon({ show, checked, onChange, price }: {
  show: Offering;
  checked: boolean;
  onChange: (checked: boolean) => void;
  price?: string;
}) {
  const descriptionId = useId();
  const [open, setOpen] = useState(false);

  return <div className="show-addon" onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation();
      setOpen(false);
    }
  }}>
    <div className="show-addon-row">
      <label>
        <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} />
        <span className="show-addon-copy"><span className="show-addon-name">{show.name}</span>
          <span className="show-addon-duration"><Clock3 size={13} aria-hidden="true" />{show.duration_is_approximate && "≈ "}{duration(show.duration_minutes)}</span>
          {price && <small>{price}</small>}
        </span>
      </label>
      <div className="show-addon-info">
        <button type="button" className="show-info-button" aria-label={`Описание: ${show.name}`}
          aria-expanded={open} aria-controls={descriptionId}
          onClick={() => setOpen(value => !value)}><Info size={18} aria-hidden="true" /></button>
      </div>
    </div>
    <div id={descriptionId} className="show-addon-description" hidden={!open}>
      <strong>{show.name}</strong><p>{show.description}</p>
    </div>
  </div>;
}
