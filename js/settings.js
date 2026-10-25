(() => {
  const form = document.getElementById("settingsForm");
  if (!form || !requireRole("admin")) return;

  const $ = (id) => document.getElementById(id);
  const company = Storage.get("hcm_company", {});

  $("setName").value = company.name || "";
  $("setStart").value = company.officeStart || "09:00";
  $("setGrace").value = company.graceMinutes ?? 15;
  $("setQuota").value = company.leaveQuota ?? 20;
  $("setLates").value = company.latesPerDeduction ?? 0;

  const workDays = company.workingDays || [1, 2, 3, 4, 5];
  document.querySelectorAll("input[name=wd]").forEach((box) => {
    box.checked = workDays.includes(Number(box.value));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const days = [...document.querySelectorAll("input[name=wd]:checked")].map(
      (box) => Number(box.value),
    );

    if (days.length === 0) {
      $("settingsMessage").textContent = "Select at least one working day.";
      return;
    }

    Storage.set("hcm_company", {
      ...Storage.get("hcm_company", {}),
      name: $("setName").value.trim() || "HCM Lite",
      officeStart: $("setStart").value || "09:00",
      graceMinutes: Number($("setGrace").value) || 0,
      leaveQuota: Number($("setQuota").value) || 0,
      latesPerDeduction: Number($("setLates").value) || 0,
      workingDays: days,
    });

    $("settingsMessage").textContent = "Settings saved.";
  });

  // Holidays
  const list = $("holidayList");

  function renderHolidays() {
    const holidays = Storage.get("hcm_holidays", [])
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));

    list.replaceChildren();
    if (holidays.length === 0) {
      list.textContent = "No holidays added.";
      return;
    }

    holidays.forEach((h) => {
      const row = document.createElement("div");
      row.className = "rec leave";
      row.textContent = `${h.date} — ${h.name} `;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn-out";
      del.textContent = "Remove";
      del.style.cssText = "margin:0 0 0 10px;padding:4px 10px;font-size:13px";
      del.addEventListener("click", () => {
        Storage.set(
          "hcm_holidays",
          Storage.get("hcm_holidays", []).filter((x) => x.date !== h.date),
        );
        renderHolidays();
      });

      row.append(del);
      list.append(row);
    });
  }

  $("holidayForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const date = $("holDate").value;
    const name = $("holName").value.trim();
    const holidays = Storage.get("hcm_holidays", []);

    if (!date || !name) return;
    if (holidays.some((h) => h.date === date)) {
      $("holidayMessage").textContent = "That date is already a holiday.";
      return;
    }

    holidays.push({ date, name });
    Storage.set("hcm_holidays", holidays);
    $("holidayForm").reset();
    $("holidayMessage").textContent = "Holiday added.";
    renderHolidays();
  });

  // Backup / restore
  $("exportBtn").addEventListener("click", () => {
    const data = {};
    Object.keys(localStorage)
      .filter((key) => key.startsWith("hcm_") && key !== "hcm_session")
      .forEach((key) => (data[key] = Storage.get(key)));

    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    a.download = "hcm-backup-" + Payroll.fmtDate(new Date()) + ".json";
    document.body.append(a);
    a.click();
    a.remove();
    $("backupMessage").textContent = "Backup downloaded.";
  });

  $("importFile").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);

        if (!data.hcm_company || !Array.isArray(data.hcm_users)) {
          throw new Error("not a backup");
        }
        if (!confirm("This will replace ALL current data. Continue?")) return;

        Object.keys(data)
          .filter((key) => key.startsWith("hcm_") && key !== "hcm_session")
          .forEach((key) => Storage.set(key, data[key]));

        $("backupMessage").textContent = "Backup restored. Reloading...";
        setTimeout(() => location.reload(), 800);
      } catch (error) {
        $("backupMessage").textContent = "Invalid backup file.";
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  });

  renderHolidays();
})();
