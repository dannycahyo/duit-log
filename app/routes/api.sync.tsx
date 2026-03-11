import { data } from "react-router";
import type { Route } from "./+types/api.sync";
import { getAuth } from "@clerk/react-router/server";
import { createExpenseSchema } from "~/lib/validation";
import { appendExpense, getGoogleAccessToken } from "~/lib/sheets.server";
import { log } from "~/lib/logger.server";
import { getUserByClerkId, getUserConfig } from "~/lib/user.server";

export async function action(args: Route.ActionArgs) {
  const { userId: clerkUserId } = await getAuth(args);
  if (!clerkUserId) {
    return data({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserByClerkId(clerkUserId);
  if (!user) {
    return data({ success: false, error: "User not provisioned yet" }, { status: 409 });
  }
  const config = await getUserConfig(user.id);
  if (!config.spreadsheet) {
    return data({ success: false, error: "No spreadsheet configured" }, { status: 400 });
  }

  const body = await args.request.json();
  const schema = createExpenseSchema({
    sources: config.sources.map((s) => s.label),
    categories: config.categories.map((c) => c.label),
    methods: config.methods.map((m) => m.label),
  });

  const result = schema.safeParse(body);
  if (!result.success) {
    return data({ success: false, error: "Validation failed" }, { status: 400 });
  }

  const parsed = result.data;
  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(clerkUserId);
  } catch (err) {
    log("warn", "google_auth_failed", { error: (err as Error).message });
    return data(
      { success: false, error: "Google authorization required" },
      { status: 401 }
    );
  }

  // Use original submission time (createdAt) if available, otherwise use current time
  const createdAt = body.createdAt ? new Date(body.createdAt) : new Date();
  const jakartaDate = new Date(
    createdAt.toLocaleString("en-US", { timeZone: "Asia/Jakarta" })
  );
  const timestamp = `${jakartaDate.getMonth() + 1}/${jakartaDate.getDate()}/${jakartaDate.getFullYear()} ${String(jakartaDate.getHours()).padStart(2, "0")}:${String(jakartaDate.getMinutes()).padStart(2, "0")}:${String(jakartaDate.getSeconds()).padStart(2, "0")}`;

  const [year, month, day] = parsed.date.split("-");
  const formattedDate = `${Number(month)}/${Number(day)}/${year}`;

  const row = [
    timestamp,
    parsed.item,
    parsed.category,
    String(parsed.amount),
    parsed.method,
    formattedDate,
    parsed.source,
  ];

  try {
    await appendExpense(accessToken, config.spreadsheet.spreadsheetId, parsed.month, row);
    log("info", "offline_expense_synced", {
      source: parsed.source,
      category: parsed.category,
      amount: String(parsed.amount),
      month: parsed.month,
    });
    return data({ success: true });
  } catch (err) {
    log("error", "offline_sync_failed", { error: (err as Error).message });
    return data({ success: false, error: "Sheets API error" }, { status: 500 });
  }
}
