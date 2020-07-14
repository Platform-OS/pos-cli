import { format } from 'date-fns';

export default function(datetime) {
  const dt = new Date(datetime);
  return format(dt, 'dd MMM yyyy, HH:mm:ss');
}