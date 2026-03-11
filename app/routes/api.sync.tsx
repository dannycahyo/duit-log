import { data } from "react-router";
import type { Route } from "./+types/api.sync";
import { getAuth } from "@clerk/react-router/server";
import { createExpenseSchema } from "~/lib/validation";
import { appendExpense, getGoogleAccessToken } from "~/lib/sheets.server";
import { log } from "~/lib/logger.server";
import { getOrCreateUser, getUserConfig } from "~/lib/user.server";

export async function action(args: Route.ActionArgs) {
  const { userId: clerkUserId } = await getAuth(args);
  if (!clerkUserId) {
    return data({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateUser(clerkUserId, '');
  if (!user) {
    return data({ success: false, error: "User not found" }, { status: 401 });
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
  const accessToken = await getGoogleAccessToken(clerkUserId);

  const row = [
    body.createdAt ?? new Date().toISOString(),
    parsed.source,
    parsed.category,
    String(parsed.amount),
    parsed.method,
    parsed.date,
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
