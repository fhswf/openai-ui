export default function action(state, dispatch) {
  const setState = (payload = {}) => {
    dispatch({
      type: "SET_STATE",
      payload,
    });
  };
  return {
    setState,
    setCurrent(current) {
      console.log("setCurrent", current);
      setState({
        current,
      });
    },
    setCurrentApp(currentApp) {
      console.log("setCurrentApp", currentApp);
      setState({
        currentApp,
      });
    },
    saveApp(app) {
      const { userApps, apps } = state;
      let newUserApps;
      if (userApps.some((a) => a.id === app.id)) {
        newUserApps = userApps.map((a) => (a.id === app.id ? app : a));
      } else {
        newUserApps = [...userApps, app];
      }
      const newApps = [...apps.filter((a) => !newUserApps.some(ua => ua.id === a.id)), ...newUserApps];
      setState({
        userApps: newUserApps,
        apps: newApps,
      });
    },
    deleteApp(appId) {
      const { userApps, apps } = state;
      const newUserApps = userApps.filter((a) => a.id !== appId);
      const newApps = apps.filter((a) => a.id !== appId);
      setState({
        userApps: newUserApps,
        apps: newApps,
      });
    },
  };
}
