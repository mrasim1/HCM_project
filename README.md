# HCM Lite — Human Capital Management System

A lightweight, browser-based HR system for small companies. It handles employees, attendance (check-in / check-out), leave requests, salary slips, payroll reports and company settings. It is built with plain HTML, CSS and JavaScript, with no framework and no backend. All data is stored in the browser's `localStorage`.

---

## Features

### Admin
- **Dashboard:** total employees, checked in today, late today, on leave today.
- **Employee management:** add, edit, delete and search employees.
- **Payment details per employee:** bank account transfer (bank name and account number) or cheque collection from the company.
- **Leave management:** approve or reject requests with an optional comment.
- **Reports:**
  - Payroll report for any month, with totals, CSV download, printable slips and a *Mark paid / Undo paid* button.
  - Daily attendance report with CSV download.
- **Settings:** company name, office start time, grace minutes, yearly leave quota, working days, late-deduction rule, holidays.
- **Backup and restore:** download all data as a JSON file and restore it later.
- **Smart Helper:** answers simple questions such as "how many employees?", "who is late?", "who is on leave today?".

### Employee
- **Check in / check out** with automatic *present*, *late* and *half day* status.
- **Attendance history.**
- **Leave application** with a live remaining-balance display and a list of own requests.
- **Salary slip** for any month, printable or saveable as PDF.
- **Smart Helper:** "Was I late today?", "How many hours this week?".

### Both roles
- Change password.
- Login protection: opening a protected page without logging in, or with the wrong role, redirects to the login page. A logged-in user opening the login page is sent straight to their dashboard.
- Responsive layout for mobile, tablet and desktop.

---

## Colour theme

Black, white and gray, with status colours:

| Meaning | Colour |
|---|---|
| Check in / present / approve | Light green |
| Check out / absent / reject | Light red |
| Leave / pending | Light orange |
| Late | Light yellow |

---

## Project structure

```
HCM_fixed/
├── index.html        Login and first-time company setup
├── admin.html        Admin dashboard (employees, helper, password)
├── leaves.html       Admin leave review
├── reports.html      Payroll and attendance reports
├── settings.html     Company settings, holidays, backup/restore
├── employee.html     Employee portal (attendance, leave, salary slip)
├── css/
│   └── style.css     Theme, responsive layout, print styles
└── js/
    ├── storage.js    localStorage wrapper (Storage) and password hashing (Auth)
    ├── app.js        Login, first-time setup, auto-redirect
    ├── nav.js        Top navigation bar (role-based links, logout)
    ├── dashboard.js  Session guard (requireRole) and admin dashboard logic
    ├── employee.js   Employee check-in / check-out and helper
    ├── leave.js      Leave application (employee) and review (admin)
    ├── payroll.js    Shared salary calculation and salary slip rendering
    ├── salary.js     Employee salary slip page logic
    ├── reports.js    Admin payroll and attendance reports
    ├── settings.js   Settings, holidays, backup/restore
    └── password.js   Change-password form
```

---

## How to run

Run the project through a local web server rather than double-clicking the HTML files. Browsers can treat `localStorage` differently for `file://` pages, which can cause data to appear and disappear between pages.

```bash
cd HCM_fixed
python -m http.server 8000
```

Then open **http://localhost:8000** in your browser. (VS Code users can use the *Live Server* extension instead.)

---

## First-time use

1. Open the app. You will see **First-time Company Setup**.
2. Enter the company name, your name, email and a password (minimum 6 characters), then click **Create Company**.
3. Log in with the same email and password. You land on the admin dashboard.
4. Go to **Settings** and set office time, grace minutes, leave quota, working days and holidays.
5. On the dashboard, use **Add Employee**. Give each employee an email, password, department, salary and payment method.
6. Employees log in at the same login page and are taken to their portal.

To test the employee portal, log out of the admin account, then log in with an employee's email and password.

---

## Business rules

### Attendance
- **Late:** check-in after *office start time + grace minutes*.
- **Half day:** checking out after fewer than 5 hours of work.
- One attendance record per employee per day.

### Leave
- Leave is counted in **working days** only. Non-working days and holidays are skipped.
- Past dates cannot be requested, and overlapping requests are blocked.
- Pending and approved days both count against the quota. The remaining balance shown to the employee uses the same rule.
- The admin cannot approve a request that would exceed the quota or overlap another leave.

### Salary
For a selected month:

```
Per-day rate    = monthly salary ÷ working days in that month
Net salary      = monthly salary − deductions
```

| Day type | Effect on salary |
|---|---|
| Present | Full pay |
| Late | Full pay (see late rule below) |
| Half day (checked out under 5 hours) | Half a day deducted |
| Checked in but never checked out (past day) | Half a day deducted |
| Approved leave | Paid, no deduction |
| No check-in and no leave | Full day deducted |
| Before the employee's joining date | Deducted (unpaid) |
| Holidays and non-working days | Not counted |
| Future days of the current month | Counted as paid until attendance is recorded |

**Late rule (optional, in Settings):** every *N* late days deduct one day's pay. Set it to 0 to turn it off.

### Salary slip and payment
- The slip shows company name, employee details, earnings, deductions, attendance summary, net salary, payment details and signature lines.
- **Bank transfer:** the slip shows the bank name and account number.
- **Cheque collection:** the slip tells the employee to collect the cheque from the company accounts office and has a "Received by" signature line.
- Status shows **PENDING** until the admin clicks *Mark paid* in Reports, after which it shows **PAID on [date]**.
- Printing from the browser prints only the slip.

---

## Data storage

Everything is saved in the browser under these `localStorage` keys:

| Key | Contents |
|---|---|
| `hcm_company` | Company settings |
| `hcm_users` | Admin and employees (passwords stored as hashes) |
| `hcm_attendance` | Check-in / check-out records |
| `hcm_leaves` | Leave requests |
| `hcm_holidays` | Holiday list |
| `hcm_payments` | Paid records per employee per month |
| `hcm_session` | Currently logged-in user (not included in backups) |

Because data lives in one browser on one device, **download a backup regularly** from *Settings → Backup & Restore*. Clearing browser data erases the system.

---

## Security notes

- Passwords are stored as SHA-256 hashes. Older plain-text passwords are upgraded automatically on first login.
- This protects against casually reading passwords, but the project is **client-side only**. Anyone with access to the browser can read or edit `localStorage`. It is suitable for demos, learning and very small internal use. For real deployment, add a backend with a database, server-side authentication, and proper password hashing with per-user salts.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Redirected to login again and again | You are not logged in, or opened a page for the wrong role. Log in with the correct account. |
| Data is missing on another page | Open the app through a local server (`http://localhost`), not `file://`. |
| Forgot admin password | Restore a backup, or clear the site's data in the browser and run first-time setup again. |
| A new employee's salary looks low | Days before the joining date are treated as unpaid. Check a later month, or see the "Before joining" line on the slip. |
| Slip shows too many absents | The employee did not check in on those working days, and had no approved leave. Check the Daily Attendance report. |

---

## Possible future improvements

- Backend and database with real authentication
- Employee self-service for bank details
- Overtime and bonus lines on the salary slip
- Email delivery of salary slips
