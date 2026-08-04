import { prisma } from "@/lib/prisma";
import { createClient, updateClient, deleteClient } from "@/app/actions/crm";
import { IconSave, IconTrash, IconPlus } from "@/app/icons";

export default async function ClientsPanel() {
  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      owner: { select: { name: true } },
      _count: { select: { contacts: true, deals: true } },
    },
  });

  return (
    <div className="panel">
      <h2>Clients <span className="count">{clients.length}</span></h2>
      <p>Organisations you sell to. Contacts and deals hang off these.</p>

      <div className="fields">
        <div className="frow clrow chead">
          <span>Name</span><span>Industry</span><span>City</span>
          <span>Phone</span><span>Website</span><span /><span />
        </div>

        {clients.length === 0 ? (
          <p className="pvempty" style={{ padding: "12px 2px" }}>No clients yet — add the first below.</p>
        ) : (
          clients.map((c) => (
            <form className="frow clrow" action={updateClient} key={c.id}>
              <input type="hidden" name="clientId" value={c.id} />
              <input name="name" defaultValue={c.name} required />
              <input name="industry" defaultValue={c.industry ?? ""} placeholder="Industry" />
              <input name="city" defaultValue={c.city ?? ""} placeholder="City" />
              <input name="phone" defaultValue={c.phone ?? ""} placeholder="Phone" />
              <input name="website" defaultValue={c.website ?? ""} placeholder="website.com" />
              <span className="tree-meta nowrap">{c._count.contacts}c · {c._count.deals}d</span>
              <span className="rowacts">
                <button className="save icon" type="submit" title="Save" aria-label="Save"><IconSave /></button>
                <button className="reject icon" type="submit" title="Delete" aria-label="Delete"
                  formAction={deleteClient.bind(null, c.id)}><IconTrash /></button>
              </span>
            </form>
          ))
        )}

        <form className="frow clrow fadd" action={createClient}>
          <input name="name" placeholder="Client name" required />
          <input name="industry" placeholder="Industry" />
          <input name="city" placeholder="City" />
          <input name="phone" placeholder="Phone" />
          <input name="website" placeholder="website.com" />
          <span />
          <span className="rowacts">
            <button className="save icon" type="submit" title="Add client" aria-label="Add client"><IconPlus /></button>
          </span>
        </form>
      </div>
    </div>
  );
}
