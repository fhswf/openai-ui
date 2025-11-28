import i18next from "i18next";

import avatar from "../../assets/images/avatar.png";

export * from "./options";

export function formatNumber(n) {
  return n < 10 ? `0${n}` : n;
}

export function dateFormat(secs) {
  const activeLocale = i18next.resolvedLanguage;

  const date = new Date(1000 * secs);
  //console.log("dateFormat: ", date, "activeLocale: ", activeLocale, "ms: ", ms, "date: ", date);
  return new Intl.DateTimeFormat(activeLocale, {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export async function sha256Digest(message) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(""); // convert bytes to hex string
  return hashHex;
}

export function fetchAndGetUser(dispatch, options) {
  fetch(import.meta.env.VITE_USER_URL, { credentials: "include" })
    .then((res) => {
      console.log("getting user: ", res.status);
      if (res.status === 401) {
        console.log(
          "unauthorized, redirecting to login: %s",
          import.meta.env.VITE_LOGIN_URL
        );
        window.location.href = import.meta.env.VITE_LOGIN_URL;
        return Promise.resolve(Error("unauthorized"));
      }

      return res.json();
    })

    .then((user) => {
      user.avatar = null;
      console.log("updating user: ", user);
      dispatch({ type: "SET_STATE", payload: { user } });

      if (options.general.gravatar) {
        console.log("user uses gravatar");
        sha256Digest(user.email).then((hash) => {
          user.hash = hash;
          fetch(`https://www.gravatar.com/${hash}`, { mode: "no-cors" }).then(
            (res) => {
              if (res.status === 200) {
                console.log("user has gravatar");
                user.avatar = `https://www.gravatar.com/avatar/${hash}`;
              } else {
                console.log("user has no gravatar");
                user.avatar = `https://www.gravatar.com/avatar/${hash}?d=identicon`;
              }
              dispatch({ type: "SET_STATE", payload: { user } });
            }
          );
        });
      }
    })
    .catch((err) => {
      console.log("error getting user: ", err);
    });
}
