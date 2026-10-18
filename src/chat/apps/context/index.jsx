import React, { createContext, useReducer, useContext } from "react";
import reducer from "./reducer";
import action from "./action";
import { initApps } from "./initState";
import { useGlobal } from "../../context";
import { useTranslation } from "react-i18next";

export const AppsContext = createContext(null);

export function AppsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initApps);
  const { options } = useGlobal();
  const { t } = useTranslation();
  const actions = action(state, dispatch);
  const customGpts = Array.isArray(options.general.customGpts)
    ? options.general.customGpts
    : [];
  const apps = [
    ...state.apps,
    ...customGpts.map((customGpt) => ({
      category: 3,
      title: customGpt.name || t("custom_gpt_default_name"),
      desc: "",
      content: customGpt.systemPrompt,
      role: "system",
      botStarts: customGpt.botStarts ?? false,
      id: customGpt.id,
    })),
  ];
  const category = customGpts.length
    ? [
        ...state.category,
        { title: t("custom_gpts"), icon: "prompts", id: 3 },
      ]
    : state.category;
  return (
    <AppsContext.Provider
      value={{ ...state, apps, category, ...actions, dispatch }}
    >
      {children}
    </AppsContext.Provider>
  );
}

export const useApps = () => useContext(AppsContext);
