(() => {
  const form = document.getElementById("salaryForm");
  if (!form) return;

  const session = Storage.get("hcm_session");
  const user = session
    ? Storage.get("hcm_users", []).find((item) => item.id === session.userId)
    : null;

  if (!user || user.role !== "employee") return;

  const monthInput = document.getElementById("slipMonth");
  const slipBox = document.getElementById("salarySlip");
  const printBtn = document.getElementById("printSlipBtn");

  monthInput.value = Payroll.fmtDate(new Date()).slice(0, 7);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!monthInput.value) return;
    Payroll.renderSlip(slipBox, user, monthInput.value);
    printBtn.hidden = false;
  });

  printBtn.addEventListener("click", () => window.print());
})();
