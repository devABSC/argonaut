import { prisma } from "./prisma";

/** Every system notification is sent through this template unless told otherwise. */
export const STANDARD_TEMPLATE = "Standard NoReply";

/**
 * The house style: the dark, high-contrast look of the app itself, rendered
 * with table layout and inline styles because that is all mail clients can be
 * trusted with. Outlook ignores background images and most modern CSS, so the
 * design leans on solid fills, borders and web-safe fallbacks.
 */
function shell(title: string, contentHtml: string, signature: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#06070B;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06070B;padding:32px 12px;">
<tr><td align="center">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0C0E15;border:1px solid #1D2130;border-radius:16px;overflow:hidden;">

    <!-- accent rule -->
    <tr><td style="height:3px;background:#38E8FF;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- header -->
    <tr><td style="padding:26px 30px 6px 30px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:30px;vertical-align:middle;">
          <div style="width:11px;height:11px;border-radius:50%;background:#38E8FF;"></div>
        </td>
        <td style="vertical-align:middle;font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                   font-size:19px;font-weight:700;letter-spacing:.4px;color:#E9EDF6;">Argonaut</td>
      </tr></table>
      <div style="margin-top:4px;font-family:'Courier New',monospace;font-size:10px;
                  letter-spacing:2.4px;text-transform:uppercase;color:#E9EDF6;">Business Made Easy</div>
    </td></tr>

    <!-- title -->
    <tr><td style="padding:18px 30px 0 30px;">
      <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:21px;
                  font-weight:600;color:#FFFFFF;line-height:1.3;">${title}</div>
    </td></tr>

    <!-- body -->
    <tr><td style="padding:14px 30px 26px 30px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                   font-size:15px;line-height:1.65;color:#C3CAD9;">
      ${contentHtml}
    </td></tr>

    <!-- signature -->
    ${signature ? `<tr><td style="padding:0 30px 26px 30px;border-top:1px solid #1D2130;">
      <div style="padding-top:18px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;
                  font-size:13px;line-height:1.6;color:#8B93A7;">${signature.replace(/\r\n?/g, "\n").replace(/\n/g, "<br>")}</div>
    </td></tr>` : ""}

    <!-- footer -->
    <tr><td style="padding:16px 30px;background:#080A11;border-top:1px solid #1D2130;
                   font-family:'Courier New',monospace;font-size:10px;letter-spacing:1.4px;
                   text-transform:uppercase;color:#4A5265;">
      Automated message · do not reply
    </td></tr>
  </table>

  <div style="max-width:600px;margin-top:14px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;
              font-size:11px;color:#3E4553;">Sent by Argonaut</div>

</td></tr></table>
</body></html>`;
}

/**
 * A one-time code marked `[[CODE:123456]]` becomes the focal point of the mail.
 * In plain text it collapses back to the bare digits.
 */
const CODE_RE = /^\[\[CODE:([^\]]+)\]\]$/;

export function stripMarkers(text: string): string {
  return text.replace(/\[\[CODE:([^\]]+)\]\]/g, "$1");
}

/** Plain text stays the source of truth; the HTML is a presentation of it. */
function toHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return text
    .split(/\n{2,}/)
    .map((para) => {
      const code = para.trim().match(CODE_RE);
      if (code) {
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;">
          <tr><td align="center" style="padding:20px 12px;background:#11141D;border:1px solid #223047;
                     border-radius:12px;">
            <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:2.4px;
                        text-transform:uppercase;color:#5A6274;padding-bottom:10px;">Your code</div>
            <div style="font-family:'Courier New',monospace;font-size:34px;font-weight:700;
                        letter-spacing:10px;color:#38E8FF;text-indent:10px;">${esc(code[1])}</div>
          </td></tr></table>`;
      }

      const lines = para.split("\n").map(esc);
      // "Label: value" runs read better as a bordered block than as prose.
      const isDetails = lines.length > 1 && lines.every((l) => /^[A-Za-z][\w ']{0,20}:\s/.test(l));
      if (isDetails) {
        const rows = lines.map((l) => {
          const [, k, v] = l.match(/^([^:]+):\s*(.*)$/) ?? [, l, ""];
          return `<tr>
            <td style="padding:3px 14px 3px 0;color:#5A6274;font-size:12px;
                       text-transform:uppercase;letter-spacing:1px;white-space:nowrap;">${k}</td>
            <td style="padding:3px 0;color:#E9EDF6;font-weight:600;">${v}</td></tr>`;
        }).join("");
        return `<table role="presentation" cellpadding="0" cellspacing="0"
                 style="margin:16px 0;padding:14px 16px;background:#11141D;border-left:2px solid #38E8FF;
                        border-radius:8px;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;">
                 ${rows}</table>`;
      }
      return `<p style="margin:0 0 14px 0;">${lines.join("<br>")}</p>`;
    })
    .join("");
}

export type Rendered = { text: string; html: string };

/**
 * Wraps a notice in the standard template. A template body containing
 * {{content}} has the notice substituted there; otherwise the signature is
 * simply appended. A missing template still sends — losing a notification is
 * worse than losing its styling.
 */
export async function renderStandard(
  subject: string,
  body: string,
  templateName?: string,
): Promise<Rendered> {
  const tpl = await prisma.emailTemplate
    .findUnique({ where: { name: templateName || STANDARD_TEMPLATE } })
    .catch(() => null);

  const merged = tpl?.body?.includes("{{content}}")
    ? tpl.body.replace("{{content}}", body)
    : body;

  const signature = tpl?.signature ?? "";
  const plain = stripMarkers(merged);
  const text = signature ? `${plain}\n\n${signature.replace(/\r\n?/g, "\n")}` : plain;

  return { text, html: shell(subject, toHtml(merged), signature) };
}
