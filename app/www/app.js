// PSAT 합격 패키지 — lightweight markdown reader.
// Loads the bundled content index, renders a nav drawer, and shows the
// selected document rendered from Markdown via marked.
(function () {
  "use strict";

  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("backdrop");
  const contentEl = document.getElementById("content");
  const titleEl = document.getElementById("docTitle");
  const menuBtn = document.getElementById("menuBtn");

  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

  function openSidebar() {
    sidebar.classList.remove("hidden");
    if (isMobile()) backdrop.hidden = false;
  }
  function closeSidebar() {
    sidebar.classList.add("hidden");
    backdrop.hidden = true;
  }
  function toggleSidebar() {
    if (sidebar.classList.contains("hidden")) openSidebar();
    else closeSidebar();
  }

  menuBtn.addEventListener("click", toggleSidebar);
  backdrop.addEventListener("click", closeSidebar);

  // Sidebar starts collapsed on mobile, open on desktop.
  if (isMobile()) closeSidebar();

  let activeLink = null;

  async function loadDoc(file) {
    try {
      const res = await fetch("content/" + encodeURI(file.path));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const md = await res.text();
      contentEl.innerHTML = marked.parse(md);
      titleEl.textContent = file.title;
      contentEl.scrollIntoView({ block: "start" });
      window.scrollTo(0, 0);
      location.hash = encodeURIComponent(file.path);
    } catch (err) {
      contentEl.innerHTML =
        '<p class="placeholder">문서를 불러오지 못했습니다: ' +
        String(err) +
        "</p>";
    }
    if (isMobile()) closeSidebar();
  }

  function buildNav(index) {
    const linkByPath = new Map();
    index.forEach((group) => {
      const label = document.createElement("div");
      label.className = "nav-group-label";
      label.textContent = group.label;
      sidebar.appendChild(label);

      group.files.forEach((file) => {
        const a = document.createElement("a");
        a.className = "nav-link";
        a.textContent = file.title;
        a.addEventListener("click", () => {
          if (activeLink) activeLink.classList.remove("active");
          a.classList.add("active");
          activeLink = a;
          loadDoc(file);
        });
        sidebar.appendChild(a);
        linkByPath.set(file.path, { link: a, file });
      });
    });
    return linkByPath;
  }

  fetch("content/index.json")
    .then((res) => res.json())
    .then((index) => {
      const linkByPath = buildNav(index);

      // Open the document referenced by the URL hash, else the first one.
      const requested = location.hash
        ? decodeURIComponent(location.hash.slice(1))
        : null;
      const target =
        (requested && linkByPath.get(requested)) ||
        linkByPath.values().next().value;
      if (target) {
        target.link.classList.add("active");
        activeLink = target.link;
        loadDoc(target.file);
      }
    })
    .catch((err) => {
      contentEl.innerHTML =
        '<p class="placeholder">목차를 불러오지 못했습니다: ' +
        String(err) +
        "</p>";
    });
})();
