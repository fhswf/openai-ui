import React, { createContext, useReducer, useContext, useMemo } from "react";
import PropTypes from "prop-types";
import reducer from "./reducer";
import action from "./action";
import { initApps } from "./initState";

export const AppsContext = createContext(null);

export function AppsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initApps);
  const actions = action(state, dispatch);
  const value = useMemo(
    () => ({ ...state, ...actions, dispatch }),
    [state, actions]
  );
  return (
    <AppsContext.Provider value={value}>
      {children}
    </AppsContext.Provider>
  );
}

AppsProvider.propTypes = {
  children: PropTypes.node,
};

export const useApps = () => useContext(AppsContext);
