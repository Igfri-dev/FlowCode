const deadlinePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function normalizeSubmissionDeadlineInput(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const match = deadlinePattern.exec(trimmedValue);

  if (!match) {
    throw new Error("The submission deadline is invalid.");
  }

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const deadline = new Date(year, month - 1, day, hour, minute);

  if (
    deadline.getFullYear() !== year ||
    deadline.getMonth() !== month - 1 ||
    deadline.getDate() !== day ||
    deadline.getHours() !== hour ||
    deadline.getMinutes() !== minute
  ) {
    throw new Error("The submission deadline is invalid.");
  }

  return `${yearText}-${monthText}-${dayText} ${hourText}:${minuteText}:00`;
}
