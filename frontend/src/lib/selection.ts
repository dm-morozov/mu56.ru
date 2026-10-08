export type Selection = { open: boolean; offering: string; character: string; tariff: string; addons: string[]; soundRequired: boolean };
export type SelectionOptions = Partial<Omit<Selection, "open">>;
export type SelectionAction = { type: "selection/choose"; payload: SelectionOptions } | { type: "selection/close" };
export const initialSelection: Selection = { open: false, offering: "", character: "", tariff: "", addons: [], soundRequired: false };
export const choose = (payload: SelectionOptions): SelectionAction => ({ type: "selection/choose", payload });
export const close = (): SelectionAction => ({ type: "selection/close" });

export function selectionReducer(state: Selection, action: SelectionAction): Selection {
  if (action.type === "selection/close") return state.open ? { ...state, open: false } : state;
  const options = action.payload;
  const soundRequired = !!options.soundRequired;
  return {
    open: true,
    offering: options.offering || "",
    character: options.character || "",
    tariff: options.tariff || "",
    soundRequired,
    addons: [...new Set([...(options.addons || []), ...(soundRequired ? ["sound"] : [])])],
  };
}
