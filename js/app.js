
const setupForm = document.getElementById("setupForm");
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = type;
}

// Already logged in? Go straight to the right dashboard.
(function () {
  const active = Storage.get("hcm_session");
  const users = Storage.get("hcm_users", []);

  if (active && users.some(user => user.id === active.userId)) {
    window.location.replace(active.role === "admin" ? "admin.html" : "employee.html");
  }
})();

function initializeApp() {
  const company = Storage.get("hcm_company");
  const users = Storage.get("hcm_users", []);

  if (!company || users.length === 0) {
    setupForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
  } else {
    setupForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
  }
}

// First-time company setup
setupForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const companyName =
    document.getElementById("companyName").value.trim();

  const adminName =
    document.getElementById("adminName").value.trim();

  const adminEmail =
    document.getElementById("adminEmail").value.trim().toLowerCase();

  const adminPassword =
    document.getElementById("adminPassword").value;

  if (!companyName || !adminName || !adminEmail || !adminPassword) {
    showMessage("Please complete every field.", "error");
    return;
  }

  if (adminPassword.length < 6) {
    showMessage("Password must be at least 6 characters.", "error");
    return;
  }

  const users = Storage.get("hcm_users", []);

  if (users.some(user => user.email === adminEmail)) {
    showMessage("This email is already registered.", "error");
    return;
  }

  const admin = {
    id: Date.now(),
    name: adminName,
    email: adminEmail,
    role: "admin",
    department: "Management",
    salary: 0
  };

  Auth.setPassword(admin, adminPassword);

  Storage.set("hcm_company", {
    name: companyName,
    officeStart: "09:00",
    graceMinutes: 15,
    leaveQuota: 20,
    latesPerDeduction: 0,
    workingDays: [1, 2, 3, 4, 5]
  });

  Storage.set("hcm_users", [...users, admin]);
  Storage.set("hcm_attendance", []);
  Storage.set("hcm_leaves", []);
  Storage.set("hcm_holidays", []);
  Storage.set("hcm_payments", []);

  setupForm.reset();
  initializeApp();

  showMessage(
    "Company created successfully! Please log in.",
    "success"
  );
});

// Login for Admin or Employee
loginForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const email =
    document.getElementById("email").value.trim().toLowerCase();

  const password =
    document.getElementById("password").value;

  const users = Storage.get("hcm_users", []);

  const user = users.find(
    item => item.email === email && Auth.verify(item, password)
  );

  if (!user) {
    showMessage("Invalid email or password.", "error");
    return;
  }

  // Upgrade old plain-text passwords to hashed ones.
  if (user.password) {
    Auth.setPassword(user, password);
    Storage.set("hcm_users", users);
  }

  Storage.set("hcm_session", {
    userId: user.id,
    role: user.role
  });

  if (user.role === "admin") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "employee.html";
  }
});

initializeApp();
