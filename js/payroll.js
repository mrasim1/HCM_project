// Shared payroll + attendance helpers (used by employee slip and admin reports)
const Payroll = (() => {
  const pad = (n) => String(n).padStart(2, "0");
  const fmtDate = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const money = (n) => "PKR " + Math.round(n).toLocaleString();

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function context() {
    const company = Storage.get("hcm_company", {});
    return {
      days: company.workingDays || [1, 2, 3, 4, 5],
      holidays: new Set(Storage.get("hcm_holidays", []).map((h) => h.date)),
      attendance: Storage.get("hcm_attendance", []),
      leaves: Storage.get("hcm_leaves", []).filter(
        (l) => l.status === "approved",
      ),
      today: fmtDate(new Date()),
      latesPerDeduction: Number(company.latesPerDeduction || 0),
    };
  }

  function isWorking(dateStr, ctx) {
    const day = new Date(dateStr + "T12:00:00").getDay();
    return ctx.days.includes(day) && !ctx.holidays.has(dateStr);
  }

  const joinedOn = (user) => user.joined || fmtDate(new Date(user.id));

  // present | late | half | incomplete | leave | absent
  function dayStatus(userId, dateStr, ctx) {
    const rec = ctx.attendance.find(
      (a) => a.employeeId === userId && a.date === dateStr,
    );

    if (rec) {
      let key = "present";
      if (!rec.checkOut && dateStr < ctx.today) key = "incomplete";
      else if (rec.status === "half day") key = "half";
      else if (rec.status === "late" || rec.late) key = "late";
      return { key, rec };
    }

    if (
      ctx.leaves.some(
        (l) => l.employeeId === userId && l.from <= dateStr && l.to >= dateStr,
      )
    ) {
      return { key: "leave" };
    }
    return { key: "absent" };
  }

  function calculate(user, monthValue, ctx = context()) {
    const [year, month] = monthValue.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const joined = joinedOn(user);

    const r = {
      workingDays: 0,
      elapsed: 0,
      upcoming: 0,
      before: 0,
      present: 0,
      late: 0,
      half: 0,
      incomplete: 0,
      leave: 0,
      absent: 0,
    };

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      if (!isWorking(dateStr, ctx)) continue;

      r.workingDays++;

      if (dateStr > ctx.today) {
        r.upcoming++;
        continue;
      }
      if (dateStr < joined) {
        r.before++;
        continue;
      }

      r.elapsed++;
      r[dayStatus(user.id, dateStr, ctx).key]++;
    }

    r.perDay = user.salary / (r.workingDays || 1);
    r.lateDays =
      ctx.latesPerDeduction > 0
        ? Math.floor(r.late / ctx.latesPerDeduction)
        : 0;
    r.deductionDays =
      r.absent + r.before + 0.5 * (r.half + r.incomplete) + r.lateDays;
    r.deduction = r.perDay * r.deductionDays;
    r.net = Math.max(0, user.salary - r.deduction);
    return r;
  }

  function payMethod(user) {
    return user.payMethod || (user.accountNo ? "bank" : "cheque");
  }

  function addRow(table, label, value, bold) {
    const tr = el("tr");
    const a = el("td", "", label);
    const b = el("td", "", value);
    if (bold) {
      a.style.fontWeight = b.style.fontWeight = "700";
    }
    tr.append(a, b);
    table.append(tr);
  }

  function renderSlip(host, user, monthValue) {
    const company = Storage.get("hcm_company", { name: "HCM Lite" });
    const r = calculate(user, monthValue);
    const payment = Storage.get("hcm_payments", []).find(
      (p) => p.employeeId === user.id && p.month === monthValue,
    );
    const monthLabel = new Date(monthValue + "-01T12:00:00").toLocaleString(
      "en",
      { month: "long", year: "numeric" },
    );

    host.replaceChildren();
    const slip = el("div", "slip");

    const head = el("div", "slip-head");
    const title = el("div", "slip-title");
    title.append(el("strong", "", "SALARY SLIP"), el("span", "", monthLabel));
    head.append(el("h3", "", company.name), title);

    const info = el("div", "slip-info");
    [
      ["Employee", user.name],
      ["Department", user.department],
      ["Email", user.email],
      ["Employee ID", String(user.id).slice(-6)],
      ["Joined", joinedOn(user)],
      ["Generated on", fmtDate(new Date())],
    ].forEach(([k, v]) => {
      const d = el("div");
      d.append(el("span", "", k), document.createTextNode(v));
      info.append(d);
    });

    const cols = el("div", "slip-cols");
    const earn = el("div"),
      ded = el("div");
    const t1 = el("table"),
      t2 = el("table");
    earn.append(el("h4", "", "Earnings"), t1);
    ded.append(el("h4", "", "Deductions"), t2);

    addRow(t1, "Basic salary", money(user.salary));
    addRow(t1, "Total earnings", money(user.salary), true);

    addRow(t2, `Absent (${r.absent} day)`, money(r.absent * r.perDay));
    addRow(
      t2,
      `Half day / no check-out (${r.half + r.incomplete})`,
      money((r.half + r.incomplete) * 0.5 * r.perDay),
    );
    if (r.lateDays)
      addRow(t2, `Late rule (${r.late} late)`, money(r.lateDays * r.perDay));
    if (r.before)
      addRow(
        t2,
        `Before joining (${r.before} day)`,
        money(r.before * r.perDay),
      );
    addRow(t2, "Total deductions", money(r.deduction), true);
    cols.append(earn, ded);

    const chips = el("div", "slip-chips");
    [
      ["Working days", r.workingDays, ""],
      ["Present", r.present, "present"],
      ["Late", r.late, "late"],
      ["Half day", r.half, ""],
      ["No check-out", r.incomplete, "incomplete"],
      ["Leave", r.leave, "leave"],
      ["Absent", r.absent, "absent"],
    ].forEach(([k, v, c]) =>
      chips.append(el("span", "tag tag-" + c, `${k}: ${v}`)),
    );

    const net = el("div", "slip-net");
    net.append(
      el("span", "", "Net salary payable"),
      el("strong", "", money(r.net)),
    );

    const pay = el("div", "slip-pay");
    pay.append(el("h4", "", "Payment details"));

    if (payMethod(user) === "bank") {
      pay.append(
        el("p", "", "Method: Bank transfer"),
        el("p", "", `Bank: ${user.bankName || "—"}`),
        el("p", "", `Account no: ${user.accountNo || "—"}`),
      );
    } else {
      pay.append(
        el("p", "", "Method: Cheque collection"),
        el(
          "p",
          "",
          "Please collect your cheque from the company accounts office.",
        ),
      );
    }
    const status = el(
      "p",
      "",
      payment ? `Status: PAID on ${payment.paidOn}` : "Status: PENDING",
    );
    status.style.fontWeight = "700";
    pay.append(status);

    const sign = el("div", "slip-sign");
    sign.append(
      el(
        "div",
        "",
        payMethod(user) === "bank"
          ? "Employee signature"
          : "Received by (employee signature & date)",
      ),
      el("div", "", "Authorized signatory"),
    );

    slip.append(head, info, cols, chips, net, pay, sign);

    if (r.upcoming > 0) {
      slip.append(
        el(
          "p",
          "slip-note",
          `${r.upcoming} working day(s) are still to come and are counted as paid until attendance is recorded.`,
        ),
      );
    }
    host.append(slip);
  }

  function downloadCSV(name, rows) {
    const csv = rows
      .map((row) =>
        row.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","),
      )
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
  }

  return {
    pad,
    fmtDate,
    money,
    el,
    context,
    isWorking,
    joinedOn,
    dayStatus,
    calculate,
    payMethod,
    renderSlip,
    downloadCSV,
  };
})();
