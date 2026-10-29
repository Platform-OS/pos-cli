/*
  the time range Logs v2 and Network search in

  the instance searches by _timestamp, which is in microseconds, so both ends are sent in
  microseconds; the day comes from the url as YYYY-MM-DD and is read as a day in the browser's
  own time zone, the one the date input showed

  (no imports, so it can be tested outside the app)
*/


// how many days before the chosen one the range starts (int)
const daysBack = 3;


// purpose:		turns the day chosen in the filters into the range to search
// arguments:	the day (string, YYYY-MM-DD)
// returns:		start_time and end_time in microseconds, both 0 when there is no valid day,
//				which searches without a limit (object)
// ------------------------------------------------------------------------
const timeRange = (day) => {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')){
    return { start_time: 0, end_time: 0 };
  }

  // a date and time without a zone is local time, while a date alone would be UTC midnight
  const end = new Date(`${day}T23:59:59.999`);

  if(isNaN(end)){
    return { start_time: 0, end_time: 0 };
  }

  // the same time of day, so the range is three whole days long
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);

  return {
    start_time: start.getTime() * 1000 + 999,
    end_time: end.getTime() * 1000 + 999
  };
};



// purpose:		names a day the way the filters and the date input do
// arguments:	a moment in that day (Date)
// returns:		the day in the browser's own time zone (string, YYYY-MM-DD)
//				(toISOString would name the day in UTC, which is a different one for part of
//				every day anywhere but UTC)
// ------------------------------------------------------------------------
const localDay = (date) => {
  const pad = (number) => String(number).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};



// exports
// ------------------------------------------------------------------------
export { timeRange, localDay };
