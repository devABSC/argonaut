import { prisma } from "@/lib/prisma";

/**
 * The soft-launch feature for Argonaut, written as a piece rather than a
 * marketing block — and grounded, so the numbers in it are read from the
 * running system instead of asserted.
 *
 * Deliberately published under Argonaut's own masthead. A real newsroom's name
 * on something they did not write would be a forgery, however flattering.
 */
export default async function LaunchArticle() {
  const [staff, projects, candidates, tickets, logs, statements, forms] = await Promise.all([
    prisma.employee.count({ where: { status: 0 } }),
    prisma.project.count(),
    prisma.candidate.count(),
    prisma.serviceRequest.count(),
    prisma.logHistory.count(),
    prisma.soaLine.count(),
    prisma.birForm.count(),
  ]);

  const stats = [
    { n: staff.toLocaleString(), label: "active employees on record" },
    { n: logs.toLocaleString(), label: "audited transactions" },
    { n: projects.toLocaleString(), label: "projects being run" },
    { n: candidates.toLocaleString(), label: "candidates in the pipeline" },
  ];

  return (
    <article className="feature">
      <header className="feature-head">
        <div className="masthead">
          <span className="dot" />
          <span>ARGONAUT</span>
          <span className="sep">·</span>
          <span className="kicker">Soft launch</span>
        </div>

        <h1>
          The back office finally stopped being a filing cabinet.
        </h1>

        <p className="standfirst">
          One platform now runs the people, the money, the work and the hiring at
          ATOMIT Business Solutions — and it was built, end to end, by a company
          of one working alongside an AI.
        </p>

        <div className="byline">
          <span>By the Argonaut team</span>
          <span className="sep">·</span>
          <span>Makati City</span>
          <span className="sep">·</span>
          <span>August 2026</span>
        </div>
      </header>

      <div className="feature-body">
        <p className="lede">
          Every growing company reaches the same morning. Payroll is in one
          spreadsheet, the org chart in another, last quarter&rsquo;s receipts in
          a shoebox, and the one person who knows where everything lives has just
          gone on leave. The work has outgrown the tools, and nobody noticed
          until it hurt.
        </p>

        <p>
          Argonaut is the answer ATOMIT built for itself. It is an enterprise
          platform that holds an entire back office in one place: a human
          resource information system, a service desk with real approval routes,
          finance with statements and statutory filings, project management,
          inventory, and an applicant tracking system that reads a CV and tells
          you what it found.
        </p>

        <div className="statrow">
          {stats.map((s) => (
            <div key={s.label} className="stat">
              <b>{s.n}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <h2>Not a chatbot bolted to a form</h2>

        <p>
          The phrase &ldquo;AI-powered&rdquo; has been worn thin by products that
          added a chat box and called it a strategy. Argonaut takes a narrower and
          more useful position: put the intelligence where the tedium is.
        </p>

        <p>
          Upload a candidate&rsquo;s CV and the system reads it — every post, every
          date, the skills claimed and the gaps between roles — and files it as
          structured history rather than an attachment nobody opens twice. Ask it
          for an assessment and it produces one, with the run recorded, the cost
          shown to the owner alone, and the reasoning kept beside the record.
          Scanned CVs go through optical character recognition first, locally, so
          a photograph of a résumé is as readable as a Word file.
        </p>

        <p className="pull">
          &ldquo;The intelligence belongs where the tedium is — not in a chat box
          on the corner of the screen.&rdquo;
        </p>

        <h2>Built on the assumption that people make mistakes</h2>

        <p>
          What distinguishes Argonaut is less visible than the AI, and matters
          more. Every write confirms itself on screen. Every change to a project
          keeps what the value was, what it became, who changed it and when —
          written in the same transaction as the change, so a saved edit cannot
          exist without its trail.
        </p>

        <p>
          A milestone carrying tasks cannot be deleted. A task can only be
          removed by the person who raised it, unless the owner overrides. A
          statement with movements on it is a record, not a draft. A supplier
          registered under one company cannot appear on another&rsquo;s
          certificate. None of these are warnings; they are refusals, enforced on
          the server, where a hidden button cannot be the whole defence.
        </p>

        <h2>Honest about what it cannot do</h2>

        <p>
          Argonaut will not claim to file your statutory contributions for you.
          Research into the three Philippine agencies found what anyone
          integrating with them eventually discovers: none of them publish an API.
          So the platform does the part that is real — it prepares the member
          rosters and remittance files, keyed on the right identifier, and hands
          them to the person who uploads them. It does not automate a login
          against a government portal, and it says so on the page.
        </p>

        <p>
          The same restraint runs through the product. Where a figure is not
          known, the column is left blank rather than guessed. Where an email
          could not be sent, the screen says so instead of showing a tick.
        </p>

        <h2>What it costs to build a platform now</h2>

        <p>
          Argonaut is perhaps the most interesting artefact of its own making. An
          enterprise suite of this breadth would once have meant a team, a year,
          and a budget with a comma in it. This one was specified in plain
          sentences — often typed one-handed, often at midnight — and built
          conversationally, feature by feature, with the person who needed it
          reviewing each one as it landed.
        </p>

        <p>
          That is the quiet story under the launch. Not that software can write
          itself, because it cannot. But that the distance between
          &ldquo;we need a system that does this&rdquo; and a system that does it
          has collapsed from quarters to hours — for anyone willing to say
          precisely what they want and check the result.
        </p>

        <div className="closing">
          <p>
            Argonaut is live at <b>argonaut.znergee.com</b>, running{" "}
            {statements.toLocaleString()} statement lines, {tickets.toLocaleString()} service
            requests and {forms.toLocaleString()} registered BIR forms for its
            first customer — the company that built it.
          </p>
        </div>
      </div>
    </article>
  );
}
