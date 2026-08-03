import { prisma } from "@/lib/prisma";
import { createContact, deleteContact } from "../actions/crm";
import { IconTrash, IconPlus } from "../icons";

export default async function ContactsPanel() {
  const [contacts, clients] = await Promise.all([
    prisma.contact.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { client: { select: { name: true } } },
    }),
    prisma.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="panel">
      <h2>Contacts <span className="count">{contacts.length}</span></h2>
      <p>People at your clients. Mark one as primary per client.</p>

      {clients.length === 0 ? (
        <p style={{ marginTop: 14 }}>Add a client first — a contact has to belong to one.</p>
      ) : (
        <form action={createContact} className="inline-form dealadd">
          <select name="clientId" required defaultValue="">
            <option value="" disabled>Client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input name="firstName" placeholder="First name" required />
          <input name="lastName" placeholder="Last name" required />
          <input name="title" placeholder="Job title" />
          <input name="email" type="email" placeholder="Email" />
          <input name="mobile" placeholder="Mobile" />
          <label className="req"><input type="checkbox" name="isPrimary" /> Primary</label>
          <button type="submit" className="icon" title="Add contact" aria-label="Add contact"><IconPlus /></button>
        </form>
      )}

      {contacts.length > 0 && (
        <div className="tablewrap" style={{ marginTop: 16 }}>
          <table className="utable stacked">
            <thead>
              <tr><th>Name</th><th>Client</th><th>Title</th><th>Email</th><th>Mobile</th><th /></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td data-label="Name">
                    <b>{c.lastName}, {c.firstName}</b>
                    {c.isPrimary && <span className="you">primary</span>}
                  </td>
                  <td data-label="Client" className="muted">{c.client.name}</td>
                  <td data-label="Title" className="muted">{c.title ?? "—"}</td>
                  <td data-label="Email" className="muted">{c.email ?? "—"}</td>
                  <td data-label="Mobile" className="muted nowrap">{c.mobile ?? "—"}</td>
                  <td>
                    <form action={deleteContact.bind(null, c.id)}>
                      <button className="reject icon" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
