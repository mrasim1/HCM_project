(() => {
  if (!document.getElementById("payrollMonth") || !requireRole("admin")) return;

  const $ = (id) => document.getElementById(id);
  const P = Payroll;
  const employees = () =>
    Storage.get("hcm_users", []).filter((u) => u.role === "employee");

  $("payrollMonth").value = P.fmtDate(new Date()).slice(0, 7);
  $("attDate").value = P.fmtDate(new Date());

  const tag = (text, cls) => {
    const s = P.el("span", "tag tag-" + cls, text);
    return s;
  };

  function cell(tr, content) {
    const td = document.createElement("td");
    if (content instanceof Node) td.append(content);
    else td.textContent = content;
    tr.append(td);
  }

  function header(cols) {
    const tr = document.createElement("tr");
    cols.forEach((c) => tr.append(P.el("th", "", c)));
    return tr;
  }

  // ---------- Payroll ----------
  let payrollRows = [];

  function renderPayroll() {
    const month = $("payrollMonth").value;
    if (!month) return;

    const ctx = P.context();
    const payments = Storage.get("hcm_payments", []);
    const head = $("payrollHead"),
      body = $("payrollBody"),
      foot = $("payrollFoot");
    head.replaceChildren(
      header([
        "Employee",
        "Dept",
        "Salary",
        "Present",
        "Late",
        "Half/No out",
        "Leave",
        "Absent",
        "Deduction",
        "Net salary",
        "Payment",
        "Status",
        "",
      ]),
    );
    body.replaceChildren();
    foot.replaceChildren();

    payrollRows = [
      [
        "Employee",
        "Department",
        "Salary",
        "Present",
        "Late",
        "Half/No checkout",
        "Leave",
        "Absent",
        "Deduction",
        "Net",
        "Method",
        "Account",
        "Status",
      ],
    ];

    let totalSalary = 0,
      totalNet = 0;

    employees().forEach((user) => {
      const r = P.calculate(user, month, ctx);
      const paid = payments.find(
        (p) => p.employeeId === user.id && p.month === month,
      );
      const method = P.payMethod(user);
      totalSalary += user.salary;
      totalNet += r.net;

      const tr = document.createElement("tr");
      cell(tr, user.name);
      cell(tr, user.department);
      cell(tr, P.money(user.salary));
      cell(tr, r.present);
      cell(tr, r.late);
      cell(tr, r.half + r.incomplete);
      cell(tr, r.leave);
      cell(tr, r.absent);
      cell(tr, P.money(r.deduction));
      cell(tr, P.money(r.net));
      cell(
        tr,
        method === "bank"
          ? `Bank: ${user.bankName || ""} ${user.accountNo || ""}`
          : "Cheque",
      );
      cell(tr, tag(paid ? "Paid" : "Pending", paid ? "paid" : "pending"));

      const actions = P.el("div", "row-actions");
      const slipBtn = P.el("button", "btn-ghost", "Slip");
      slipBtn.type = "button";
      slipBtn.addEventListener("click", () => {
        P.renderSlip($("slipHost"), user, month);
        $("printAdminSlip").hidden = false;
        $("slipHost").scrollIntoView({ behavior: "smooth" });
      });

      const payBtn = P.el(
        "button",
        paid ? "btn-out" : "btn-in",
        paid ? "Undo paid" : "Mark paid",
      );
      payBtn.type = "button";
      payBtn.addEventListener("click", () => {
        let list = Storage.get("hcm_payments", []).filter(
          (p) => !(p.employeeId === user.id && p.month === month),
        );
        if (!paid) {
          list.push({
            employeeId: user.id,
            month,
            paidOn: P.fmtDate(new Date()),
            amount: Math.round(r.net),
          });
        }
        Storage.set("hcm_payments", list);
        renderPayroll();
      });

      actions.append(slipBtn, payBtn);
      cell(tr, actions);
      body.append(tr);

      payrollRows.push([
        user.name,
        user.department,
        user.salary,
        r.present,
        r.late,
        r.half + r.incomplete,
        r.leave,
        r.absent,
        Math.round(r.deduction),
        Math.round(r.net),
        method,
        method === "bank"
          ? `${user.bankName || ""} ${user.accountNo || ""}`
          : "",
        paid ? "Paid" : "Pending",
      ]);
    });

    if (!body.children.length) {
      $("payrollEmpty").textContent = "No employees yet.";
      return;
    }
    $("payrollEmpty").textContent = "";

    const tf = document.createElement("tr");
    cell(tf, "Total");
    cell(tf, "");
    cell(tf, P.money(totalSalary));
    for (let i = 0; i < 5; i++) cell(tf, "");
    cell(tf, P.money(totalSalary - totalNet));
    cell(tf, P.money(totalNet));
    cell(tf, "");
    cell(tf, "");
    cell(tf, "");
    foot.append(tf);
  }

  $("payrollMonth").addEventListener("change", () => {
    $("slipHost").replaceChildren();
    $("printAdminSlip").hidden = true;
    renderPayroll();
  });
  $("payrollCsv").addEventListener("click", () =>
    P.downloadCSV(`payroll-${$("payrollMonth").value}.csv`, payrollRows),
  );
  $("printAdminSlip").addEventListener("click", () => window.print());

  // ---------- Attendance ----------
  let attRows = [];
  const labels = {
    present: "Present",
    late: "Late",
    half: "Half day",
    incomplete: "No check-out",
    leave: "On leave",
    absent: "Absent",
  };

  function renderAttendance() {
    const date = $("attDate").value;
    if (!date) return;

    const ctx = P.context();
    const head = $("attHead"),
      body = $("attBody");
    head.replaceChildren(
      header([
        "Employee",
        "Department",
        "Status",
        "Check-in",
        "Check-out",
        "Hours",
      ]),
    );
    body.replaceChildren();
    attRows = [
      ["Employee", "Department", "Status", "Check-in", "Check-out", "Hours"],
    ];

    const working = P.isWorking(date, ctx);
    const counts = {};

    employees().forEach((user) => {
      let label,
        cls,
        rec = null;

      if (date < P.joinedOn(user)) {
        label = "Not joined";
        cls = "";
      } else if (
        !working &&
        !ctx.attendance.some((a) => a.employeeId === user.id && a.date === date)
      ) {
        label = "Off day / holiday";
        cls = "";
      } else if (date > ctx.today) {
        label = "Upcoming";
        cls = "";
      } else {
        const s = P.dayStatus(user.id, date, ctx);
        label = labels[s.key];
        cls = s.key;
        rec = s.rec;
      }
      counts[label] = (counts[label] || 0) + 1;

      let hours = "";
      if (rec && rec.checkIn && rec.checkOut) {
        const [ih, im] = rec.checkIn.split(":").map(Number);
        const [oh, om] = rec.checkOut.split(":").map(Number);
        let m = oh * 60 + om - ih * 60 - im;
        if (m < 0) m += 1440;
        hours = (m / 60).toFixed(2);
      }

      const tr = document.createElement("tr");
      cell(tr, user.name);
      cell(tr, user.department);
      cell(tr, tag(label, cls));
      cell(tr, rec ? rec.checkIn : "—");
      cell(tr, rec ? rec.checkOut || "—" : "—");
      cell(tr, hours || "—");
      body.append(tr);
      attRows.push([
        user.name,
        user.department,
        label,
        rec ? rec.checkIn : "",
        rec ? rec.checkOut : "",
        hours,
      ]);
    });

    $("attSummary").textContent = Object.keys(counts).length
      ? Object.entries(counts)
          .map(([k, v]) => `${k}: ${v}`)
          .join("  |  ")
      : "No employees yet.";
  }

  $("attDate").addEventListener("change", renderAttendance);
  $("attCsv").addEventListener("click", () =>
    P.downloadCSV(`attendance-${$("attDate").value}.csv`, attRows),
  );

  renderPayroll();
  renderAttendance();
})();
