  const formatMMSS = s => (s - (s %= 60)) / 60 + (9 < s ? ':' : ':0') + s;
  const duration = (t0, t1) => {
    const duration = Math.round((t1 - t0) / 1000);
    return formatMMSS(duration);
  };

module.exports = duration;
