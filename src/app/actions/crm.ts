"use server";

import { revalidatePath } from "next/cache";
import type { DealStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { STAGES } from "@/lib/crm";

const PATH = "/crm";

async function me() {
  const u = await requireUser();
  return u;
}

const refresh = () => {
  revalidatePath(`${PATH}/pipeline`);
  revalidatePath(`${PATH}/clients`);
  revalidatePath(`${PATH}/contacts`);
};

/* ------------------------------------------------------------- clients --- */

export async function createClient(formData: FormData) {
  const u = await me();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.client.create({
    data: {
      name,
      industry: String(formData.get("industry") ?? "").trim() || null,
      website: String(formData.get("website") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
      ownerId: u.id,
    },
  });
  refresh();
}

export async function updateClient(formData: FormData) {
  await me();
  const id = String(formData.get("clientId") ?? "");
  if (!id) return;
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) return;

  await prisma.client.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim() || existing.name,
      industry: String(formData.get("industry") ?? "").trim() || null,
      website: String(formData.get("website") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      city: String(formData.get("city") ?? "").trim() || null,
    },
  });
  refresh();
}

export async function deleteClient(clientId: string) {
  await me();
  await prisma.client.delete({ where: { id: clientId } });
  refresh();
}

/* ------------------------------------------------------------ contacts --- */

export async function createContact(formData: FormData) {
  await me();
  const clientId = String(formData.get("clientId") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  if (!clientId || !firstName || !lastName) return;

  await prisma.contact.create({
    data: {
      clientId, firstName, lastName,
      title: String(formData.get("title") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
      mobile: String(formData.get("mobile") ?? "").trim() || null,
      isPrimary: formData.get("isPrimary") === "on",
    },
  });
  refresh();
}

export async function deleteContact(contactId: string) {
  await me();
  await prisma.contact.delete({ where: { id: contactId } });
  refresh();
}

/* --------------------------------------------------------------- deals --- */

export async function createDeal(formData: FormData) {
  const u = await me();
  const clientId = String(formData.get("clientId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!clientId || !title) return;

  const amountRaw = String(formData.get("amount") ?? "").replace(/,/g, "").trim();
  const closeRaw = String(formData.get("expectedCloseDate") ?? "").trim();

  await prisma.deal.create({
    data: {
      clientId, title,
      amount: amountRaw ? amountRaw : null,
      expectedCloseDate: closeRaw ? new Date(closeRaw) : null,
      stage: "NEW",
      ownerId: u.id,
    },
  });
  refresh();
}

/** Moves a deal to another stage. Won and Lost stamp a close date. */
export async function setDealStage(dealId: string, stage: DealStage) {
  await me();
  const closed = stage === "WON" || stage === "LOST";
  await prisma.deal.update({
    where: { id: dealId },
    data: { stage, closedAt: closed ? new Date() : null },
  });
  refresh();
}

export async function moveDealFromForm(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  const stage = String(formData.get("stage") ?? "") as DealStage;
  if (!dealId || !STAGES.includes(stage)) return;
  await setDealStage(dealId, stage);
}

export async function deleteDeal(dealId: string) {
  await me();
  await prisma.deal.delete({ where: { id: dealId } });
  refresh();
}
