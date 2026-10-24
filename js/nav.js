(() => {
  const host = document.getElementById("nav");
  const session = Storage.get("hcm_session");
  if (!host || !session) return;

  const company = Storage.get("hcm_company", { name: "HCM Lite" });
  const links = session.role === "admin"
    ? [["Dashboard", "admin.html"], ["Leaves", "leaves.html"],
       ["Reports", "reports.html"], ["Settings", "settings.html"]]
    : [["My Portal", "employee.html"]];

  const bar = document.createElement("header");
  bar.className = "nav";
  const inner = document.createElement("div");
  inner.className = "nav-inner";

  const brand = document.createElement("div");
  brand.className = "nav-brand";
  brand.textContent = company.name;

  const toggle = document.createElement("button");
  toggle.id = "navToggle";
  toggle.type = "button";
  toggle.textContent = "☰ Menu";

  const menu = document.createElement("nav");
  menu.className = "nav-links";

  links.forEach(([label, href]) => {
    const a = document.createElement("a");
    a.href = href;
    a.textContent = label;
    if (location.pathname.endsWith(href)) a.className = "active";
    menu.append(a);
  });

  const out = document.createElement("button");
  out.type = "button";
  out.textContent = "Log out";
  out.addEventListener("click", () => {
    Storage.remove("hcm_session");
    window.location.href = "index.html";
  });
  menu.append(out);

  toggle.addEventListener("click", () => menu.classList.toggle("open"));

  inner.append(brand, toggle, menu);
  bar.append(inner);
  host.replaceChildren(bar);
})();
