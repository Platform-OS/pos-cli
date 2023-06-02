// purpose:		tries to parse the string as JSON
// arguments:	string or JSON object to check if can be parsed as JSON (string or object)
// returns:		JSON object if parseable or false if can't be parsed (object or false)
// ------------------------------------------------------------------------
const tryParseJSON = (argument) => {

  // first, check if passed argument is JSON and if so just return it
  if(argument && typeof argument === 'object'){
    return argument;
  }

  // if argument is a string, try to parse it as JSON
  try {
    const o = JSON.parse(argument);

    if(o && typeof o === 'object'){
      return o;
    }
  }
  // catch the error from parsing JSON but do nothing
  catch(e){};

  // if everything failed we can assumen the argument is not parsable JSON
  return false;

};



// exports
// ------------------------------------------------------------------------
export { tryParseJSON }
