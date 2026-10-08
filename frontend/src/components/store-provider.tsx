"use client";
import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { initialSelection, selectionReducer, type Selection, type SelectionAction } from "@/lib/selection";

export { choose, close } from "@/lib/selection";
const SelectionContext = createContext<Selection | null>(null);
const DispatchContext = createContext<Dispatch<SelectionAction> | null>(null);
export function useSelection() {
  const selection = useContext(SelectionContext);
  if (!selection) throw new Error("Selection must be used inside StoreProvider");
  return selection;
}
export function useAppDispatch() {
  const dispatch = useContext(DispatchContext);
  if (!dispatch) throw new Error("Dispatch must be used inside StoreProvider");
  return dispatch;
}
export function StoreProvider({ children }: { children: ReactNode }) {
  const [selection, dispatch] = useReducer(selectionReducer, initialSelection);
  return <DispatchContext value={dispatch}><SelectionContext value={selection}>{children}</SelectionContext></DispatchContext>;
}
