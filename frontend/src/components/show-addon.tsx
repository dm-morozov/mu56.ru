"use client";

import { useId, useState } from "react";
import { Clock3, Info } from "lucide-react";
import { Offering, duration } from "@/lib/types";

export function ShowAddon({ show, checked, onChange, price, performers, disabled = false }: {
  show: Offering;
  checked: boolean;
  onChange: (checked: boolean) => void;
  price?: string;
  performers?: number;
  disabled?: boolean;
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
        <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
        <span className="show-addon-copy"><span className="show-addon-heading"><span className="show-addon-name">{show.name}</span>
          {show.duration_minutes && <span className="show-addon-duration">{performers && <span className="show-addon-separator" aria-hidden="true">/</span>}<Clock3 size={13} aria-hidden="true" />{show.duration_is_approximate && "≈ "}{duration(show.duration_minutes)}</span>}</span>
          {show.slug === "sound" && <small>1000 Вт · JBL PartyBox 1000 · 2 микрофона Shure</small>}
          {price && <small className="show-addon-price-line"><span>{price}</span>{performers && <span>— за {performers === 2 ? "двух аниматоров" : `${performers} аниматоров`}</span>}</small>}
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
