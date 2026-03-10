import { data, redirect } from "react-router";
import type { Route } from "./+types/api.sync";
import { getAuth } from "@clerk/react-router/server";
import { expenseSchema } from "~/lib/validation";
import { appendExpense, getAvailableMonths } from "~/lib/sheets.server";
import { log } from "~/lib/logger.server";

export async function action(args: Route.ActionArgs) {
  const { userId } = await getAuth(args);
  if (!userId) throw redirect("/");

  const body = await args.request.json();
  const result = expenseSchema.safeParse(body);

  if (!result.success) {
    return data({ success: false, error: "Validation failed" }, { status: 400 });
  }

  const parsed = result.data;

  const months = await getAvailableMonths();
  if (!months.includes(parsed.month)) {
    return data(
      { success: false, error: `Sheet tab '${parsed.month}' not found` },
      { status: 400 }
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
    await appendExpense(parsed.month, row);
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
