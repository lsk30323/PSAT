// auth.js — shared login gate + Firebase auth (Google / email) + guest.
//
// - Guest works offline with no backend (local profile).
// - Google / email use Firebase Auth, loaded lazily from the official CDN.
//   They activate only once www/firebase-config.js holds real values.
// - The signed-in profile is cached in localStorage so the gate is instant;
//   Firebase re-validates asynchronously.
(function () {
  "use strict";

  const USER_KEY = "psat.user.v1";
  const cfg = window.FIREBASE_CONFIG || {};
  const FB_ENABLED = !!cfg.apiKey && !String(cfg.apiKey).startsWith("YOUR_");
  const FB_VERSION = "10.12.2";

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); } catch { return null; }
  };
  const setUser = (u) => localStorage.setItem(USER_KEY, JSON.stringify(u));
  const clearUser = () => localStorage.removeItem(USER_KEY);

  let fb = null;
  async function initFirebase() {
    if (!FB_ENABLED)
      throw new Error("Firebase가 설정되지 않았습니다. www/firebase-config.js 를 채우면 구글·이메일 로그인이 켜집니다.");
    if (fb) return fb;
    const [appMod, authMod] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`),
    ]);
    const app = appMod.initializeApp(cfg);
    const auth = authMod.getAuth(app);
    fb = Object.assign({ app, auth }, authMod);
    return fb;
  }

  const profileFromFb = (user, provider) => ({
    uid: user.uid,
    name: user.displayName || (user.email ? user.email.split("@")[0] : "사용자"),
    email: user.email || "",
    provider,
  });

  async function loginGoogle() {
    const f = await initFirebase();
    const provider = new f.GoogleAuthProvider();
    let res;
    try {
      res = await f.signInWithPopup(f.auth, provider);
    } catch (e) {
      const code = String((e && e.code) || e);
      // Embedded WebView blocks OAuth popups → fall back to full-page redirect.
      if (/popup|disallowed|operation-not-supported|cancelled/i.test(code)) {
        await f.signInWithRedirect(f.auth, provider);
        return null; // navigation happens; result handled on return
      }
      throw e;
    }
    const u = profileFromFb(res.user, "google");
    setUser(u);
    return u;
  }

  async function loginEmail(email, password, isSignup) {
    const f = await initFirebase();
    const fn = isSignup ? f.createUserWithEmailAndPassword : f.signInWithEmailAndPassword;
    const res = await fn(f.auth, email, password);
    const u = profileFromFb(res.user, "email");
    setUser(u);
    return u;
  }

  function loginGuest() {
    const u = { uid: "guest", name: "게스트", email: "", provider: "guest" };
    setUser(u);
    return u;
  }

  async function logout() {
    try { if (FB_ENABLED && fb) await fb.signOut(fb.auth); } catch {}
    clearUser();
    location.replace("login.html");
  }

  // Resolve a pending redirect-based Google sign-in (called on the login page).
  async function handleRedirectResult() {
    if (!FB_ENABLED) return;
    try {
      const f = await initFirebase();
      const res = await f.getRedirectResult(f.auth);
      if (res && res.user) {
        setUser(profileFromFb(res.user, "google"));
        location.replace("index.html");
      }
    } catch { /* ignore — user can retry */ }
  }

  const requireAuth = () => { if (!getUser()) location.replace("login.html"); };

  // Compact user + logout control injected into the topbar (reader / quiz).
  function injectUserBadge() {
    const bar = document.querySelector(".topbar");
    if (!bar || document.getElementById("userBadge")) return;
    const u = getUser();
    if (!u) return;
    const wrap = document.createElement("div");
    wrap.id = "userBadge";
    wrap.className = "user-badge";
    wrap.innerHTML =
      `<span class="uname" title="${u.email || u.provider}">${u.name}</span>` +
      `<button id="logoutBtn" class="logout-btn">로그아웃</button>`;
    bar.appendChild(wrap);
    document.getElementById("logoutBtn").onclick = logout;
  }

  window.PSATAuth = {
    FB_ENABLED, getUser, setUser, clearUser,
    loginGoogle, loginEmail, loginGuest, logout,
    handleRedirectResult, requireAuth, injectUserBadge,
  };

  // Gate every page except the login screen. Runs synchronously from <head>
  // so unauthenticated users are redirected before content paints.
  const onLogin = /login\.html(?:$|[?#])/.test(location.pathname + location.search) ||
    location.pathname.endsWith("login.html");
  if (onLogin) {
    document.addEventListener("DOMContentLoaded", handleRedirectResult);
  } else {
    requireAuth();
    document.addEventListener("DOMContentLoaded", injectUserBadge);
  }
})();
