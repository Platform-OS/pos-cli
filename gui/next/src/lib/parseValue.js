// imports
// ------------------------------------------------------------------------
import { tryParseJSON } from '$lib/tryParseJSON.js';



// purpose:		parses the value to present it in the most adequate way
//				(strings can be strings, JSONs or escaped JSONs)
// arguments:	value to parse (any)
//				type of the value (string)
// ------------------------------------------------------------------------
const parseValue = (value, type) => {
  debugger
  let parsed = {
    value: value,
    type: type
  };

  if(value === null || value === undefined){
    parsed.value = null;
    parsed.type = 'null';
    return {...parsed};
  }

  if(type === 'boolean'){
    if(value === true){
      parsed.value = 'true';
    } else {
      parsed.value = 'false';
    }
  }

  if(typeof value === 'object'){
    parsed.value = value;
    parsed.type = 'json';
    return {...parsed};
  }

  if(tryParseJSON(value)){
    parsed.value = tryParseJSON(value);
    parsed.type = 'jsonEscaped';
    return {...parsed};
  }

  return {...parsed, original: { value, type }};
};



// exports
// ------------------------------------------------------------------------
export { parseValue };
