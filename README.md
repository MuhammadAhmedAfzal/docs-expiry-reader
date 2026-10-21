# DocTrack: document expiry tracker

Built by **Muhammad Ahmed Afzal**.

React and Node.js (Express and MongoDB) app for storing documents and images with their expiry dates. It shows what is expiring soon and what has already expired, with role-based access, tasks, bulk CSV import, notifications and version history.

## Quick start

```bash
npm run install:all          # installs root, server and client dependencies
cp server/.env.example server/.env   # then edit MONGO_URI / JWT_SECRET

npm run dev                  # API on :5000 + React on http://localhost:5173
npm run dev:memory           # same, but with a throwaway in-memory MongoDB (no install needed)
```

On first start, if the database has no users, an admin account is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (default `admin@example.com` / `Admin@123`). Change that password after you sign in.

Production: run `npm run build`, then `npm start`. The API serves the built React app on the same port.

## Features

| Feature | How it works |
|---|---|
| **Roles** | **Admin** can do everything. **Worker** sees and edits only the documents assigned to them, and adds new documents by default. |
| **Permissions** | An admin can give workers any of these: view all, edit all, add documents, bulk import, and manage tasks/assign. **Only admins can delete.** |
| **Expiry status** | Worked out from the expiry date: `valid`, `expiring_soon` (within `EXPIRY_WARNING_DAYS`, default 30), `expired` or `no_expiry`. It is updated every time a document is saved and once an hour. |
| **Workflow status** | `new`, `in_progress` or `completed`. Admins and assigned workers can change it from the list or the detail page. |
| **Notifications** | One alert per expiring or expired document. It **stays active until the document is renewed** (new expiry date, usually with a new file). After that it moves to *Resolved*. |
| **Version history** | Every update saves the previous details and file as an old version. The detail page shows a timeline of changes (old → new) and a side-by-side **Compare** with file previews. |
| **Tasks** | Admins (or workers with *manage tasks*) assign tasks. Linking a document gives the worker access to it. |
| **Bulk import** | Upload a CSV, check each row for errors, then import the valid rows. Download the template from the Bulk import page. |

### CSV columns

`title` (required), `documentNumber`, `category`, `issueDate`, `expiryDate`, `description`, `assignedTo` (emails separated by `;`), `workflowStatus` (`new` / `in_progress` / `completed`).
Dates can be `YYYY-MM-DD` or `DD/MM/YYYY`. Header names are matched loosely, so `Expiry Date` and `expiry_date` also work.

## Structure

```
server/src
  models/      User, Document, DocumentVersion, Task, Notification
  routes/      auth, users, documents, import, tasks, notifications, dashboard
  services/    documents.js (update + version history), notifications.js (expiry sync + hourly scheduler)
  utils/       permissions.js (role/permission checks), expiry.js (date maths)
client/src
  pages/       Dashboard, Documents, DocumentDetail, DocumentForm, BulkImport, Notifications, Tasks, Users
  components/  Layout, FilePreview, status badges
```

Uploaded files are stored in `server/uploads/`. Files from old versions are kept so you can still view them in the history.

## Tech stack

React 18, React Router, Vite, Axios · Node.js, Express, MongoDB, Mongoose · JWT authentication, bcrypt, Multer, csv-parse

## Author

**Muhammad Ahmed Afzal**
