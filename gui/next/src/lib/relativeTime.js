/*
  shows dates as relative from current

  usage: relativeTime(date) or relativeTime(date, now), where passing the current time
  (milliseconds) lets a template that keeps it in state show the date again as time passes
*/



const relativeTime = (input, now = Date.now()) => {

  const date = (input instanceof Date) ? input : new Date(input);
  const formatter = new Intl.RelativeTimeFormat('en');
  const ranges = {
    years: 3600 * 24 * 365,
    months: 3600 * 24 * 30,
    weeks: 3600 * 24 * 7,
    days: 3600 * 24,
    hours: 3600,
    minutes: 60,
    seconds: 1
  };
  const secondsElapsed = (date.getTime() - now) / 1000;

  for (let key in ranges) {
    if (ranges[key] < Math.abs(secondsElapsed)) {
      const delta = secondsElapsed / ranges[key];
      return formatter.format(Math.round(delta), key);
    }
  }

};



export { relativeTime };
