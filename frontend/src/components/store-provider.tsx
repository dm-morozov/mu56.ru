"use client";
import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Provider, useDispatch, useSelector } from "react-redux";
import { useRef } from "react";

const selection = createSlice({
  name: "selection",
  initialState: { open: false, offering: "", character: "", tariff: "" },
  reducers: {
    choose: (state, action: PayloadAction<{ offering?: string; character?: string; tariff?: string }>) => {
      state.open = true;
      state.offering = action.payload.offering || "";
      state.character = action.payload.character || "";
      state.tariff = action.payload.tariff || "";
    },
    close: state => { state.open = false; },
  },
});
export const { choose, close } = selection.actions;
const makeStore = () => configureStore({ reducer: { selection: selection.reducer } });
type Store = ReturnType<typeof makeStore>;
export const useSelection = () => useSelector((state: ReturnType<Store["getState"]>) => state.selection);
export const useAppDispatch = () => useDispatch<Store["dispatch"]>();
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const store = useRef<Store | null>(null);
  if (!store.current) store.current = makeStore();
  return <Provider store={store.current}>{children}</Provider>;
}
