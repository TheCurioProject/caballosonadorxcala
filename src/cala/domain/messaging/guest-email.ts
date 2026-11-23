import { fillVariables, type MessageValues } from "./templates";

/** A link button under the message ("Cómo llegar", "Check-in en línea"…). */
export interface EmailButton {
  label: string;
  url: string;
}
export const MAX_BUTTONS = 3;
export const MAX_DOCUMENTS = 5;
/** Per file; Resend accepts up to 40 MB per e-mail. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "Word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.ms-powerpoint": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "text/plain": "Texto",
  "text/calendar": "Calendario",
  "image/jpeg": "Imagen",
  "image/png": "Imagen",
  "image/webp": "Imagen",
  "image/gif": "Imagen",
};
export const DOCUMENT_ACCEPT = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".ics",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
].join(",");

const BUTTON_URL = /^(https?:\/\/\S+|mailto:\S+|tel:\+?[0-9 ()-]{4,})$/i;
/** Same rule as the database (INVALID_BUTTONS). Variables are allowed in the URL. */
export function buttonProblem(b: EmailButton) {
  const label = b.label.trim(),
    url = b.url.trim();
  if (!label || label.length > 60) return "Escribe el texto del botón (máx. 60 caracteres).";
  if (!BUTTON_URL.test(url) || url.length > 2000)
    return "El enlace debe empezar por https://, mailto: o tel:";
  return "";
}

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Escaped text with clickable https links and line breaks. */
function richText(text: string) {
  return text
    .split(/(https?:\/\/[^\s<>"']+)/g)
    .map((part, i) => {
      if (i % 2 === 0) return escape(part);
      const trail = part.match(/[.,;:!?)]+$/)?.[0] ?? "";
      const url = trail ? part.slice(0, -trail.length) : part;
      return `<a href="${escape(url)}" style="color:#7a4b2a;text-decoration:underline">${escape(url)}</a>${escape(trail)}`;
    })
    .join("")
    .replace(/\n/g, "<br>");
}

const copy: Record<string, { attached: string; footer: string }> = {
  es: { attached: "Archivos adjuntos", footer: "Responde a este correo si necesitas algo." },
  en: { attached: "Attachments", footer: "Reply to this e-mail if you need anything." },
  fr: { attached: "Pièces jointes", footer: "Répondez à cet e-mail si vous avez besoin de quoi que ce soit." },
  de: { attached: "Anhänge", footer: "Antworte einfach auf diese E-Mail, wenn du etwas brauchst." },
  it: { attached: "Allegati", footer: "Rispondi a questa e-mail se hai bisogno di qualcosa." },
  pt: { attached: "Anexos", footer: "Responda a este e-mail se precisar de algo." },
};

export interface GuestEmailInput {
  subject: string;
  body: string;
  buttons: EmailButton[];
  attachments: { name: string; fileName: string }[];
  propertyName: string;
  locale: string;
  values: MessageValues;
}

/** Subject, HTML and plain text of a guest e-mail (preview and real send). */
export function buildGuestEmail(input: GuestEmailInput) {
  const t = copy[input.locale] ?? copy.en;
  const subject = fillVariables(input.subject, input.values).replace(/\s+/g, " ").trim() || input.propertyName;
  const body = fillVariables(input.body, input.values).trim();
  const buttons = input.buttons
    .filter((b) => !buttonProblem(b))
    .map((b) => ({
      label: fillVariables(b.label, input.values),
      url: fillVariables(b.url.trim(), input.values, encodeURIComponent),
    }));
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#2b2420">${richText(p)}</p>`)
    .join("");
  const buttonHtml = buttons
    .map(
      (b) =>
        `<tr><td style="padding:0 0 12px"><a href="${escape(b.url)}" style="display:inline-block;background:#7a4b2a;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;line-height:1.2;padding:13px 22px;border-radius:8px">${escape(b.label)}</a></td></tr>`,
    )
    .join("");
  const files = input.attachments.length
    ? `<p style="margin:8px 0 0;font-size:13px;color:#6b5f57"><strong>${escape(t.attached)}:</strong> ${input.attachments.map((a) => escape(a.fileName)).join(", ")}</p>`
    : "";
  const html = `<!doctype html><html lang="${escape(input.locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4efe9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:22px 28px;border-bottom:1px solid #eee4da;font-size:18px;font-weight:700;color:#2b2420">${escape(input.propertyName)}</td></tr>
<tr><td style="padding:28px 28px 12px">${paragraphs}
${buttonHtml ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">${buttonHtml}</table>` : ""}${files}</td></tr>
<tr><td style="padding:16px 28px 24px;font-size:12px;color:#8a7d73">${escape(t.footer)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    body,
    buttons.length ? buttons.map((b) => `${b.label}: ${b.url}`).join("\n") : "",
    input.attachments.length ? `${t.attached}: ${input.attachments.map((a) => a.fileName).join(", ")}` : "",
    `— ${input.propertyName}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { subject, html, text, buttons };
}
