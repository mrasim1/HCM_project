(() => {
  const users = () => Storage.get("hcm_users", []);
  const leaves = () => Storage.get("hcm_leaves", []);

  const session = Storage.get("hcm_session");
  const company = Storage.get("hcm_company", { leaveQuota: 20 });

  function getUser() {
    if (!session) return null;
    return users().find((user) => user.id === session.userId) || null;
  }

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function workingDays(from, to) {
    let count = 0;
    const date = new Date(from + "T12:00:00");
    const end = new Date(to + "T12:00:00");

    while (date <= end) {
      const day = date.getDay();

      const key =
        date.getFullYear() +
        "-" +
        String(date.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(date.getDate()).padStart(2, "0");

      if (
        (company.workingDays || [1, 2, 3, 4, 5]).includes(day) &&
        !Storage.get("hcm_holidays", []).some((h) => h.date === key)
      )
        count++;

      date.setDate(date.getDate() + 1);
    }

    return count;
  }

  function overlaps(from, to, existing) {
    return existing.some(
      (item) =>
        item.status !== "rejected" && from <= item.to && to >= item.from,
    );
  }

  function approvedDays(employeeId, excludeId = null) {
    return leaves()
      .filter(
        (item) =>
          item.employeeId === employeeId &&
          item.status === "approved" &&
          item.id !== excludeId,
      )
      .reduce((sum, item) => sum + item.days, 0);
  }

  function showError(element, message) {
    element.textContent = message;
    element.style.color = "#dc2626";
  }

  // EMPLOYEE: apply for leave and view own requests
  const leaveForm = document.getElementById("leaveForm");

  if (leaveForm) {
    const user = getUser();

    if (!user || user.role !== "employee") {
      window.location.href = "index.html";
      return;
    }

    const balance = document.getElementById("leaveBalance");
    const message = document.getElementById("leaveMessage");
    const myLeaves = document.getElementById("myLeaves");

    function renderMyLeaves() {
      const ownLeaves = leaves().filter((item) => item.employeeId === user.id);

      const quota = Number(company.leaveQuota ?? 20);
      const used = ownLeaves
        .filter(
          (item) => item.status === "approved" || item.status === "pending",
        )
        .reduce((sum, item) => sum + item.days, 0);

      balance.textContent = Math.max(0, quota - used) + " days";
      myLeaves.replaceChildren();

      if (ownLeaves.length === 0) {
        myLeaves.textContent = "You have not applied for leave yet.";
        return;
      }

      ownLeaves
        .slice()
        .reverse()
        .forEach((item) => {
          const row = document.createElement("p");
          row.textContent =
            `${item.type}: ${item.from} to ${item.to} ` +
            `(${item.days} working days) — ${item.status}` +
            (item.comment ? ` | Admin: ${item.comment}` : "");

          row.className = "rec leave";
          myLeaves.appendChild(row);
        });
    }

    leaveForm.addEventListener("submit", (event) => {
      event.preventDefault();

      const type = document.getElementById("leaveType").value;
      const from = document.getElementById("leaveFrom").value;
      const to = document.getElementById("leaveTo").value;
      const reason = document.getElementById("leaveReason").value.trim();

      if (!type || !from || !to || !reason) {
        showError(message, "Please complete every field.");
        return;
      }

      if (from < today()) {
        showError(message, "You cannot apply for past dates.");
        return;
      }

      if (from > to) {
        showError(message, "The start date must be before the end date.");
        return;
      }

      const days = workingDays(from, to);

      if (days === 0) {
        showError(message, "Select at least one working day.");
        return;
      }

      const currentLeaves = leaves();
      const ownLeaves = currentLeaves.filter(
        (item) => item.employeeId === user.id,
      );

      if (overlaps(from, to, ownLeaves)) {
        showError(
          message,
          "These dates overlap an existing pending or approved leave.",
        );
        return;
      }

      const quota = Number(company.leaveQuota ?? 20);

      const reservedDays = ownLeaves
        .filter(
          (item) => item.status === "approved" || item.status === "pending",
        )
        .reduce((sum, item) => sum + item.days, 0);

      if (reservedDays + days > quota) {
        showError(message, "Your leave quota is not sufficient.");
        return;
      }

      currentLeaves.push({
        id: Date.now(),
        employeeId: user.id,
        type,
        from,
        to,
        days,
        reason,
        status: "pending",
        comment: "",
      });

      Storage.set("hcm_leaves", currentLeaves);

      leaveForm.reset();
      message.style.color = "#15803d";
      message.textContent = "Leave request submitted successfully.";

      renderMyLeaves();
    });

    renderMyLeaves();
  }

  // ADMIN: review and decide on leave requests
  const leaveList = document.getElementById("leaveList");

  if (leaveList) {
    const admin = getUser();

    if (!admin || admin.role !== "admin") {
      window.location.href = "index.html";
      return;
    }

    const adminMessage = document.getElementById("leaveAdminMessage");

    function renderRequests() {
      leaveList.replaceChildren();

      const requests = leaves().slice().reverse();

      if (requests.length === 0) {
        leaveList.textContent = "No leave requests yet.";
        return;
      }

      requests.forEach((item) => {
        const employee = users().find((user) => user.id === item.employeeId);

        const card = document.createElement("section");
        card.style.cssText =
          "border:1px solid #cbd5e1;padding:16px;" +
          "border-radius:10px;margin:12px 0";

        const heading = document.createElement("h3");
        heading.textContent = employee
          ? employee.name + " — " + item.type
          : "Unknown employee";

        const details = document.createElement("p");
        details.textContent = `${item.from} to ${item.to} | ${item.days} working days`;

        const reason = document.createElement("p");
        reason.textContent = "Reason: " + item.reason;

        const status = document.createElement("p");
        status.textContent = "Status: " + item.status;

        card.append(heading, details, reason, status);

        if (item.comment) {
          const comment = document.createElement("p");
          comment.textContent = "Admin comment: " + item.comment;
          card.appendChild(comment);
        }

        if (item.status === "pending") {
          const commentInput = document.createElement("input");
          commentInput.placeholder = "Optional comment";
          commentInput.setAttribute("aria-label", "Admin comment");

          const approveBtn = document.createElement("button");
          approveBtn.type = "button";
          approveBtn.textContent = "Approve";
          approveBtn.className = "btn-in";

          const rejectBtn = document.createElement("button");
          rejectBtn.type = "button";
          rejectBtn.textContent = "Reject";
          rejectBtn.className = "btn-out";
          rejectBtn.style.marginLeft = "8px";

          approveBtn.addEventListener("click", () => {
            const currentLeaves = leaves();
            const request = currentLeaves.find((entry) => entry.id === item.id);

            if (!request || request.status !== "pending") {
              renderRequests();
              return;
            }

            const employeeLeaves = currentLeaves.filter(
              (entry) =>
                entry.employeeId === request.employeeId &&
                entry.id !== request.id,
            );

            if (overlaps(request.from, request.to, employeeLeaves)) {
              adminMessage.textContent =
                "Cannot approve: these dates overlap another leave.";
              return;
            }

            const quota = Number(company.leaveQuota ?? 20);

            if (
              approvedDays(request.employeeId, request.id) + request.days >
              quota
            ) {
              adminMessage.textContent =
                "Cannot approve: the employee's leave quota is exceeded.";
              return;
            }

            request.status = "approved";
            request.comment = commentInput.value.trim();

            Storage.set("hcm_leaves", currentLeaves);

            adminMessage.textContent = "Leave approved.";
            renderRequests();
          });

          rejectBtn.addEventListener("click", () => {
            const currentLeaves = leaves();
            const request = currentLeaves.find((entry) => entry.id === item.id);

            if (!request || request.status !== "pending") {
              renderRequests();
              return;
            }

            request.status = "rejected";
            request.comment = commentInput.value.trim();

            Storage.set("hcm_leaves", currentLeaves);

            adminMessage.textContent = "Leave rejected.";
            renderRequests();
          });

          card.append(commentInput, approveBtn, rejectBtn);
        }

        leaveList.appendChild(card);
      });
    }

    renderRequests();
  }
})();
