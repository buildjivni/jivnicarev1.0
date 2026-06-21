function getETARangeString(patientsAhead: number): string {
  if (patientsAhead === 0) {
    return "Ready (Please proceed to the clinic)";
  }
  
  const now = new Date();
  const minWait = patientsAhead * 8 - 5;
  const maxWait = patientsAhead * 8 + 15;
  
  const startMinutes = Math.max(5, minWait);
  const endMinutes = Math.max(20, maxWait);
  
  const startTime = new Date(now.getTime() + startMinutes * 60 * 1000);
  const endTime = new Date(now.getTime() + endMinutes * 60 * 1000);
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  };
  
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

export { getETARangeString };
