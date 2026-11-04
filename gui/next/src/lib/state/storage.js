/*
  reads a value kept in localStorage, falling back when it is missing, unreadable or not JSON

  localStorage throws in a private window and when site data is blocked, and a value written by
  an older version may not parse; neither should stop the app from starting
*/


// imports
// ------------------------------------------------------------------------
import { browser } from '$app/environment';


// purpose:		reads a localStorage key
// arguments:	key name (string)
//				value to use when there is nothing usable stored (any)
//				if the stored value is JSON (bool)
// returns:		the stored value or the fallback (any)
// ------------------------------------------------------------------------
const stored = (key, fallback, json = true) => {
  if(!browser){
    return fallback;
  }

  try {
    const value = localStorage.getItem(key);

    if(value === null){
      return fallback;
    }

    return json ? JSON.parse(value) : value;
  } catch {
    return fallback;
  }
};



// exports
// ------------------------------------------------------------------------
export { stored };
