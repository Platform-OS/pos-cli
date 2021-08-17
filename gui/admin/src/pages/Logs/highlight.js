const highlight = (txt, search) => {
  if (!search) return txt;

  const text = txt.split(' ');

  for (let i = 0; i < text.length; i++) {
    let index = text[i];
    let splitIndex = index.split('');
    if (index.toLowerCase().includes(search.toLowerCase())) {
      for (let si = 0; si < index.length; si++) {
        if (search.toLowerCase().includes(index[si].toLowerCase())) {
          splitIndex[si] = `<mark>${index[si]}</mark>`;
          text[i] = splitIndex.join('');
        }
      }
    }
  }

  return text.join(' ');
};

export default highlight;
