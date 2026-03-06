import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      style={{ "--rdp-day-height": "36px", "--rdp-day-width": "36px" } as React.CSSProperties}
      classNames={{
        root: "p-3",
        month_caption: "flex justify-center items-center h-8 font-semibold text-sm text-slate-900",
        nav: "flex items-center gap-1",
        button_previous: "absolute left-1 -top-1 size-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100",
        button_next: "absolute right-1 -top-1 size-8 inline-flex items-center justify-center rounded-md hover:bg-slate-100",
        weekdays: "flex",
        weekday: "w-9 text-xs font-medium text-slate-700 text-center",
        week: "flex mt-1",
        day: "w-9 h-9 text-center text-sm text-slate-800",
        day_button: "w-full h-full flex items-center justify-center rounded-md hover:bg-slate-100 cursor-pointer",
        selected: "bg-slate-900 text-white rounded-md hover:bg-slate-800",
        today: "font-bold text-slate-900",
        outside: "text-slate-400 opacity-50",
        disabled: "text-slate-300 pointer-events-none",
      }}
      {...props}
    />
  );
}
