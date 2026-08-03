import { prisma } from "@/lib/prisma";
import { moveDealFromForm, createDeal, deleteDeal } from "../actions/crm";
import { STAGES, STAGE_LABEL } from "@/lib/crm";
import { IconPlus, IconTrash } from "../icons";

const peso = (n: unknown) =>
  n == null ? null : `₱${Number(n).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;

/**
 * Deals as a stage board. Each card carries a stage selector rather than drag
 * and drop, so it works on a phone and without JavaScript — the move is a
 * plain server action.
 */
export default async function PipelineBoard() {
  const [deals, clients] = await Promise.all([
    prisma.deal.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { client: { select: { name: true } }, owner: { select: { name: true } } },
    }),
    prisma.client.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const open = deals.filter((d) => d.stage !== "WON" && d.stage !== "LOST");
  const weighted = open.reduce((sum, d) => sum + Number(d.amount ?? 0), 0);
  const won = deals.filter((d) => d.stage === "WON").reduce((s, d) => s + Number(d.amount ?? 0), 0);

  return (
    <>
      <div className="panel">
        <div className="cat-head">
          <h2>Pipeline <span className="count">{deals.length} deals</span></h2>
          <span className="spacer" />
          <span className="kpi"><b>{peso(weighted) ?? "₱0"}</b><span>open</span></span>
          <span className="kpi won"><b>{peso(won) ?? "₱0"}</b><span>won</span></span>
        </div>

        {clients.length === 0 ? (
          <p style={{ marginTop: 14 }}>Add a client first — a deal has to belong to one.</p>
        ) : (
          <form action={createDeal} className="inline-form dealadd">
            <select name="clientId" required defaultValue="">
              <option value="" disabled>Client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input name="title" placeholder="Deal — e.g. Payroll system, 200 seats" required />
            <input name="amount" inputMode="decimal" placeholder="Amount" />
            <input name="expectedCloseDate" type="date" />
            <button type="submit" className="icon" title="Add deal" aria-label="Add deal"><IconPlus /></button>
          </form>
        )}
      </div>

      <div className="board">
        {STAGES.map((stage) => {
          const col = deals.filter((d) => d.stage === stage);
          const total = col.reduce((s, d) => s + Number(d.amount ?? 0), 0);
          return (
            <section className={`col stage-${stage}`} key={stage}>
              <header>
                <b>{STAGE_LABEL[stage]}</b>
                <span className="colcount">{col.length}</span>
                {total > 0 && <span className="coltotal">{peso(total)}</span>}
              </header>

              <div className="cards">
                {col.length === 0 && <p className="colempty">—</p>}
                {col.map((d) => (
                  <article className="deal" key={d.id}>
                    <h4>{d.title}</h4>
                    <p className="dealclient">{d.client.name}</p>
                    <div className="dealmeta">
                      {d.amount != null && <span className="amt">{peso(d.amount)}</span>}
                      {d.expectedCloseDate && (
                        <span className="due">{d.expectedCloseDate.toISOString().slice(0, 10)}</span>
                      )}
                    </div>
                    {d.owner && <p className="dealowner">{d.owner.name}</p>}

                    <div className="dealacts">
                      <form action={moveDealFromForm}>
                        <input type="hidden" name="dealId" value={d.id} />
                        <select name="stage" defaultValue={d.stage} aria-label="Move to stage">
                          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                        </select>
                        <button type="submit" className="move">Move</button>
                      </form>
                      <form action={deleteDeal.bind(null, d.id)}>
                        <button className="reject icon sm" type="submit" title="Delete" aria-label="Delete"><IconTrash /></button>
                      </form>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
