import React, { createContext, useReducer, useContext, useEffect } from "react";
import reducer from "./reducer";
import action from "./action";
import { initApps } from "./initState";

export const AppsContext = createContext(null);

const STORAGE_KEY = "USER_APPS";

function getInitialState() {
  const storedApps = localStorage.getItem(STORAGE_KEY);
  const userApps = storedApps ? JSON.parse(storedApps) : [];
  
  // Check for shared template in URL
  const urlParams = new URLSearchParams(globalThis.location.search);
  const sharedTemplate = urlParams.get("template");
  if (sharedTemplate) {
    try {
      const decoded = JSON.parse(atob(sharedTemplate));
      // We don't add it immediately to userApps to avoid duplicates on refresh
      // Instead, we can flag it or handle it in a way that prompts the user
      // For now, let's just add it if it's not already there by ID
      if (!userApps.some(app => app.id === decoded.id) && !initApps.apps.some(app => app.id === decoded.id)) {
        // Assign a new ID if it's a shared template to avoid collisions
        // or just use it as is if it has a unique one. 
        // Better: let's just add it for now.
        userApps.push(decoded);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userApps));
        // Remove from URL to avoid re-adding on refresh
        const newUrl = globalThis.location.pathname;
        globalThis.history.replaceState({}, document.title, newUrl);
      }
    } catch (e) {
      console.error("Failed to parse shared template", e);
    }
  }

  return {
    ...initApps,
    apps: [...initApps.apps, ...userApps],
    userApps // Keep track of which ones are user-defined
  };
}

export function AppsProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, getInitialState());
  const actions = action(state, dispatch);

  useEffect(() => {
    if (state.userApps) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.userApps));
    }
  }, [state.userApps]);

  const value = React.useMemo(() => ({ ...state, ...actions, dispatch }), [state, actions, dispatch]);

  return (
    <AppsContext.Provider value={value}>
      {children}
    </AppsContext.Provider>
  );
}

export const useApps = () => useContext(AppsContext);
