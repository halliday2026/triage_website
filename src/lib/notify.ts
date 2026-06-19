import { Resend } from "resend";

interface TicketData {
  id: string;
  title?: string | null;
  body: string;
  type: string;
  severity: string;
  reporter_email?: string | null;
  reporter_user_id?: string | null;
}

interface ProductData {
  client_id: string;
  product_id: string;
  support_email?: string | null;
}

function buildSubject(ticket: TicketData): string {
  const label = ticket.title || ticket.body.slice(0, 60);
  switch (ticket.severity) {
    case "critical":
      return `[CRITICAL] New incident: ${label}`;
    case "high":
      return `[HIGH] New ticket: ${label}`;
    default:
      return `New ticket: ${label}`;
  }
}

function buildBody(ticket: TicketData, product: ProductData): string {
  const reporter = ticket.reporter_email || ticket.reporter_user_id || "Unknown";
  return [
    `Ticket ID: ${ticket.id}`,
    `Product:   ${product.client_id}/${product.product_id}`,
    `Type:      ${ticket.type}`,
    `Severity:  ${ticket.severity}`,
    `Reporter:  ${reporter}`,
    "",
    ticket.title ? `Title: ${ticket.title}` : null,
    "",
    ticket.body,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function notifyNewTicket(
  ticket: TicketData,
  product: ProductData
): Promise<void> {
  if (!product.support_email) return;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error("Resend not configured: missing RESEND_API_KEY or RESEND_FROM_EMAIL");
    return;
  }

  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from,
      to: product.support_email,
      subject: buildSubject(ticket),
      text: buildBody(ticket, product),
    });
  } catch (err) {
    console.error("Failed to send new-ticket notification:", err);
  }
}
