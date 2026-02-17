export default function reducer(state, action = {}) {
  const { type, payload = {} } = action;

  if (type === "SET_STATE") {
    return {
      ...state,
      ...payload,
    };
  }

  return state;
}
