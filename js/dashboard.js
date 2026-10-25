const today = new Date().toLocaleDateString("en-CA");
const session = Storage.get("hcm_session");
const allUsers = Storage.get("hcm_users", []);

function requireRole(role) {
  if (!session || session.role !== role) {
    window.location.href = "index.html";
    return false;
  }

  const currentUser = allUsers.find((user) => user.id === session.userId);

  if (!currentUser) {
    Storage.remove("hcm_session");
    window.location.href = "index.html";
    return false;
  }

  return true;
}

function logout() {
  Storage.remove("hcm_session");
  window.location.href = "index.html";
}

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}

// ADMIN DASHBOARD
if (document.getElementById("employeeForm") && requireRole("admin")) {
  const company = Storage.get("hcm_company", { name: "HCM Lite" });

  document.getElementById("companyTitle").textContent =
    company.name + " — Admin Dashboard";

  const employeeForm = document.getElementById("employeeForm");
  const employeeList = document.getElementById("employeeList");
  const adminMessage = document.getElementById("adminMessage");
  const searchInput = document.getElementById("employeeSearch");
  const $ = (id) => document.getElementById(id);

  let editId = null;

  function setMode() {
    $("formTitle").textContent = editId ? "Edit Employee" : "Add Employee";
    $("empSubmit").textContent = editId ? "Save Changes" : "Add Employee";
    $("cancelEdit").hidden = !editId;
    $("empPassword").required = !editId;
    $("empPassword").placeholder = editId ? "Leave blank to keep current" : "";
    $("bankFields").hidden = $("empPayMethod").value !== "bank";
  }

  $("empPayMethod").addEventListener("change", setMode);

  $("cancelEdit").addEventListener("click", () => {
    editId = null;
    employeeForm.reset();
    setMode();
  });

  function getEmployees() {
    return Storage.get("hcm_users", []).filter(
      (user) => user.role === "employee",
    );
  }

  function renderEmployees(search = "") {
    const query = search.toLowerCase();

    const employees = getEmployees().filter((user) =>
      [user.name, user.email, user.department].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );

    employeeList.replaceChildren();

    if (employees.length === 0) {
      employeeList.textContent = "No employees found.";
      return;
    }

    employees.forEach((employee) => {
      const card = document.createElement("div");
      card.className = "emp-card";

      const name = document.createElement("h3");
      name.textContent = employee.name;

      const details = document.createElement("p");
      details.textContent =
        employee.email +
        " · " +
        employee.department +
        " · PKR " +
        employee.salary;

      const pay = document.createElement("p");
      pay.style.color = "#71717a";
      pay.textContent =
        employee.payMethod === "bank"
          ? "Payment: Bank — " +
            (employee.bankName || "") +
            " " +
            (employee.accountNo || "")
          : "Payment: Cheque collection from company";

      const actions = document.createElement("div");
      actions.className = "row-actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn-ghost";
      editBtn.textContent = "Edit";

      editBtn.addEventListener("click", () => {
        editId = employee.id;
        $("empName").value = employee.name;
        $("empEmail").value = employee.email;
        $("empPassword").value = "";
        $("empDepartment").value = employee.department;
        $("empSalary").value = employee.salary;
        $("empPayMethod").value =
          employee.payMethod || (employee.accountNo ? "bank" : "cheque");
        $("empBank").value = employee.bankName || "";
        $("empAccount").value = employee.accountNo || "";
        setMode();
        employeeForm.scrollIntoView({ behavior: "smooth" });
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-out";
      removeBtn.textContent = "Delete Employee";

      removeBtn.addEventListener("click", () => {
        if (!confirm("Delete " + employee.name + "?")) return;

        Storage.set(
          "hcm_users",
          Storage.get("hcm_users", []).filter(
            (user) => user.id !== employee.id,
          ),
        );

        Storage.set(
          "hcm_attendance",
          Storage.get("hcm_attendance", []).filter(
            (record) => record.employeeId !== employee.id,
          ),
        );

        Storage.set(
          "hcm_leaves",
          Storage.get("hcm_leaves", []).filter(
            (leave) => leave.employeeId !== employee.id,
          ),
        );

        Storage.set(
          "hcm_payments",
          Storage.get("hcm_payments", []).filter(
            (payment) => payment.employeeId !== employee.id,
          ),
        );

        renderEmployees(searchInput.value);
        updateStats();
        adminMessage.textContent = "Employee deleted.";
      });

      actions.append(editBtn, removeBtn);
      card.append(name, details, pay, actions);
      employeeList.append(card);
    });
  }

  function updateStats() {
    const employees = getEmployees();
    const records = Storage.get("hcm_attendance", []).filter(
      (record) => record.date === today,
    );

    const onLeave = Storage.get("hcm_leaves", []).filter(
      (leave) =>
        leave.status === "approved" && leave.from <= today && leave.to >= today,
    );

    document.getElementById("employeeCount").textContent = employees.length;

    document.getElementById("presentCount").textContent = records.filter(
      (record) => record.checkIn,
    ).length;

    document.getElementById("lateCount").textContent = records.filter(
      (record) => record.status === "late" || record.late,
    ).length;

    document.getElementById("leaveCount").textContent = onLeave.length;
  }

  employeeForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = $("empName").value.trim();
    const email = $("empEmail").value.trim().toLowerCase();
    const password = $("empPassword").value;
    const department = $("empDepartment").value.trim();
    const salary = Number($("empSalary").value);
    const payMethod = $("empPayMethod").value;
    const bankName = $("empBank").value.trim();
    const accountNo = $("empAccount").value.trim();

    const users = Storage.get("hcm_users", []);

    if (users.some((user) => user.email === email && user.id !== editId)) {
      adminMessage.textContent = "This email is already registered.";
      return;
    }

    if (
      !name ||
      !department ||
      salary <= 0 ||
      (!editId && password.length < 6) ||
      (password && password.length < 6)
    ) {
      adminMessage.textContent =
        "Please check all fields (password needs 6+ characters).";
      return;
    }

    if (payMethod === "bank" && (!bankName || !accountNo)) {
      adminMessage.textContent =
        "Please enter the bank name and account number.";
      return;
    }

    const details = {
      name,
      email,
      department,
      salary,
      payMethod,
      bankName,
      accountNo,
    };

    if (editId) {
      const employee = users.find((user) => user.id === editId);
      Object.assign(employee, details);
      if (password) Auth.setPassword(employee, password);
      adminMessage.textContent = "Employee updated.";
    } else {
      const employee = { id: Date.now(), role: "employee", ...details };
      Auth.setPassword(employee, password);
      users.push(employee);
      adminMessage.textContent =
        "Employee added. Their login account is ready.";
    }

    Storage.set("hcm_users", users);

    editId = null;
    employeeForm.reset();
    setMode();

    renderEmployees(searchInput.value);
    updateStats();
  });

  searchInput.addEventListener("input", () => {
    renderEmployees(searchInput.value);
  });

  document.getElementById("helperForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const question = document
      .getElementById("helperQuestion")
      .value.toLowerCase();

    const employees = getEmployees();
    const records = Storage.get("hcm_attendance", []).filter(
      (record) => record.date === today,
    );

    let answer =
      "Try asking how many employees we have, who is late, or who is on leave today.";

    if (question.includes("late")) {
      const late = records.filter(
        (record) => record.status === "late" || record.late,
      );
      answer =
        late.length + " employee attendance record(s) are marked late today.";
    } else if (question.includes("leave")) {
      const leaves = Storage.get("hcm_leaves", []).filter(
        (leave) =>
          leave.status === "approved" &&
          leave.from <= today &&
          leave.to >= today,
      );

      answer = leaves.length + " approved leave request(s) cover today.";
    } else if (question.includes("employee")) {
      answer = "Your company has " + employees.length + " employees.";
    }

    document.getElementById("helperAnswer").textContent = answer;
  });

  setMode();
  renderEmployees();
  updateStats();
}
