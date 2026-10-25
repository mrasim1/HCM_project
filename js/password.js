(() => {
  const form = document.getElementById("passwordForm");
  if (!form) return;

  const msg = document.getElementById("passwordMessage");
  const session = Storage.get("hcm_session");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const users = Storage.get("hcm_users", []);
    const user = session && users.find((u) => u.id === session.userId);

    const current = document.getElementById("curPass").value;
    const next = document.getElementById("newPass").value;
    const again = document.getElementById("newPass2").value;

    if (!user || !Auth.verify(user, current)) {
      msg.textContent = "Current password is incorrect.";
      return;
    }
    if (next.length < 6) {
      msg.textContent = "New password must be at least 6 characters.";
      return;
    }
    if (next !== again) {
      msg.textContent = "New passwords do not match.";
      return;
    }

    Auth.setPassword(user, next);
    Storage.set("hcm_users", users);
    form.reset();
    msg.textContent = "Password changed successfully.";
  });
})();
