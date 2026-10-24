function getLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

if (
  document.getElementById("checkInBtn") &&
  requireRole("employee")
) {
  const currentUser = Storage.get("hcm_users", []).find(
    user => user.id === session.userId
  );

  const company = Storage.get("hcm_company", {});
  const statusText = document.getElementById("attendanceStatus");
  const checkInBtn = document.getElementById("checkInBtn");
  const checkOutBtn = document.getElementById("checkOutBtn");
  const historyBox = document.getElementById("myAttendance");

  document.getElementById("employeeTitle").textContent =
    "Welcome, " + currentUser.name;

  function getMyRecords() {
    return Storage.get("hcm_attendance", []).filter(
      record => record.employeeId === currentUser.id
    );
  }

  function renderAttendance() {
    const records = getMyRecords();
    const today = getLocalDate();

    const record = records.find(item => item.date === today);

    if (!record) {
      statusText.textContent = "You have not checked in today.";
      checkInBtn.disabled = false;
      checkOutBtn.disabled = true;
    } else {
      statusText.textContent =
        "Check-in: " + record.checkIn +
        " | Check-out: " + (record.checkOut || "Not checked out") +
        " | Status: " + record.status;

      checkInBtn.disabled = true;
      checkOutBtn.disabled = !record.checkIn || Boolean(record.checkOut);
    }

    historyBox.replaceChildren();

    records.sort((a, b) => b.date.localeCompare(a.date))
      .forEach(item => {
        const row = document.createElement("p");
        row.textContent =
          `${item.date} | In: ${item.checkIn} | Out: ${
            item.checkOut || "—"
          } | ${item.status}`;

        row.className = "rec " + (
          item.status === "late" ? "late" :
          item.status === "half day" ? "half" : "present"
        );
        historyBox.append(row);
      });

    if (records.length === 0) {
      historyBox.textContent = "No attendance records yet.";
    }
  }

  checkInBtn.addEventListener("click", () => {
    const records = Storage.get("hcm_attendance", []);
    const today = getLocalDate();

    if (records.some(record =>
      record.employeeId === currentUser.id &&
      record.date === today
    )) {
      statusText.textContent = "You have already checked in today.";
      return;
    }

    const now = new Date();
    const time = now.toTimeString().slice(0, 5);

    const [startHour, startMinute] =
      (company.officeStart || "09:00").split(":").map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const grace = Number(company.graceMinutes || 0);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const status = currentMinutes > startMinutes + grace
      ? "late"
      : "present";

    records.push({
      id: Date.now(),
      employeeId: currentUser.id,
      date: today,
      checkIn: time,
      checkOut: "",
      status,
      late: status === "late"
    });

    Storage.set("hcm_attendance", records);
    renderAttendance();
  });

  checkOutBtn.addEventListener("click", () => {
    const records = Storage.get("hcm_attendance", []);
    const today = getLocalDate();

    const record = records.find(item =>
      item.employeeId === currentUser.id &&
      item.date === today
    );

    if (!record || !record.checkIn || record.checkOut) {
      statusText.textContent =
        "You need an active check-in before checking out.";
      return;
    }

    const now = new Date();

    record.checkOut = now.toTimeString().slice(0, 5);

    const [inHour, inMinute] = record.checkIn.split(":").map(Number);
    const [outHour, outMinute] = record.checkOut.split(":").map(Number);

    const hoursWorked =
      (outHour * 60 + outMinute - inHour * 60 - inMinute) / 60;

    record.hoursWorked = Math.max(0, hoursWorked);

    if (record.hoursWorked < 5) {
      record.status = "half day";
    }

    Storage.set("hcm_attendance", records);
    renderAttendance();
  });

  document.getElementById("employeeHelperForm").addEventListener(
    "submit", event => {
      event.preventDefault();

      const question = document.getElementById("employeeQuestion")
        .value.toLowerCase();

      const records = getMyRecords();
      const today = getLocalDate();
      const todayRecord = records.find(item => item.date === today);

      let answer = "Try asking: Was I late today?";

      if (question.includes("late")) {
        answer = todayRecord
          ? (todayRecord.status === "late"
              ? "Your attendance is marked late today."
              : "Your attendance is not marked late today.")
          : "No attendance record exists for today.";
      } else if (question.includes("hour")) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 6);

        const total = records
          .filter(item => item.date >= getDateString(weekStart))
          .reduce((sum, item) => sum + (item.hoursWorked || 0), 0);

        answer = "Recorded hours over the last 7 days: " +
          total.toFixed(2);
      } else if (question.includes("attendance")) {
        answer = "You have " + records.length +
          " attendance record(s).";
      }

      document.getElementById("employeeAnswer").textContent = answer;
    }
  );

  function getDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  renderAttendance();
}
