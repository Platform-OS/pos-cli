import { I as writable, S as SvelteComponent, i as init, s as safe_not_equal, e as element, t as text, b as space, c as claim_element, d as children, f as claim_text, g as detach, h as claim_space, j as attr, k as insert, a as append, q as set_data, n as noop, P as createEventDispatcher, p as listen, Q as prevent_default, z as transition_in, D as create_component, E as claim_component, F as mount_component, R as add_flush_callback, A as transition_out, H as destroy_component, v as group_outros, y as check_outros, T as add_render_callback, U as create_in_transition, r as create_out_transition, V as destroy_each, W as run_all, L as empty, X as binding_callbacks, Y as bind, Z as select_option, _ as select_value, l as component_subscribe, O as get_store_value, $ as toggle_class, a0 as create_bidirectional_transition, w as update_keyed_each, a1 as onMount, x as outro_and_destroy_block, a2 as params } from './main2.js';
import { a as api, s as success, f as filtersStore, i as info, p as pageStore } from './api.js';
import './store.js';

function cubicOut(t) {
    const f = t - 1.0;
    return f * f * f + 1.0;
}

function slide(node, { delay = 0, duration = 400, easing = cubicOut }) {
    const style = getComputedStyle(node);
    const opacity = +style.opacity;
    const height = parseFloat(style.height);
    const padding_top = parseFloat(style.paddingTop);
    const padding_bottom = parseFloat(style.paddingBottom);
    const margin_top = parseFloat(style.marginTop);
    const margin_bottom = parseFloat(style.marginBottom);
    const border_top_width = parseFloat(style.borderTopWidth);
    const border_bottom_width = parseFloat(style.borderBottomWidth);
    return {
        delay,
        duration,
        easing,
        css: t => `overflow: hidden;` +
            `opacity: ${Math.min(t * 20, 1) * opacity};` +
            `height: ${t * height}px;` +
            `padding-top: ${t * padding_top}px;` +
            `padding-bottom: ${t * padding_bottom}px;` +
            `margin-top: ${t * margin_top}px;` +
            `margin-bottom: ${t * margin_bottom}px;` +
            `border-top-width: ${t * border_top_width}px;` +
            `border-bottom-width: ${t * border_bottom_width}px;`
    };
}

function toInteger(dirtyNumber) {
  if (dirtyNumber === null || dirtyNumber === true || dirtyNumber === false) {
    return NaN;
  }

  var number = Number(dirtyNumber);

  if (isNaN(number)) {
    return number;
  }

  return number < 0 ? Math.ceil(number) : Math.floor(number);
}

function requiredArgs(required, args) {
  if (args.length < required) {
    throw new TypeError(required + ' argument' + (required > 1 ? 's' : '') + ' required, but only ' + args.length + ' present');
  }
}

/**
 * @name toDate
 * @category Common Helpers
 * @summary Convert the given argument to an instance of Date.
 *
 * @description
 * Convert the given argument to an instance of Date.
 *
 * If the argument is an instance of Date, the function returns its clone.
 *
 * If the argument is a number, it is treated as a timestamp.
 *
 * If the argument is none of the above, the function returns Invalid Date.
 *
 * **Note**: *all* Date arguments passed to any *date-fns* function is processed by `toDate`.
 *
 * @param {Date|Number} argument - the value to convert
 * @returns {Date} the parsed date in the local time zone
 * @throws {TypeError} 1 argument required
 *
 * @example
 * // Clone the date:
 * const result = toDate(new Date(2014, 1, 11, 11, 30, 30))
 * //=> Tue Feb 11 2014 11:30:30
 *
 * @example
 * // Convert the timestamp to date:
 * const result = toDate(1392098430000)
 * //=> Tue Feb 11 2014 11:30:30
 */

function toDate(argument) {
  requiredArgs(1, arguments);
  var argStr = Object.prototype.toString.call(argument); // Clone the date

  if (argument instanceof Date || typeof argument === 'object' && argStr === '[object Date]') {
    // Prevent the date to lose the milliseconds when passed to new Date() in IE10
    return new Date(argument.getTime());
  } else if (typeof argument === 'number' || argStr === '[object Number]') {
    return new Date(argument);
  } else {
    if ((typeof argument === 'string' || argStr === '[object String]') && typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn("Starting with v2.0.0-beta.1 date-fns doesn't accept strings as date arguments. Please use `parseISO` to parse strings. See: https://git.io/fjule"); // eslint-disable-next-line no-console

      console.warn(new Error().stack);
    }

    return new Date(NaN);
  }
}

/**
 * @name addMilliseconds
 * @category Millisecond Helpers
 * @summary Add the specified number of milliseconds to the given date.
 *
 * @description
 * Add the specified number of milliseconds to the given date.
 *
 * ### v2.0.0 breaking changes:
 *
 * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
 *
 * @param {Date|Number} date - the date to be changed
 * @param {Number} amount - the amount of milliseconds to be added. Positive decimals will be rounded using `Math.floor`, decimals less than zero will be rounded using `Math.ceil`.
 * @returns {Date} the new date with the milliseconds added
 * @throws {TypeError} 2 arguments required
 *
 * @example
 * // Add 750 milliseconds to 10 July 2014 12:45:30.000:
 * var result = addMilliseconds(new Date(2014, 6, 10, 12, 45, 30, 0), 750)
 * //=> Thu Jul 10 2014 12:45:30.750
 */

function addMilliseconds(dirtyDate, dirtyAmount) {
  requiredArgs(2, arguments);
  var timestamp = toDate(dirtyDate).getTime();
  var amount = toInteger(dirtyAmount);
  return new Date(timestamp + amount);
}

var MILLISECONDS_IN_MINUTE = 60000;

function getDateMillisecondsPart(date) {
  return date.getTime() % MILLISECONDS_IN_MINUTE;
}
/**
 * Google Chrome as of 67.0.3396.87 introduced timezones with offset that includes seconds.
 * They usually appear for dates that denote time before the timezones were introduced
 * (e.g. for 'Europe/Prague' timezone the offset is GMT+00:57:44 before 1 October 1891
 * and GMT+01:00:00 after that date)
 *
 * Date#getTimezoneOffset returns the offset in minutes and would return 57 for the example above,
 * which would lead to incorrect calculations.
 *
 * This function returns the timezone offset in milliseconds that takes seconds in account.
 */


function getTimezoneOffsetInMilliseconds(dirtyDate) {
  var date = new Date(dirtyDate.getTime());
  var baseTimezoneOffset = Math.ceil(date.getTimezoneOffset());
  date.setSeconds(0, 0);
  var hasNegativeUTCOffset = baseTimezoneOffset > 0;
  var millisecondsPartOfTimezoneOffset = hasNegativeUTCOffset ? (MILLISECONDS_IN_MINUTE + getDateMillisecondsPart(date)) % MILLISECONDS_IN_MINUTE : getDateMillisecondsPart(date);
  return baseTimezoneOffset * MILLISECONDS_IN_MINUTE + millisecondsPartOfTimezoneOffset;
}

/**
 * @name isValid
 * @category Common Helpers
 * @summary Is the given date valid?
 *
 * @description
 * Returns false if argument is Invalid Date and true otherwise.
 * Argument is converted to Date using `toDate`. See [toDate]{@link https://date-fns.org/docs/toDate}
 * Invalid Date is a Date, whose time value is NaN.
 *
 * Time value of Date: http://es5.github.io/#x15.9.1.1
 *
 * ### v2.0.0 breaking changes:
 *
 * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
 *
 * - Now `isValid` doesn't throw an exception
 *   if the first argument is not an instance of Date.
 *   Instead, argument is converted beforehand using `toDate`.
 *
 *   Examples:
 *
 *   | `isValid` argument        | Before v2.0.0 | v2.0.0 onward |
 *   |---------------------------|---------------|---------------|
 *   | `new Date()`              | `true`        | `true`        |
 *   | `new Date('2016-01-01')`  | `true`        | `true`        |
 *   | `new Date('')`            | `false`       | `false`       |
 *   | `new Date(1488370835081)` | `true`        | `true`        |
 *   | `new Date(NaN)`           | `false`       | `false`       |
 *   | `'2016-01-01'`            | `TypeError`   | `false`       |
 *   | `''`                      | `TypeError`   | `false`       |
 *   | `1488370835081`           | `TypeError`   | `true`        |
 *   | `NaN`                     | `TypeError`   | `false`       |
 *
 *   We introduce this change to make *date-fns* consistent with ECMAScript behavior
 *   that try to coerce arguments to the expected type
 *   (which is also the case with other *date-fns* functions).
 *
 * @param {*} date - the date to check
 * @returns {Boolean} the date is valid
 * @throws {TypeError} 1 argument required
 *
 * @example
 * // For the valid date:
 * var result = isValid(new Date(2014, 1, 31))
 * //=> true
 *
 * @example
 * // For the value, convertable into a date:
 * var result = isValid(1393804800000)
 * //=> true
 *
 * @example
 * // For the invalid date:
 * var result = isValid(new Date(''))
 * //=> false
 */

function isValid(dirtyDate) {
  requiredArgs(1, arguments);
  var date = toDate(dirtyDate);
  return !isNaN(date);
}

var formatDistanceLocale = {
  lessThanXSeconds: {
    one: 'less than a second',
    other: 'less than {{count}} seconds'
  },
  xSeconds: {
    one: '1 second',
    other: '{{count}} seconds'
  },
  halfAMinute: 'half a minute',
  lessThanXMinutes: {
    one: 'less than a minute',
    other: 'less than {{count}} minutes'
  },
  xMinutes: {
    one: '1 minute',
    other: '{{count}} minutes'
  },
  aboutXHours: {
    one: 'about 1 hour',
    other: 'about {{count}} hours'
  },
  xHours: {
    one: '1 hour',
    other: '{{count}} hours'
  },
  xDays: {
    one: '1 day',
    other: '{{count}} days'
  },
  aboutXWeeks: {
    one: 'about 1 week',
    other: 'about {{count}} weeks'
  },
  xWeeks: {
    one: '1 week',
    other: '{{count}} weeks'
  },
  aboutXMonths: {
    one: 'about 1 month',
    other: 'about {{count}} months'
  },
  xMonths: {
    one: '1 month',
    other: '{{count}} months'
  },
  aboutXYears: {
    one: 'about 1 year',
    other: 'about {{count}} years'
  },
  xYears: {
    one: '1 year',
    other: '{{count}} years'
  },
  overXYears: {
    one: 'over 1 year',
    other: 'over {{count}} years'
  },
  almostXYears: {
    one: 'almost 1 year',
    other: 'almost {{count}} years'
  }
};
function formatDistance(token, count, options) {
  options = options || {};
  var result;

  if (typeof formatDistanceLocale[token] === 'string') {
    result = formatDistanceLocale[token];
  } else if (count === 1) {
    result = formatDistanceLocale[token].one;
  } else {
    result = formatDistanceLocale[token].other.replace('{{count}}', count);
  }

  if (options.addSuffix) {
    if (options.comparison > 0) {
      return 'in ' + result;
    } else {
      return result + ' ago';
    }
  }

  return result;
}

function buildFormatLongFn(args) {
  return function (dirtyOptions) {
    var options = dirtyOptions || {};
    var width = options.width ? String(options.width) : args.defaultWidth;
    var format = args.formats[width] || args.formats[args.defaultWidth];
    return format;
  };
}

var dateFormats = {
  full: 'EEEE, MMMM do, y',
  long: 'MMMM do, y',
  medium: 'MMM d, y',
  short: 'MM/dd/yyyy'
};
var timeFormats = {
  full: 'h:mm:ss a zzzz',
  long: 'h:mm:ss a z',
  medium: 'h:mm:ss a',
  short: 'h:mm a'
};
var dateTimeFormats = {
  full: "{{date}} 'at' {{time}}",
  long: "{{date}} 'at' {{time}}",
  medium: '{{date}}, {{time}}',
  short: '{{date}}, {{time}}'
};
var formatLong = {
  date: buildFormatLongFn({
    formats: dateFormats,
    defaultWidth: 'full'
  }),
  time: buildFormatLongFn({
    formats: timeFormats,
    defaultWidth: 'full'
  }),
  dateTime: buildFormatLongFn({
    formats: dateTimeFormats,
    defaultWidth: 'full'
  })
};

var formatRelativeLocale = {
  lastWeek: "'last' eeee 'at' p",
  yesterday: "'yesterday at' p",
  today: "'today at' p",
  tomorrow: "'tomorrow at' p",
  nextWeek: "eeee 'at' p",
  other: 'P'
};
function formatRelative(token, _date, _baseDate, _options) {
  return formatRelativeLocale[token];
}

function buildLocalizeFn(args) {
  return function (dirtyIndex, dirtyOptions) {
    var options = dirtyOptions || {};
    var context = options.context ? String(options.context) : 'standalone';
    var valuesArray;

    if (context === 'formatting' && args.formattingValues) {
      var defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
      var width = options.width ? String(options.width) : defaultWidth;
      valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
    } else {
      var _defaultWidth = args.defaultWidth;

      var _width = options.width ? String(options.width) : args.defaultWidth;

      valuesArray = args.values[_width] || args.values[_defaultWidth];
    }

    var index = args.argumentCallback ? args.argumentCallback(dirtyIndex) : dirtyIndex;
    return valuesArray[index];
  };
}

var eraValues = {
  narrow: ['B', 'A'],
  abbreviated: ['BC', 'AD'],
  wide: ['Before Christ', 'Anno Domini']
};
var quarterValues = {
  narrow: ['1', '2', '3', '4'],
  abbreviated: ['Q1', 'Q2', 'Q3', 'Q4'],
  wide: ['1st quarter', '2nd quarter', '3rd quarter', '4th quarter'] // Note: in English, the names of days of the week and months are capitalized.
  // If you are making a new locale based on this one, check if the same is true for the language you're working on.
  // Generally, formatted dates should look like they are in the middle of a sentence,
  // e.g. in Spanish language the weekdays and months should be in the lowercase.

};
var monthValues = {
  narrow: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
  abbreviated: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  wide: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};
var dayValues = {
  narrow: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  short: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
  abbreviated: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  wide: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
};
var dayPeriodValues = {
  narrow: {
    am: 'a',
    pm: 'p',
    midnight: 'mi',
    noon: 'n',
    morning: 'morning',
    afternoon: 'afternoon',
    evening: 'evening',
    night: 'night'
  },
  abbreviated: {
    am: 'AM',
    pm: 'PM',
    midnight: 'midnight',
    noon: 'noon',
    morning: 'morning',
    afternoon: 'afternoon',
    evening: 'evening',
    night: 'night'
  },
  wide: {
    am: 'a.m.',
    pm: 'p.m.',
    midnight: 'midnight',
    noon: 'noon',
    morning: 'morning',
    afternoon: 'afternoon',
    evening: 'evening',
    night: 'night'
  }
};
var formattingDayPeriodValues = {
  narrow: {
    am: 'a',
    pm: 'p',
    midnight: 'mi',
    noon: 'n',
    morning: 'in the morning',
    afternoon: 'in the afternoon',
    evening: 'in the evening',
    night: 'at night'
  },
  abbreviated: {
    am: 'AM',
    pm: 'PM',
    midnight: 'midnight',
    noon: 'noon',
    morning: 'in the morning',
    afternoon: 'in the afternoon',
    evening: 'in the evening',
    night: 'at night'
  },
  wide: {
    am: 'a.m.',
    pm: 'p.m.',
    midnight: 'midnight',
    noon: 'noon',
    morning: 'in the morning',
    afternoon: 'in the afternoon',
    evening: 'in the evening',
    night: 'at night'
  }
};

function ordinalNumber(dirtyNumber, _dirtyOptions) {
  var number = Number(dirtyNumber); // If ordinal numbers depend on context, for example,
  // if they are different for different grammatical genders,
  // use `options.unit`:
  //
  //   var options = dirtyOptions || {}
  //   var unit = String(options.unit)
  //
  // where `unit` can be 'year', 'quarter', 'month', 'week', 'date', 'dayOfYear',
  // 'day', 'hour', 'minute', 'second'

  var rem100 = number % 100;

  if (rem100 > 20 || rem100 < 10) {
    switch (rem100 % 10) {
      case 1:
        return number + 'st';

      case 2:
        return number + 'nd';

      case 3:
        return number + 'rd';
    }
  }

  return number + 'th';
}

var localize = {
  ordinalNumber: ordinalNumber,
  era: buildLocalizeFn({
    values: eraValues,
    defaultWidth: 'wide'
  }),
  quarter: buildLocalizeFn({
    values: quarterValues,
    defaultWidth: 'wide',
    argumentCallback: function (quarter) {
      return Number(quarter) - 1;
    }
  }),
  month: buildLocalizeFn({
    values: monthValues,
    defaultWidth: 'wide'
  }),
  day: buildLocalizeFn({
    values: dayValues,
    defaultWidth: 'wide'
  }),
  dayPeriod: buildLocalizeFn({
    values: dayPeriodValues,
    defaultWidth: 'wide',
    formattingValues: formattingDayPeriodValues,
    defaultFormattingWidth: 'wide'
  })
};

function buildMatchPatternFn(args) {
  return function (dirtyString, dirtyOptions) {
    var string = String(dirtyString);
    var options = dirtyOptions || {};
    var matchResult = string.match(args.matchPattern);

    if (!matchResult) {
      return null;
    }

    var matchedString = matchResult[0];
    var parseResult = string.match(args.parsePattern);

    if (!parseResult) {
      return null;
    }

    var value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
    value = options.valueCallback ? options.valueCallback(value) : value;
    return {
      value: value,
      rest: string.slice(matchedString.length)
    };
  };
}

function buildMatchFn(args) {
  return function (dirtyString, dirtyOptions) {
    var string = String(dirtyString);
    var options = dirtyOptions || {};
    var width = options.width;
    var matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
    var matchResult = string.match(matchPattern);

    if (!matchResult) {
      return null;
    }

    var matchedString = matchResult[0];
    var parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
    var value;

    if (Object.prototype.toString.call(parsePatterns) === '[object Array]') {
      value = findIndex(parsePatterns, function (pattern) {
        return pattern.test(matchedString);
      });
    } else {
      value = findKey(parsePatterns, function (pattern) {
        return pattern.test(matchedString);
      });
    }

    value = args.valueCallback ? args.valueCallback(value) : value;
    value = options.valueCallback ? options.valueCallback(value) : value;
    return {
      value: value,
      rest: string.slice(matchedString.length)
    };
  };
}

function findKey(object, predicate) {
  for (var key in object) {
    if (object.hasOwnProperty(key) && predicate(object[key])) {
      return key;
    }
  }
}

function findIndex(array, predicate) {
  for (var key = 0; key < array.length; key++) {
    if (predicate(array[key])) {
      return key;
    }
  }
}

var matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
var parseOrdinalNumberPattern = /\d+/i;
var matchEraPatterns = {
  narrow: /^(b|a)/i,
  abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
  wide: /^(before christ|before common era|anno domini|common era)/i
};
var parseEraPatterns = {
  any: [/^b/i, /^(a|c)/i]
};
var matchQuarterPatterns = {
  narrow: /^[1234]/i,
  abbreviated: /^q[1234]/i,
  wide: /^[1234](th|st|nd|rd)? quarter/i
};
var parseQuarterPatterns = {
  any: [/1/i, /2/i, /3/i, /4/i]
};
var matchMonthPatterns = {
  narrow: /^[jfmasond]/i,
  abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
};
var parseMonthPatterns = {
  narrow: [/^j/i, /^f/i, /^m/i, /^a/i, /^m/i, /^j/i, /^j/i, /^a/i, /^s/i, /^o/i, /^n/i, /^d/i],
  any: [/^ja/i, /^f/i, /^mar/i, /^ap/i, /^may/i, /^jun/i, /^jul/i, /^au/i, /^s/i, /^o/i, /^n/i, /^d/i]
};
var matchDayPatterns = {
  narrow: /^[smtwf]/i,
  short: /^(su|mo|tu|we|th|fr|sa)/i,
  abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
  wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
};
var parseDayPatterns = {
  narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
  any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
};
var matchDayPeriodPatterns = {
  narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
  any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
};
var parseDayPeriodPatterns = {
  any: {
    am: /^a/i,
    pm: /^p/i,
    midnight: /^mi/i,
    noon: /^no/i,
    morning: /morning/i,
    afternoon: /afternoon/i,
    evening: /evening/i,
    night: /night/i
  }
};
var match = {
  ordinalNumber: buildMatchPatternFn({
    matchPattern: matchOrdinalNumberPattern,
    parsePattern: parseOrdinalNumberPattern,
    valueCallback: function (value) {
      return parseInt(value, 10);
    }
  }),
  era: buildMatchFn({
    matchPatterns: matchEraPatterns,
    defaultMatchWidth: 'wide',
    parsePatterns: parseEraPatterns,
    defaultParseWidth: 'any'
  }),
  quarter: buildMatchFn({
    matchPatterns: matchQuarterPatterns,
    defaultMatchWidth: 'wide',
    parsePatterns: parseQuarterPatterns,
    defaultParseWidth: 'any',
    valueCallback: function (index) {
      return index + 1;
    }
  }),
  month: buildMatchFn({
    matchPatterns: matchMonthPatterns,
    defaultMatchWidth: 'wide',
    parsePatterns: parseMonthPatterns,
    defaultParseWidth: 'any'
  }),
  day: buildMatchFn({
    matchPatterns: matchDayPatterns,
    defaultMatchWidth: 'wide',
    parsePatterns: parseDayPatterns,
    defaultParseWidth: 'any'
  }),
  dayPeriod: buildMatchFn({
    matchPatterns: matchDayPeriodPatterns,
    defaultMatchWidth: 'any',
    parsePatterns: parseDayPeriodPatterns,
    defaultParseWidth: 'any'
  })
};

/**
 * @type {Locale}
 * @category Locales
 * @summary English locale (United States).
 * @language English
 * @iso-639-2 eng
 * @author Sasha Koss [@kossnocorp]{@link https://github.com/kossnocorp}
 * @author Lesha Koss [@leshakoss]{@link https://github.com/leshakoss}
 */

var locale = {
  code: 'en-US',
  formatDistance: formatDistance,
  formatLong: formatLong,
  formatRelative: formatRelative,
  localize: localize,
  match: match,
  options: {
    weekStartsOn: 0
    /* Sunday */
    ,
    firstWeekContainsDate: 1
  }
};

/**
 * @name subMilliseconds
 * @category Millisecond Helpers
 * @summary Subtract the specified number of milliseconds from the given date.
 *
 * @description
 * Subtract the specified number of milliseconds from the given date.
 *
 * ### v2.0.0 breaking changes:
 *
 * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
 *
 * @param {Date|Number} date - the date to be changed
 * @param {Number} amount - the amount of milliseconds to be subtracted. Positive decimals will be rounded using `Math.floor`, decimals less than zero will be rounded using `Math.ceil`.
 * @returns {Date} the new date with the milliseconds subtracted
 * @throws {TypeError} 2 arguments required
 *
 * @example
 * // Subtract 750 milliseconds from 10 July 2014 12:45:30.000:
 * var result = subMilliseconds(new Date(2014, 6, 10, 12, 45, 30, 0), 750)
 * //=> Thu Jul 10 2014 12:45:29.250
 */

function subMilliseconds(dirtyDate, dirtyAmount) {
  requiredArgs(2, arguments);
  var amount = toInteger(dirtyAmount);
  return addMilliseconds(dirtyDate, -amount);
}

function addLeadingZeros(number, targetLength) {
  var sign = number < 0 ? '-' : '';
  var output = Math.abs(number).toString();

  while (output.length < targetLength) {
    output = '0' + output;
  }

  return sign + output;
}

/*
 * |     | Unit                           |     | Unit                           |
 * |-----|--------------------------------|-----|--------------------------------|
 * |  a  | AM, PM                         |  A* |                                |
 * |  d  | Day of month                   |  D  |                                |
 * |  h  | Hour [1-12]                    |  H  | Hour [0-23]                    |
 * |  m  | Minute                         |  M  | Month                          |
 * |  s  | Second                         |  S  | Fraction of second             |
 * |  y  | Year (abs)                     |  Y  |                                |
 *
 * Letters marked by * are not implemented but reserved by Unicode standard.
 */

var formatters$1 = {
  // Year
  y: function (date, token) {
    // From http://www.unicode.org/reports/tr35/tr35-31/tr35-dates.html#Date_Format_tokens
    // | Year     |     y | yy |   yyy |  yyyy | yyyyy |
    // |----------|-------|----|-------|-------|-------|
    // | AD 1     |     1 | 01 |   001 |  0001 | 00001 |
    // | AD 12    |    12 | 12 |   012 |  0012 | 00012 |
    // | AD 123   |   123 | 23 |   123 |  0123 | 00123 |
    // | AD 1234  |  1234 | 34 |  1234 |  1234 | 01234 |
    // | AD 12345 | 12345 | 45 | 12345 | 12345 | 12345 |
    var signedYear = date.getUTCFullYear(); // Returns 1 for 1 BC (which is year 0 in JavaScript)

    var year = signedYear > 0 ? signedYear : 1 - signedYear;
    return addLeadingZeros(token === 'yy' ? year % 100 : year, token.length);
  },
  // Month
  M: function (date, token) {
    var month = date.getUTCMonth();
    return token === 'M' ? String(month + 1) : addLeadingZeros(month + 1, 2);
  },
  // Day of the month
  d: function (date, token) {
    return addLeadingZeros(date.getUTCDate(), token.length);
  },
  // AM or PM
  a: function (date, token) {
    var dayPeriodEnumValue = date.getUTCHours() / 12 >= 1 ? 'pm' : 'am';

    switch (token) {
      case 'a':
      case 'aa':
      case 'aaa':
        return dayPeriodEnumValue.toUpperCase();

      case 'aaaaa':
        return dayPeriodEnumValue[0];

      case 'aaaa':
      default:
        return dayPeriodEnumValue === 'am' ? 'a.m.' : 'p.m.';
    }
  },
  // Hour [1-12]
  h: function (date, token) {
    return addLeadingZeros(date.getUTCHours() % 12 || 12, token.length);
  },
  // Hour [0-23]
  H: function (date, token) {
    return addLeadingZeros(date.getUTCHours(), token.length);
  },
  // Minute
  m: function (date, token) {
    return addLeadingZeros(date.getUTCMinutes(), token.length);
  },
  // Second
  s: function (date, token) {
    return addLeadingZeros(date.getUTCSeconds(), token.length);
  },
  // Fraction of second
  S: function (date, token) {
    var numberOfDigits = token.length;
    var milliseconds = date.getUTCMilliseconds();
    var fractionalSeconds = Math.floor(milliseconds * Math.pow(10, numberOfDigits - 3));
    return addLeadingZeros(fractionalSeconds, token.length);
  }
};

var MILLISECONDS_IN_DAY = 86400000; // This function will be a part of public API when UTC function will be implemented.
// See issue: https://github.com/date-fns/date-fns/issues/376

function getUTCDayOfYear(dirtyDate) {
  requiredArgs(1, arguments);
  var date = toDate(dirtyDate);
  var timestamp = date.getTime();
  date.setUTCMonth(0, 1);
  date.setUTCHours(0, 0, 0, 0);
  var startOfYearTimestamp = date.getTime();
  var difference = timestamp - startOfYearTimestamp;
  return Math.floor(difference / MILLISECONDS_IN_DAY) + 1;
}

// See issue: https://github.com/date-fns/date-fns/issues/376

function startOfUTCISOWeek(dirtyDate) {
  requiredArgs(1, arguments);
  var weekStartsOn = 1;
  var date = toDate(dirtyDate);
  var day = date.getUTCDay();
  var diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

// See issue: https://github.com/date-fns/date-fns/issues/376

function getUTCISOWeekYear(dirtyDate) {
  requiredArgs(1, arguments);
  var date = toDate(dirtyDate);
  var year = date.getUTCFullYear();
  var fourthOfJanuaryOfNextYear = new Date(0);
  fourthOfJanuaryOfNextYear.setUTCFullYear(year + 1, 0, 4);
  fourthOfJanuaryOfNextYear.setUTCHours(0, 0, 0, 0);
  var startOfNextYear = startOfUTCISOWeek(fourthOfJanuaryOfNextYear);
  var fourthOfJanuaryOfThisYear = new Date(0);
  fourthOfJanuaryOfThisYear.setUTCFullYear(year, 0, 4);
  fourthOfJanuaryOfThisYear.setUTCHours(0, 0, 0, 0);
  var startOfThisYear = startOfUTCISOWeek(fourthOfJanuaryOfThisYear);

  if (date.getTime() >= startOfNextYear.getTime()) {
    return year + 1;
  } else if (date.getTime() >= startOfThisYear.getTime()) {
    return year;
  } else {
    return year - 1;
  }
}

// See issue: https://github.com/date-fns/date-fns/issues/376

function startOfUTCISOWeekYear(dirtyDate) {
  requiredArgs(1, arguments);
  var year = getUTCISOWeekYear(dirtyDate);
  var fourthOfJanuary = new Date(0);
  fourthOfJanuary.setUTCFullYear(year, 0, 4);
  fourthOfJanuary.setUTCHours(0, 0, 0, 0);
  var date = startOfUTCISOWeek(fourthOfJanuary);
  return date;
}

var MILLISECONDS_IN_WEEK$1 = 604800000; // This function will be a part of public API when UTC function will be implemented.
// See issue: https://github.com/date-fns/date-fns/issues/376

function getUTCISOWeek(dirtyDate) {
  requiredArgs(1, arguments);
  var date = toDate(dirtyDate);
  var diff = startOfUTCISOWeek(date).getTime() - startOfUTCISOWeekYear(date).getTime(); // Round the number of days to the nearest integer
  // because the number of milliseconds in a week is not constant
  // (e.g. it's different in the week of the daylight saving time clock shift)

  return Math.round(diff / MILLISECONDS_IN_WEEK$1) + 1;
}

// See issue: https://github.com/date-fns/date-fns/issues/376

function startOfUTCWeek(dirtyDate, dirtyOptions) {
  requiredArgs(1, arguments);
  var options = dirtyOptions || {};
  var locale = options.locale;
  var localeWeekStartsOn = locale && locale.options && locale.options.weekStartsOn;
  var defaultWeekStartsOn = localeWeekStartsOn == null ? 0 : toInteger(localeWeekStartsOn);
  var weekStartsOn = options.weekStartsOn == null ? defaultWeekStartsOn : toInteger(options.weekStartsOn); // Test if weekStartsOn is between 0 and 6 _and_ is not NaN

  if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) {
    throw new RangeError('weekStartsOn must be between 0 and 6 inclusively');
  }

  var date = toDate(dirtyDate);
  var day = date.getUTCDay();
  var diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

// See issue: https://github.com/date-fns/date-fns/issues/376

function getUTCWeekYear(dirtyDate, dirtyOptions) {
  requiredArgs(1, arguments);
  var date = toDate(dirtyDate, dirtyOptions);
  var year = date.getUTCFullYear();
  var options = dirtyOptions || {};
  var locale = options.locale;
  var localeFirstWeekContainsDate = locale && locale.options && locale.options.firstWeekContainsDate;
  var defaultFirstWeekContainsDate = localeFirstWeekContainsDate == null ? 1 : toInteger(localeFirstWeekContainsDate);
  var firstWeekContainsDate = options.firstWeekContainsDate == null ? defaultFirstWeekContainsDate : toInteger(options.firstWeekContainsDate); // Test if weekStartsOn is between 1 and 7 _and_ is not NaN

  if (!(firstWeekContainsDate >= 1 && firstWeekContainsDate <= 7)) {
    throw new RangeError('firstWeekContainsDate must be between 1 and 7 inclusively');
  }

  var firstWeekOfNextYear = new Date(0);
  firstWeekOfNextYear.setUTCFullYear(year + 1, 0, firstWeekContainsDate);
  firstWeekOfNextYear.setUTCHours(0, 0, 0, 0);
  var startOfNextYear = startOfUTCWeek(firstWeekOfNextYear, dirtyOptions);
  var firstWeekOfThisYear = new Date(0);
  firstWeekOfThisYear.setUTCFullYear(year, 0, firstWeekContainsDate);
  firstWeekOfThisYear.setUTCHours(0, 0, 0, 0);
  var startOfThisYear = startOfUTCWeek(firstWeekOfThisYear, dirtyOptions);

  if (date.getTime() >= startOfNextYear.getTime()) {
    return year + 1;
  } else if (date.getTime() >= startOfThisYear.getTime()) {
    return year;
  } else {
    return year - 1;
  }
}

// See issue: https://github.com/date-fns/date-fns/issues/376

function startOfUTCWeekYear(dirtyDate, dirtyOptions) {
  requiredArgs(1, arguments);
  var options = dirtyOptions || {};
  var locale = options.locale;
  var localeFirstWeekContainsDate = locale && locale.options && locale.options.firstWeekContainsDate;
  var defaultFirstWeekContainsDate = localeFirstWeekContainsDate == null ? 1 : toInteger(localeFirstWeekContainsDate);
  var firstWeekContainsDate = options.firstWeekContainsDate == null ? defaultFirstWeekContainsDate : toInteger(options.firstWeekContainsDate);
  var year = getUTCWeekYear(dirtyDate, dirtyOptions);
  var firstWeek = new Date(0);
  firstWeek.setUTCFullYear(year, 0, firstWeekContainsDate);
  firstWeek.setUTCHours(0, 0, 0, 0);
  var date = startOfUTCWeek(firstWeek, dirtyOptions);
  return date;
}

var MILLISECONDS_IN_WEEK = 604800000; // This function will be a part of public API when UTC function will be implemented.
// See issue: https://github.com/date-fns/date-fns/issues/376

function getUTCWeek(dirtyDate, options) {
  requiredArgs(1, arguments);
  var date = toDate(dirtyDate);
  var diff = startOfUTCWeek(date, options).getTime() - startOfUTCWeekYear(date, options).getTime(); // Round the number of days to the nearest integer
  // because the number of milliseconds in a week is not constant
  // (e.g. it's different in the week of the daylight saving time clock shift)

  return Math.round(diff / MILLISECONDS_IN_WEEK) + 1;
}

var dayPeriodEnum = {
  am: 'am',
  pm: 'pm',
  midnight: 'midnight',
  noon: 'noon',
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  night: 'night'
  /*
   * |     | Unit                           |     | Unit                           |
   * |-----|--------------------------------|-----|--------------------------------|
   * |  a  | AM, PM                         |  A* | Milliseconds in day            |
   * |  b  | AM, PM, noon, midnight         |  B  | Flexible day period            |
   * |  c  | Stand-alone local day of week  |  C* | Localized hour w/ day period   |
   * |  d  | Day of month                   |  D  | Day of year                    |
   * |  e  | Local day of week              |  E  | Day of week                    |
   * |  f  |                                |  F* | Day of week in month           |
   * |  g* | Modified Julian day            |  G  | Era                            |
   * |  h  | Hour [1-12]                    |  H  | Hour [0-23]                    |
   * |  i! | ISO day of week                |  I! | ISO week of year               |
   * |  j* | Localized hour w/ day period   |  J* | Localized hour w/o day period  |
   * |  k  | Hour [1-24]                    |  K  | Hour [0-11]                    |
   * |  l* | (deprecated)                   |  L  | Stand-alone month              |
   * |  m  | Minute                         |  M  | Month                          |
   * |  n  |                                |  N  |                                |
   * |  o! | Ordinal number modifier        |  O  | Timezone (GMT)                 |
   * |  p! | Long localized time            |  P! | Long localized date            |
   * |  q  | Stand-alone quarter            |  Q  | Quarter                        |
   * |  r* | Related Gregorian year         |  R! | ISO week-numbering year        |
   * |  s  | Second                         |  S  | Fraction of second             |
   * |  t! | Seconds timestamp              |  T! | Milliseconds timestamp         |
   * |  u  | Extended year                  |  U* | Cyclic year                    |
   * |  v* | Timezone (generic non-locat.)  |  V* | Timezone (location)            |
   * |  w  | Local week of year             |  W* | Week of month                  |
   * |  x  | Timezone (ISO-8601 w/o Z)      |  X  | Timezone (ISO-8601)            |
   * |  y  | Year (abs)                     |  Y  | Local week-numbering year      |
   * |  z  | Timezone (specific non-locat.) |  Z* | Timezone (aliases)             |
   *
   * Letters marked by * are not implemented but reserved by Unicode standard.
   *
   * Letters marked by ! are non-standard, but implemented by date-fns:
   * - `o` modifies the previous token to turn it into an ordinal (see `format` docs)
   * - `i` is ISO day of week. For `i` and `ii` is returns numeric ISO week days,
   *   i.e. 7 for Sunday, 1 for Monday, etc.
   * - `I` is ISO week of year, as opposed to `w` which is local week of year.
   * - `R` is ISO week-numbering year, as opposed to `Y` which is local week-numbering year.
   *   `R` is supposed to be used in conjunction with `I` and `i`
   *   for universal ISO week-numbering date, whereas
   *   `Y` is supposed to be used in conjunction with `w` and `e`
   *   for week-numbering date specific to the locale.
   * - `P` is long localized date format
   * - `p` is long localized time format
   */

};
var formatters = {
  // Era
  G: function (date, token, localize) {
    var era = date.getUTCFullYear() > 0 ? 1 : 0;

    switch (token) {
      // AD, BC
      case 'G':
      case 'GG':
      case 'GGG':
        return localize.era(era, {
          width: 'abbreviated'
        });
      // A, B

      case 'GGGGG':
        return localize.era(era, {
          width: 'narrow'
        });
      // Anno Domini, Before Christ

      case 'GGGG':
      default:
        return localize.era(era, {
          width: 'wide'
        });
    }
  },
  // Year
  y: function (date, token, localize) {
    // Ordinal number
    if (token === 'yo') {
      var signedYear = date.getUTCFullYear(); // Returns 1 for 1 BC (which is year 0 in JavaScript)

      var year = signedYear > 0 ? signedYear : 1 - signedYear;
      return localize.ordinalNumber(year, {
        unit: 'year'
      });
    }

    return formatters$1.y(date, token);
  },
  // Local week-numbering year
  Y: function (date, token, localize, options) {
    var signedWeekYear = getUTCWeekYear(date, options); // Returns 1 for 1 BC (which is year 0 in JavaScript)

    var weekYear = signedWeekYear > 0 ? signedWeekYear : 1 - signedWeekYear; // Two digit year

    if (token === 'YY') {
      var twoDigitYear = weekYear % 100;
      return addLeadingZeros(twoDigitYear, 2);
    } // Ordinal number


    if (token === 'Yo') {
      return localize.ordinalNumber(weekYear, {
        unit: 'year'
      });
    } // Padding


    return addLeadingZeros(weekYear, token.length);
  },
  // ISO week-numbering year
  R: function (date, token) {
    var isoWeekYear = getUTCISOWeekYear(date); // Padding

    return addLeadingZeros(isoWeekYear, token.length);
  },
  // Extended year. This is a single number designating the year of this calendar system.
  // The main difference between `y` and `u` localizers are B.C. years:
  // | Year | `y` | `u` |
  // |------|-----|-----|
  // | AC 1 |   1 |   1 |
  // | BC 1 |   1 |   0 |
  // | BC 2 |   2 |  -1 |
  // Also `yy` always returns the last two digits of a year,
  // while `uu` pads single digit years to 2 characters and returns other years unchanged.
  u: function (date, token) {
    var year = date.getUTCFullYear();
    return addLeadingZeros(year, token.length);
  },
  // Quarter
  Q: function (date, token, localize) {
    var quarter = Math.ceil((date.getUTCMonth() + 1) / 3);

    switch (token) {
      // 1, 2, 3, 4
      case 'Q':
        return String(quarter);
      // 01, 02, 03, 04

      case 'QQ':
        return addLeadingZeros(quarter, 2);
      // 1st, 2nd, 3rd, 4th

      case 'Qo':
        return localize.ordinalNumber(quarter, {
          unit: 'quarter'
        });
      // Q1, Q2, Q3, Q4

      case 'QQQ':
        return localize.quarter(quarter, {
          width: 'abbreviated',
          context: 'formatting'
        });
      // 1, 2, 3, 4 (narrow quarter; could be not numerical)

      case 'QQQQQ':
        return localize.quarter(quarter, {
          width: 'narrow',
          context: 'formatting'
        });
      // 1st quarter, 2nd quarter, ...

      case 'QQQQ':
      default:
        return localize.quarter(quarter, {
          width: 'wide',
          context: 'formatting'
        });
    }
  },
  // Stand-alone quarter
  q: function (date, token, localize) {
    var quarter = Math.ceil((date.getUTCMonth() + 1) / 3);

    switch (token) {
      // 1, 2, 3, 4
      case 'q':
        return String(quarter);
      // 01, 02, 03, 04

      case 'qq':
        return addLeadingZeros(quarter, 2);
      // 1st, 2nd, 3rd, 4th

      case 'qo':
        return localize.ordinalNumber(quarter, {
          unit: 'quarter'
        });
      // Q1, Q2, Q3, Q4

      case 'qqq':
        return localize.quarter(quarter, {
          width: 'abbreviated',
          context: 'standalone'
        });
      // 1, 2, 3, 4 (narrow quarter; could be not numerical)

      case 'qqqqq':
        return localize.quarter(quarter, {
          width: 'narrow',
          context: 'standalone'
        });
      // 1st quarter, 2nd quarter, ...

      case 'qqqq':
      default:
        return localize.quarter(quarter, {
          width: 'wide',
          context: 'standalone'
        });
    }
  },
  // Month
  M: function (date, token, localize) {
    var month = date.getUTCMonth();

    switch (token) {
      case 'M':
      case 'MM':
        return formatters$1.M(date, token);
      // 1st, 2nd, ..., 12th

      case 'Mo':
        return localize.ordinalNumber(month + 1, {
          unit: 'month'
        });
      // Jan, Feb, ..., Dec

      case 'MMM':
        return localize.month(month, {
          width: 'abbreviated',
          context: 'formatting'
        });
      // J, F, ..., D

      case 'MMMMM':
        return localize.month(month, {
          width: 'narrow',
          context: 'formatting'
        });
      // January, February, ..., December

      case 'MMMM':
      default:
        return localize.month(month, {
          width: 'wide',
          context: 'formatting'
        });
    }
  },
  // Stand-alone month
  L: function (date, token, localize) {
    var month = date.getUTCMonth();

    switch (token) {
      // 1, 2, ..., 12
      case 'L':
        return String(month + 1);
      // 01, 02, ..., 12

      case 'LL':
        return addLeadingZeros(month + 1, 2);
      // 1st, 2nd, ..., 12th

      case 'Lo':
        return localize.ordinalNumber(month + 1, {
          unit: 'month'
        });
      // Jan, Feb, ..., Dec

      case 'LLL':
        return localize.month(month, {
          width: 'abbreviated',
          context: 'standalone'
        });
      // J, F, ..., D

      case 'LLLLL':
        return localize.month(month, {
          width: 'narrow',
          context: 'standalone'
        });
      // January, February, ..., December

      case 'LLLL':
      default:
        return localize.month(month, {
          width: 'wide',
          context: 'standalone'
        });
    }
  },
  // Local week of year
  w: function (date, token, localize, options) {
    var week = getUTCWeek(date, options);

    if (token === 'wo') {
      return localize.ordinalNumber(week, {
        unit: 'week'
      });
    }

    return addLeadingZeros(week, token.length);
  },
  // ISO week of year
  I: function (date, token, localize) {
    var isoWeek = getUTCISOWeek(date);

    if (token === 'Io') {
      return localize.ordinalNumber(isoWeek, {
        unit: 'week'
      });
    }

    return addLeadingZeros(isoWeek, token.length);
  },
  // Day of the month
  d: function (date, token, localize) {
    if (token === 'do') {
      return localize.ordinalNumber(date.getUTCDate(), {
        unit: 'date'
      });
    }

    return formatters$1.d(date, token);
  },
  // Day of year
  D: function (date, token, localize) {
    var dayOfYear = getUTCDayOfYear(date);

    if (token === 'Do') {
      return localize.ordinalNumber(dayOfYear, {
        unit: 'dayOfYear'
      });
    }

    return addLeadingZeros(dayOfYear, token.length);
  },
  // Day of week
  E: function (date, token, localize) {
    var dayOfWeek = date.getUTCDay();

    switch (token) {
      // Tue
      case 'E':
      case 'EE':
      case 'EEE':
        return localize.day(dayOfWeek, {
          width: 'abbreviated',
          context: 'formatting'
        });
      // T

      case 'EEEEE':
        return localize.day(dayOfWeek, {
          width: 'narrow',
          context: 'formatting'
        });
      // Tu

      case 'EEEEEE':
        return localize.day(dayOfWeek, {
          width: 'short',
          context: 'formatting'
        });
      // Tuesday

      case 'EEEE':
      default:
        return localize.day(dayOfWeek, {
          width: 'wide',
          context: 'formatting'
        });
    }
  },
  // Local day of week
  e: function (date, token, localize, options) {
    var dayOfWeek = date.getUTCDay();
    var localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;

    switch (token) {
      // Numerical value (Nth day of week with current locale or weekStartsOn)
      case 'e':
        return String(localDayOfWeek);
      // Padded numerical value

      case 'ee':
        return addLeadingZeros(localDayOfWeek, 2);
      // 1st, 2nd, ..., 7th

      case 'eo':
        return localize.ordinalNumber(localDayOfWeek, {
          unit: 'day'
        });

      case 'eee':
        return localize.day(dayOfWeek, {
          width: 'abbreviated',
          context: 'formatting'
        });
      // T

      case 'eeeee':
        return localize.day(dayOfWeek, {
          width: 'narrow',
          context: 'formatting'
        });
      // Tu

      case 'eeeeee':
        return localize.day(dayOfWeek, {
          width: 'short',
          context: 'formatting'
        });
      // Tuesday

      case 'eeee':
      default:
        return localize.day(dayOfWeek, {
          width: 'wide',
          context: 'formatting'
        });
    }
  },
  // Stand-alone local day of week
  c: function (date, token, localize, options) {
    var dayOfWeek = date.getUTCDay();
    var localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;

    switch (token) {
      // Numerical value (same as in `e`)
      case 'c':
        return String(localDayOfWeek);
      // Padded numerical value

      case 'cc':
        return addLeadingZeros(localDayOfWeek, token.length);
      // 1st, 2nd, ..., 7th

      case 'co':
        return localize.ordinalNumber(localDayOfWeek, {
          unit: 'day'
        });

      case 'ccc':
        return localize.day(dayOfWeek, {
          width: 'abbreviated',
          context: 'standalone'
        });
      // T

      case 'ccccc':
        return localize.day(dayOfWeek, {
          width: 'narrow',
          context: 'standalone'
        });
      // Tu

      case 'cccccc':
        return localize.day(dayOfWeek, {
          width: 'short',
          context: 'standalone'
        });
      // Tuesday

      case 'cccc':
      default:
        return localize.day(dayOfWeek, {
          width: 'wide',
          context: 'standalone'
        });
    }
  },
  // ISO day of week
  i: function (date, token, localize) {
    var dayOfWeek = date.getUTCDay();
    var isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;

    switch (token) {
      // 2
      case 'i':
        return String(isoDayOfWeek);
      // 02

      case 'ii':
        return addLeadingZeros(isoDayOfWeek, token.length);
      // 2nd

      case 'io':
        return localize.ordinalNumber(isoDayOfWeek, {
          unit: 'day'
        });
      // Tue

      case 'iii':
        return localize.day(dayOfWeek, {
          width: 'abbreviated',
          context: 'formatting'
        });
      // T

      case 'iiiii':
        return localize.day(dayOfWeek, {
          width: 'narrow',
          context: 'formatting'
        });
      // Tu

      case 'iiiiii':
        return localize.day(dayOfWeek, {
          width: 'short',
          context: 'formatting'
        });
      // Tuesday

      case 'iiii':
      default:
        return localize.day(dayOfWeek, {
          width: 'wide',
          context: 'formatting'
        });
    }
  },
  // AM or PM
  a: function (date, token, localize) {
    var hours = date.getUTCHours();
    var dayPeriodEnumValue = hours / 12 >= 1 ? 'pm' : 'am';

    switch (token) {
      case 'a':
      case 'aa':
      case 'aaa':
        return localize.dayPeriod(dayPeriodEnumValue, {
          width: 'abbreviated',
          context: 'formatting'
        });

      case 'aaaaa':
        return localize.dayPeriod(dayPeriodEnumValue, {
          width: 'narrow',
          context: 'formatting'
        });

      case 'aaaa':
      default:
        return localize.dayPeriod(dayPeriodEnumValue, {
          width: 'wide',
          context: 'formatting'
        });
    }
  },
  // AM, PM, midnight, noon
  b: function (date, token, localize) {
    var hours = date.getUTCHours();
    var dayPeriodEnumValue;

    if (hours === 12) {
      dayPeriodEnumValue = dayPeriodEnum.noon;
    } else if (hours === 0) {
      dayPeriodEnumValue = dayPeriodEnum.midnight;
    } else {
      dayPeriodEnumValue = hours / 12 >= 1 ? 'pm' : 'am';
    }

    switch (token) {
      case 'b':
      case 'bb':
      case 'bbb':
        return localize.dayPeriod(dayPeriodEnumValue, {
          width: 'abbreviated',
          context: 'formatting'
        });

      case 'bbbbb':
        return localize.dayPeriod(dayPeriodEnumValue, {
          width: 'narrow',
          context: 'formatting'
        });

      case 'bbbb':
      default:
        return localize.dayPeriod(dayPeriodEnumValue, {
          width: 'wide',
          context: 'formatting'
        });
    }
  },
  // in the morning, in the afternoon, in the evening, at night
  B: function (date, token, localize) {
    var hours = date.getUTCHours();
    var dayPeriodEnumValue;

    if (hours >= 17) {
      dayPeriodEnumValue = dayPeriodEnum.evening;
    } else if (hours >= 12) {
      dayPeriodEnumValue = dayPeriodEnum.afternoon;
    } else if (hours >= 4) {
      dayPeriodEnumValue = dayPeriodEnum.morning;
    } else {
      dayPeriodEnumValue = dayPeriodEnum.night;
    }

    switch (token) {
      case 'B':
      case 'BB':
      case 'BBB':
        return localize.dayPeriod(dayPeriodEnumValue, {
          width: 'abbreviated',
          context: 'formatting'
        });

      case 'BBBBB':
        return localize.dayPeriod(dayPeriodEnumValue, {
          width: 'narrow',
          context: 'formatting'
        });

      case 'BBBB':
      default:
        return localize.dayPeriod(dayPeriodEnumValue, {
          width: 'wide',
          context: 'formatting'
        });
    }
  },
  // Hour [1-12]
  h: function (date, token, localize) {
    if (token === 'ho') {
      var hours = date.getUTCHours() % 12;
      if (hours === 0) hours = 12;
      return localize.ordinalNumber(hours, {
        unit: 'hour'
      });
    }

    return formatters$1.h(date, token);
  },
  // Hour [0-23]
  H: function (date, token, localize) {
    if (token === 'Ho') {
      return localize.ordinalNumber(date.getUTCHours(), {
        unit: 'hour'
      });
    }

    return formatters$1.H(date, token);
  },
  // Hour [0-11]
  K: function (date, token, localize) {
    var hours = date.getUTCHours() % 12;

    if (token === 'Ko') {
      return localize.ordinalNumber(hours, {
        unit: 'hour'
      });
    }

    return addLeadingZeros(hours, token.length);
  },
  // Hour [1-24]
  k: function (date, token, localize) {
    var hours = date.getUTCHours();
    if (hours === 0) hours = 24;

    if (token === 'ko') {
      return localize.ordinalNumber(hours, {
        unit: 'hour'
      });
    }

    return addLeadingZeros(hours, token.length);
  },
  // Minute
  m: function (date, token, localize) {
    if (token === 'mo') {
      return localize.ordinalNumber(date.getUTCMinutes(), {
        unit: 'minute'
      });
    }

    return formatters$1.m(date, token);
  },
  // Second
  s: function (date, token, localize) {
    if (token === 'so') {
      return localize.ordinalNumber(date.getUTCSeconds(), {
        unit: 'second'
      });
    }

    return formatters$1.s(date, token);
  },
  // Fraction of second
  S: function (date, token) {
    return formatters$1.S(date, token);
  },
  // Timezone (ISO-8601. If offset is 0, output is always `'Z'`)
  X: function (date, token, _localize, options) {
    var originalDate = options._originalDate || date;
    var timezoneOffset = originalDate.getTimezoneOffset();

    if (timezoneOffset === 0) {
      return 'Z';
    }

    switch (token) {
      // Hours and optional minutes
      case 'X':
        return formatTimezoneWithOptionalMinutes(timezoneOffset);
      // Hours, minutes and optional seconds without `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `XX`

      case 'XXXX':
      case 'XX':
        // Hours and minutes without `:` delimiter
        return formatTimezone(timezoneOffset);
      // Hours, minutes and optional seconds with `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `XXX`

      case 'XXXXX':
      case 'XXX': // Hours and minutes with `:` delimiter

      default:
        return formatTimezone(timezoneOffset, ':');
    }
  },
  // Timezone (ISO-8601. If offset is 0, output is `'+00:00'` or equivalent)
  x: function (date, token, _localize, options) {
    var originalDate = options._originalDate || date;
    var timezoneOffset = originalDate.getTimezoneOffset();

    switch (token) {
      // Hours and optional minutes
      case 'x':
        return formatTimezoneWithOptionalMinutes(timezoneOffset);
      // Hours, minutes and optional seconds without `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `xx`

      case 'xxxx':
      case 'xx':
        // Hours and minutes without `:` delimiter
        return formatTimezone(timezoneOffset);
      // Hours, minutes and optional seconds with `:` delimiter
      // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
      // so this token always has the same output as `xxx`

      case 'xxxxx':
      case 'xxx': // Hours and minutes with `:` delimiter

      default:
        return formatTimezone(timezoneOffset, ':');
    }
  },
  // Timezone (GMT)
  O: function (date, token, _localize, options) {
    var originalDate = options._originalDate || date;
    var timezoneOffset = originalDate.getTimezoneOffset();

    switch (token) {
      // Short
      case 'O':
      case 'OO':
      case 'OOO':
        return 'GMT' + formatTimezoneShort(timezoneOffset, ':');
      // Long

      case 'OOOO':
      default:
        return 'GMT' + formatTimezone(timezoneOffset, ':');
    }
  },
  // Timezone (specific non-location)
  z: function (date, token, _localize, options) {
    var originalDate = options._originalDate || date;
    var timezoneOffset = originalDate.getTimezoneOffset();

    switch (token) {
      // Short
      case 'z':
      case 'zz':
      case 'zzz':
        return 'GMT' + formatTimezoneShort(timezoneOffset, ':');
      // Long

      case 'zzzz':
      default:
        return 'GMT' + formatTimezone(timezoneOffset, ':');
    }
  },
  // Seconds timestamp
  t: function (date, token, _localize, options) {
    var originalDate = options._originalDate || date;
    var timestamp = Math.floor(originalDate.getTime() / 1000);
    return addLeadingZeros(timestamp, token.length);
  },
  // Milliseconds timestamp
  T: function (date, token, _localize, options) {
    var originalDate = options._originalDate || date;
    var timestamp = originalDate.getTime();
    return addLeadingZeros(timestamp, token.length);
  }
};

function formatTimezoneShort(offset, dirtyDelimiter) {
  var sign = offset > 0 ? '-' : '+';
  var absOffset = Math.abs(offset);
  var hours = Math.floor(absOffset / 60);
  var minutes = absOffset % 60;

  if (minutes === 0) {
    return sign + String(hours);
  }

  var delimiter = dirtyDelimiter || '';
  return sign + String(hours) + delimiter + addLeadingZeros(minutes, 2);
}

function formatTimezoneWithOptionalMinutes(offset, dirtyDelimiter) {
  if (offset % 60 === 0) {
    var sign = offset > 0 ? '-' : '+';
    return sign + addLeadingZeros(Math.abs(offset) / 60, 2);
  }

  return formatTimezone(offset, dirtyDelimiter);
}

function formatTimezone(offset, dirtyDelimiter) {
  var delimiter = dirtyDelimiter || '';
  var sign = offset > 0 ? '-' : '+';
  var absOffset = Math.abs(offset);
  var hours = addLeadingZeros(Math.floor(absOffset / 60), 2);
  var minutes = addLeadingZeros(absOffset % 60, 2);
  return sign + hours + delimiter + minutes;
}

function dateLongFormatter(pattern, formatLong) {
  switch (pattern) {
    case 'P':
      return formatLong.date({
        width: 'short'
      });

    case 'PP':
      return formatLong.date({
        width: 'medium'
      });

    case 'PPP':
      return formatLong.date({
        width: 'long'
      });

    case 'PPPP':
    default:
      return formatLong.date({
        width: 'full'
      });
  }
}

function timeLongFormatter(pattern, formatLong) {
  switch (pattern) {
    case 'p':
      return formatLong.time({
        width: 'short'
      });

    case 'pp':
      return formatLong.time({
        width: 'medium'
      });

    case 'ppp':
      return formatLong.time({
        width: 'long'
      });

    case 'pppp':
    default:
      return formatLong.time({
        width: 'full'
      });
  }
}

function dateTimeLongFormatter(pattern, formatLong) {
  var matchResult = pattern.match(/(P+)(p+)?/);
  var datePattern = matchResult[1];
  var timePattern = matchResult[2];

  if (!timePattern) {
    return dateLongFormatter(pattern, formatLong);
  }

  var dateTimeFormat;

  switch (datePattern) {
    case 'P':
      dateTimeFormat = formatLong.dateTime({
        width: 'short'
      });
      break;

    case 'PP':
      dateTimeFormat = formatLong.dateTime({
        width: 'medium'
      });
      break;

    case 'PPP':
      dateTimeFormat = formatLong.dateTime({
        width: 'long'
      });
      break;

    case 'PPPP':
    default:
      dateTimeFormat = formatLong.dateTime({
        width: 'full'
      });
      break;
  }

  return dateTimeFormat.replace('{{date}}', dateLongFormatter(datePattern, formatLong)).replace('{{time}}', timeLongFormatter(timePattern, formatLong));
}

var longFormatters = {
  p: timeLongFormatter,
  P: dateTimeLongFormatter
};

var protectedDayOfYearTokens = ['D', 'DD'];
var protectedWeekYearTokens = ['YY', 'YYYY'];
function isProtectedDayOfYearToken(token) {
  return protectedDayOfYearTokens.indexOf(token) !== -1;
}
function isProtectedWeekYearToken(token) {
  return protectedWeekYearTokens.indexOf(token) !== -1;
}
function throwProtectedError(token, format, input) {
  if (token === 'YYYY') {
    throw new RangeError("Use `yyyy` instead of `YYYY` (in `".concat(format, "`) for formatting years to the input `").concat(input, "`; see: https://git.io/fxCyr"));
  } else if (token === 'YY') {
    throw new RangeError("Use `yy` instead of `YY` (in `".concat(format, "`) for formatting years to the input `").concat(input, "`; see: https://git.io/fxCyr"));
  } else if (token === 'D') {
    throw new RangeError("Use `d` instead of `D` (in `".concat(format, "`) for formatting days of the month to the input `").concat(input, "`; see: https://git.io/fxCyr"));
  } else if (token === 'DD') {
    throw new RangeError("Use `dd` instead of `DD` (in `".concat(format, "`) for formatting days of the month to the input `").concat(input, "`; see: https://git.io/fxCyr"));
  }
}

// - [yYQqMLwIdDecihHKkms]o matches any available ordinal number token
//   (one of the certain letters followed by `o`)
// - (\w)\1* matches any sequences of the same letter
// - '' matches two quote characters in a row
// - '(''|[^'])+('|$) matches anything surrounded by two quote characters ('),
//   except a single quote symbol, which ends the sequence.
//   Two quote characters do not end the sequence.
//   If there is no matching single quote
//   then the sequence will continue until the end of the string.
// - . matches any single character unmatched by previous parts of the RegExps

var formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g; // This RegExp catches symbols escaped by quotes, and also
// sequences of symbols P, p, and the combinations like `PPPPPPPppppp`

var longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
var escapedStringRegExp = /^'([^]*?)'?$/;
var doubleQuoteRegExp = /''/g;
var unescapedLatinCharacterRegExp = /[a-zA-Z]/;
/**
 * @name format
 * @category Common Helpers
 * @summary Format the date.
 *
 * @description
 * Return the formatted date string in the given format. The result may vary by locale.
 *
 * > ⚠️ Please note that the `format` tokens differ from Moment.js and other libraries.
 * > See: https://git.io/fxCyr
 *
 * The characters wrapped between two single quotes characters (') are escaped.
 * Two single quotes in a row, whether inside or outside a quoted sequence, represent a 'real' single quote.
 * (see the last example)
 *
 * Format of the string is based on Unicode Technical Standard #35:
 * https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
 * with a few additions (see note 7 below the table).
 *
 * Accepted patterns:
 * | Unit                            | Pattern | Result examples                   | Notes |
 * |---------------------------------|---------|-----------------------------------|-------|
 * | Era                             | G..GGG  | AD, BC                            |       |
 * |                                 | GGGG    | Anno Domini, Before Christ        | 2     |
 * |                                 | GGGGG   | A, B                              |       |
 * | Calendar year                   | y       | 44, 1, 1900, 2017                 | 5     |
 * |                                 | yo      | 44th, 1st, 0th, 17th              | 5,7   |
 * |                                 | yy      | 44, 01, 00, 17                    | 5     |
 * |                                 | yyy     | 044, 001, 1900, 2017              | 5     |
 * |                                 | yyyy    | 0044, 0001, 1900, 2017            | 5     |
 * |                                 | yyyyy   | ...                               | 3,5   |
 * | Local week-numbering year       | Y       | 44, 1, 1900, 2017                 | 5     |
 * |                                 | Yo      | 44th, 1st, 1900th, 2017th         | 5,7   |
 * |                                 | YY      | 44, 01, 00, 17                    | 5,8   |
 * |                                 | YYY     | 044, 001, 1900, 2017              | 5     |
 * |                                 | YYYY    | 0044, 0001, 1900, 2017            | 5,8   |
 * |                                 | YYYYY   | ...                               | 3,5   |
 * | ISO week-numbering year         | R       | -43, 0, 1, 1900, 2017             | 5,7   |
 * |                                 | RR      | -43, 00, 01, 1900, 2017           | 5,7   |
 * |                                 | RRR     | -043, 000, 001, 1900, 2017        | 5,7   |
 * |                                 | RRRR    | -0043, 0000, 0001, 1900, 2017     | 5,7   |
 * |                                 | RRRRR   | ...                               | 3,5,7 |
 * | Extended year                   | u       | -43, 0, 1, 1900, 2017             | 5     |
 * |                                 | uu      | -43, 01, 1900, 2017               | 5     |
 * |                                 | uuu     | -043, 001, 1900, 2017             | 5     |
 * |                                 | uuuu    | -0043, 0001, 1900, 2017           | 5     |
 * |                                 | uuuuu   | ...                               | 3,5   |
 * | Quarter (formatting)            | Q       | 1, 2, 3, 4                        |       |
 * |                                 | Qo      | 1st, 2nd, 3rd, 4th                | 7     |
 * |                                 | QQ      | 01, 02, 03, 04                    |       |
 * |                                 | QQQ     | Q1, Q2, Q3, Q4                    |       |
 * |                                 | QQQQ    | 1st quarter, 2nd quarter, ...     | 2     |
 * |                                 | QQQQQ   | 1, 2, 3, 4                        | 4     |
 * | Quarter (stand-alone)           | q       | 1, 2, 3, 4                        |       |
 * |                                 | qo      | 1st, 2nd, 3rd, 4th                | 7     |
 * |                                 | qq      | 01, 02, 03, 04                    |       |
 * |                                 | qqq     | Q1, Q2, Q3, Q4                    |       |
 * |                                 | qqqq    | 1st quarter, 2nd quarter, ...     | 2     |
 * |                                 | qqqqq   | 1, 2, 3, 4                        | 4     |
 * | Month (formatting)              | M       | 1, 2, ..., 12                     |       |
 * |                                 | Mo      | 1st, 2nd, ..., 12th               | 7     |
 * |                                 | MM      | 01, 02, ..., 12                   |       |
 * |                                 | MMM     | Jan, Feb, ..., Dec                |       |
 * |                                 | MMMM    | January, February, ..., December  | 2     |
 * |                                 | MMMMM   | J, F, ..., D                      |       |
 * | Month (stand-alone)             | L       | 1, 2, ..., 12                     |       |
 * |                                 | Lo      | 1st, 2nd, ..., 12th               | 7     |
 * |                                 | LL      | 01, 02, ..., 12                   |       |
 * |                                 | LLL     | Jan, Feb, ..., Dec                |       |
 * |                                 | LLLL    | January, February, ..., December  | 2     |
 * |                                 | LLLLL   | J, F, ..., D                      |       |
 * | Local week of year              | w       | 1, 2, ..., 53                     |       |
 * |                                 | wo      | 1st, 2nd, ..., 53th               | 7     |
 * |                                 | ww      | 01, 02, ..., 53                   |       |
 * | ISO week of year                | I       | 1, 2, ..., 53                     | 7     |
 * |                                 | Io      | 1st, 2nd, ..., 53th               | 7     |
 * |                                 | II      | 01, 02, ..., 53                   | 7     |
 * | Day of month                    | d       | 1, 2, ..., 31                     |       |
 * |                                 | do      | 1st, 2nd, ..., 31st               | 7     |
 * |                                 | dd      | 01, 02, ..., 31                   |       |
 * | Day of year                     | D       | 1, 2, ..., 365, 366               | 9     |
 * |                                 | Do      | 1st, 2nd, ..., 365th, 366th       | 7     |
 * |                                 | DD      | 01, 02, ..., 365, 366             | 9     |
 * |                                 | DDD     | 001, 002, ..., 365, 366           |       |
 * |                                 | DDDD    | ...                               | 3     |
 * | Day of week (formatting)        | E..EEE  | Mon, Tue, Wed, ..., Sun           |       |
 * |                                 | EEEE    | Monday, Tuesday, ..., Sunday      | 2     |
 * |                                 | EEEEE   | M, T, W, T, F, S, S               |       |
 * |                                 | EEEEEE  | Mo, Tu, We, Th, Fr, Su, Sa        |       |
 * | ISO day of week (formatting)    | i       | 1, 2, 3, ..., 7                   | 7     |
 * |                                 | io      | 1st, 2nd, ..., 7th                | 7     |
 * |                                 | ii      | 01, 02, ..., 07                   | 7     |
 * |                                 | iii     | Mon, Tue, Wed, ..., Sun           | 7     |
 * |                                 | iiii    | Monday, Tuesday, ..., Sunday      | 2,7   |
 * |                                 | iiiii   | M, T, W, T, F, S, S               | 7     |
 * |                                 | iiiiii  | Mo, Tu, We, Th, Fr, Su, Sa        | 7     |
 * | Local day of week (formatting)  | e       | 2, 3, 4, ..., 1                   |       |
 * |                                 | eo      | 2nd, 3rd, ..., 1st                | 7     |
 * |                                 | ee      | 02, 03, ..., 01                   |       |
 * |                                 | eee     | Mon, Tue, Wed, ..., Sun           |       |
 * |                                 | eeee    | Monday, Tuesday, ..., Sunday      | 2     |
 * |                                 | eeeee   | M, T, W, T, F, S, S               |       |
 * |                                 | eeeeee  | Mo, Tu, We, Th, Fr, Su, Sa        |       |
 * | Local day of week (stand-alone) | c       | 2, 3, 4, ..., 1                   |       |
 * |                                 | co      | 2nd, 3rd, ..., 1st                | 7     |
 * |                                 | cc      | 02, 03, ..., 01                   |       |
 * |                                 | ccc     | Mon, Tue, Wed, ..., Sun           |       |
 * |                                 | cccc    | Monday, Tuesday, ..., Sunday      | 2     |
 * |                                 | ccccc   | M, T, W, T, F, S, S               |       |
 * |                                 | cccccc  | Mo, Tu, We, Th, Fr, Su, Sa        |       |
 * | AM, PM                          | a..aaa  | AM, PM                            |       |
 * |                                 | aaaa    | a.m., p.m.                        | 2     |
 * |                                 | aaaaa   | a, p                              |       |
 * | AM, PM, noon, midnight          | b..bbb  | AM, PM, noon, midnight            |       |
 * |                                 | bbbb    | a.m., p.m., noon, midnight        | 2     |
 * |                                 | bbbbb   | a, p, n, mi                       |       |
 * | Flexible day period             | B..BBB  | at night, in the morning, ...     |       |
 * |                                 | BBBB    | at night, in the morning, ...     | 2     |
 * |                                 | BBBBB   | at night, in the morning, ...     |       |
 * | Hour [1-12]                     | h       | 1, 2, ..., 11, 12                 |       |
 * |                                 | ho      | 1st, 2nd, ..., 11th, 12th         | 7     |
 * |                                 | hh      | 01, 02, ..., 11, 12               |       |
 * | Hour [0-23]                     | H       | 0, 1, 2, ..., 23                  |       |
 * |                                 | Ho      | 0th, 1st, 2nd, ..., 23rd          | 7     |
 * |                                 | HH      | 00, 01, 02, ..., 23               |       |
 * | Hour [0-11]                     | K       | 1, 2, ..., 11, 0                  |       |
 * |                                 | Ko      | 1st, 2nd, ..., 11th, 0th          | 7     |
 * |                                 | KK      | 01, 02, ..., 11, 00               |       |
 * | Hour [1-24]                     | k       | 24, 1, 2, ..., 23                 |       |
 * |                                 | ko      | 24th, 1st, 2nd, ..., 23rd         | 7     |
 * |                                 | kk      | 24, 01, 02, ..., 23               |       |
 * | Minute                          | m       | 0, 1, ..., 59                     |       |
 * |                                 | mo      | 0th, 1st, ..., 59th               | 7     |
 * |                                 | mm      | 00, 01, ..., 59                   |       |
 * | Second                          | s       | 0, 1, ..., 59                     |       |
 * |                                 | so      | 0th, 1st, ..., 59th               | 7     |
 * |                                 | ss      | 00, 01, ..., 59                   |       |
 * | Fraction of second              | S       | 0, 1, ..., 9                      |       |
 * |                                 | SS      | 00, 01, ..., 99                   |       |
 * |                                 | SSS     | 000, 0001, ..., 999               |       |
 * |                                 | SSSS    | ...                               | 3     |
 * | Timezone (ISO-8601 w/ Z)        | X       | -08, +0530, Z                     |       |
 * |                                 | XX      | -0800, +0530, Z                   |       |
 * |                                 | XXX     | -08:00, +05:30, Z                 |       |
 * |                                 | XXXX    | -0800, +0530, Z, +123456          | 2     |
 * |                                 | XXXXX   | -08:00, +05:30, Z, +12:34:56      |       |
 * | Timezone (ISO-8601 w/o Z)       | x       | -08, +0530, +00                   |       |
 * |                                 | xx      | -0800, +0530, +0000               |       |
 * |                                 | xxx     | -08:00, +05:30, +00:00            | 2     |
 * |                                 | xxxx    | -0800, +0530, +0000, +123456      |       |
 * |                                 | xxxxx   | -08:00, +05:30, +00:00, +12:34:56 |       |
 * | Timezone (GMT)                  | O...OOO | GMT-8, GMT+5:30, GMT+0            |       |
 * |                                 | OOOO    | GMT-08:00, GMT+05:30, GMT+00:00   | 2     |
 * | Timezone (specific non-locat.)  | z...zzz | GMT-8, GMT+5:30, GMT+0            | 6     |
 * |                                 | zzzz    | GMT-08:00, GMT+05:30, GMT+00:00   | 2,6   |
 * | Seconds timestamp               | t       | 512969520                         | 7     |
 * |                                 | tt      | ...                               | 3,7   |
 * | Milliseconds timestamp          | T       | 512969520900                      | 7     |
 * |                                 | TT      | ...                               | 3,7   |
 * | Long localized date             | P       | 05/29/1453                        | 7     |
 * |                                 | PP      | May 29, 1453                      | 7     |
 * |                                 | PPP     | May 29th, 1453                    | 7     |
 * |                                 | PPPP    | Sunday, May 29th, 1453            | 2,7   |
 * | Long localized time             | p       | 12:00 AM                          | 7     |
 * |                                 | pp      | 12:00:00 AM                       | 7     |
 * |                                 | ppp     | 12:00:00 AM GMT+2                 | 7     |
 * |                                 | pppp    | 12:00:00 AM GMT+02:00             | 2,7   |
 * | Combination of date and time    | Pp      | 05/29/1453, 12:00 AM              | 7     |
 * |                                 | PPpp    | May 29, 1453, 12:00:00 AM         | 7     |
 * |                                 | PPPppp  | May 29th, 1453 at ...             | 7     |
 * |                                 | PPPPpppp| Sunday, May 29th, 1453 at ...     | 2,7   |
 * Notes:
 * 1. "Formatting" units (e.g. formatting quarter) in the default en-US locale
 *    are the same as "stand-alone" units, but are different in some languages.
 *    "Formatting" units are declined according to the rules of the language
 *    in the context of a date. "Stand-alone" units are always nominative singular:
 *
 *    `format(new Date(2017, 10, 6), 'do LLLL', {locale: cs}) //=> '6. listopad'`
 *
 *    `format(new Date(2017, 10, 6), 'do MMMM', {locale: cs}) //=> '6. listopadu'`
 *
 * 2. Any sequence of the identical letters is a pattern, unless it is escaped by
 *    the single quote characters (see below).
 *    If the sequence is longer than listed in table (e.g. `EEEEEEEEEEE`)
 *    the output will be the same as default pattern for this unit, usually
 *    the longest one (in case of ISO weekdays, `EEEE`). Default patterns for units
 *    are marked with "2" in the last column of the table.
 *
 *    `format(new Date(2017, 10, 6), 'MMM') //=> 'Nov'`
 *
 *    `format(new Date(2017, 10, 6), 'MMMM') //=> 'November'`
 *
 *    `format(new Date(2017, 10, 6), 'MMMMM') //=> 'N'`
 *
 *    `format(new Date(2017, 10, 6), 'MMMMMM') //=> 'November'`
 *
 *    `format(new Date(2017, 10, 6), 'MMMMMMM') //=> 'November'`
 *
 * 3. Some patterns could be unlimited length (such as `yyyyyyyy`).
 *    The output will be padded with zeros to match the length of the pattern.
 *
 *    `format(new Date(2017, 10, 6), 'yyyyyyyy') //=> '00002017'`
 *
 * 4. `QQQQQ` and `qqqqq` could be not strictly numerical in some locales.
 *    These tokens represent the shortest form of the quarter.
 *
 * 5. The main difference between `y` and `u` patterns are B.C. years:
 *
 *    | Year | `y` | `u` |
 *    |------|-----|-----|
 *    | AC 1 |   1 |   1 |
 *    | BC 1 |   1 |   0 |
 *    | BC 2 |   2 |  -1 |
 *
 *    Also `yy` always returns the last two digits of a year,
 *    while `uu` pads single digit years to 2 characters and returns other years unchanged:
 *
 *    | Year | `yy` | `uu` |
 *    |------|------|------|
 *    | 1    |   01 |   01 |
 *    | 14   |   14 |   14 |
 *    | 376  |   76 |  376 |
 *    | 1453 |   53 | 1453 |
 *
 *    The same difference is true for local and ISO week-numbering years (`Y` and `R`),
 *    except local week-numbering years are dependent on `options.weekStartsOn`
 *    and `options.firstWeekContainsDate` (compare [getISOWeekYear]{@link https://date-fns.org/docs/getISOWeekYear}
 *    and [getWeekYear]{@link https://date-fns.org/docs/getWeekYear}).
 *
 * 6. Specific non-location timezones are currently unavailable in `date-fns`,
 *    so right now these tokens fall back to GMT timezones.
 *
 * 7. These patterns are not in the Unicode Technical Standard #35:
 *    - `i`: ISO day of week
 *    - `I`: ISO week of year
 *    - `R`: ISO week-numbering year
 *    - `t`: seconds timestamp
 *    - `T`: milliseconds timestamp
 *    - `o`: ordinal number modifier
 *    - `P`: long localized date
 *    - `p`: long localized time
 *
 * 8. `YY` and `YYYY` tokens represent week-numbering years but they are often confused with years.
 *    You should enable `options.useAdditionalWeekYearTokens` to use them. See: https://git.io/fxCyr
 *
 * 9. `D` and `DD` tokens represent days of the year but they are ofthen confused with days of the month.
 *    You should enable `options.useAdditionalDayOfYearTokens` to use them. See: https://git.io/fxCyr
 *
 * ### v2.0.0 breaking changes:
 *
 * - [Changes that are common for the whole library](https://github.com/date-fns/date-fns/blob/master/docs/upgradeGuide.md#Common-Changes).
 *
 * - The second argument is now required for the sake of explicitness.
 *
 *   ```javascript
 *   // Before v2.0.0
 *   format(new Date(2016, 0, 1))
 *
 *   // v2.0.0 onward
 *   format(new Date(2016, 0, 1), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx")
 *   ```
 *
 * - New format string API for `format` function
 *   which is based on [Unicode Technical Standard #35](https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table).
 *   See [this post](https://blog.date-fns.org/post/unicode-tokens-in-date-fns-v2-sreatyki91jg) for more details.
 *
 * - Characters are now escaped using single quote symbols (`'`) instead of square brackets.
 *
 * @param {Date|Number} date - the original date
 * @param {String} format - the string of tokens
 * @param {Object} [options] - an object with options.
 * @param {Locale} [options.locale=defaultLocale] - the locale object. See [Locale]{@link https://date-fns.org/docs/Locale}
 * @param {0|1|2|3|4|5|6} [options.weekStartsOn=0] - the index of the first day of the week (0 - Sunday)
 * @param {Number} [options.firstWeekContainsDate=1] - the day of January, which is
 * @param {Boolean} [options.useAdditionalWeekYearTokens=false] - if true, allows usage of the week-numbering year tokens `YY` and `YYYY`;
 *   see: https://git.io/fxCyr
 * @param {Boolean} [options.useAdditionalDayOfYearTokens=false] - if true, allows usage of the day of year tokens `D` and `DD`;
 *   see: https://git.io/fxCyr
 * @returns {String} the formatted date string
 * @throws {TypeError} 2 arguments required
 * @throws {RangeError} `date` must not be Invalid Date
 * @throws {RangeError} `options.locale` must contain `localize` property
 * @throws {RangeError} `options.locale` must contain `formatLong` property
 * @throws {RangeError} `options.weekStartsOn` must be between 0 and 6
 * @throws {RangeError} `options.firstWeekContainsDate` must be between 1 and 7
 * @throws {RangeError} use `yyyy` instead of `YYYY` for formatting years using [format provided] to the input [input provided]; see: https://git.io/fxCyr
 * @throws {RangeError} use `yy` instead of `YY` for formatting years using [format provided] to the input [input provided]; see: https://git.io/fxCyr
 * @throws {RangeError} use `d` instead of `D` for formatting days of the month using [format provided] to the input [input provided]; see: https://git.io/fxCyr
 * @throws {RangeError} use `dd` instead of `DD` for formatting days of the month using [format provided] to the input [input provided]; see: https://git.io/fxCyr
 * @throws {RangeError} format string contains an unescaped latin alphabet character
 *
 * @example
 * // Represent 11 February 2014 in middle-endian format:
 * var result = format(new Date(2014, 1, 11), 'MM/dd/yyyy')
 * //=> '02/11/2014'
 *
 * @example
 * // Represent 2 July 2014 in Esperanto:
 * import { eoLocale } from 'date-fns/locale/eo'
 * var result = format(new Date(2014, 6, 2), "do 'de' MMMM yyyy", {
 *   locale: eoLocale
 * })
 * //=> '2-a de julio 2014'
 *
 * @example
 * // Escape string by single quote characters:
 * var result = format(new Date(2014, 6, 2, 15), "h 'o''clock'")
 * //=> "3 o'clock"
 */

function format(dirtyDate, dirtyFormatStr, dirtyOptions) {
  requiredArgs(2, arguments);
  var formatStr = String(dirtyFormatStr);
  var options = dirtyOptions || {};
  var locale$1 = options.locale || locale;
  var localeFirstWeekContainsDate = locale$1.options && locale$1.options.firstWeekContainsDate;
  var defaultFirstWeekContainsDate = localeFirstWeekContainsDate == null ? 1 : toInteger(localeFirstWeekContainsDate);
  var firstWeekContainsDate = options.firstWeekContainsDate == null ? defaultFirstWeekContainsDate : toInteger(options.firstWeekContainsDate); // Test if weekStartsOn is between 1 and 7 _and_ is not NaN

  if (!(firstWeekContainsDate >= 1 && firstWeekContainsDate <= 7)) {
    throw new RangeError('firstWeekContainsDate must be between 1 and 7 inclusively');
  }

  var localeWeekStartsOn = locale$1.options && locale$1.options.weekStartsOn;
  var defaultWeekStartsOn = localeWeekStartsOn == null ? 0 : toInteger(localeWeekStartsOn);
  var weekStartsOn = options.weekStartsOn == null ? defaultWeekStartsOn : toInteger(options.weekStartsOn); // Test if weekStartsOn is between 0 and 6 _and_ is not NaN

  if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) {
    throw new RangeError('weekStartsOn must be between 0 and 6 inclusively');
  }

  if (!locale$1.localize) {
    throw new RangeError('locale must contain localize property');
  }

  if (!locale$1.formatLong) {
    throw new RangeError('locale must contain formatLong property');
  }

  var originalDate = toDate(dirtyDate);

  if (!isValid(originalDate)) {
    throw new RangeError('Invalid time value');
  } // Convert the date in system timezone to the same date in UTC+00:00 timezone.
  // This ensures that when UTC functions will be implemented, locales will be compatible with them.
  // See an issue about UTC functions: https://github.com/date-fns/date-fns/issues/376


  var timezoneOffset = getTimezoneOffsetInMilliseconds(originalDate);
  var utcDate = subMilliseconds(originalDate, timezoneOffset);
  var formatterOptions = {
    firstWeekContainsDate: firstWeekContainsDate,
    weekStartsOn: weekStartsOn,
    locale: locale$1,
    _originalDate: originalDate
  };
  var result = formatStr.match(longFormattingTokensRegExp).map(function (substring) {
    var firstCharacter = substring[0];

    if (firstCharacter === 'p' || firstCharacter === 'P') {
      var longFormatter = longFormatters[firstCharacter];
      return longFormatter(substring, locale$1.formatLong, formatterOptions);
    }

    return substring;
  }).join('').match(formattingTokensRegExp).map(function (substring) {
    // Replace two single quote characters with one single quote character
    if (substring === "''") {
      return "'";
    }

    var firstCharacter = substring[0];

    if (firstCharacter === "'") {
      return cleanEscapedString(substring);
    }

    var formatter = formatters[firstCharacter];

    if (formatter) {
      if (!options.useAdditionalWeekYearTokens && isProtectedWeekYearToken(substring)) {
        throwProtectedError(substring, dirtyFormatStr, dirtyDate);
      }

      if (!options.useAdditionalDayOfYearTokens && isProtectedDayOfYearToken(substring)) {
        throwProtectedError(substring, dirtyFormatStr, dirtyDate);
      }

      return formatter(utcDate, substring, locale$1.localize, formatterOptions);
    }

    if (firstCharacter.match(unescapedLatinCharacterRegExp)) {
      throw new RangeError('Format string contains an unescaped latin alphabet character `' + firstCharacter + '`');
    }

    return substring;
  }).join('');
  return result;
}

function cleanEscapedString(input) {
  return input.match(escapedStringRegExp)[1].replace(doubleQuoteRegExp, "'");
}

function getTime(datetime) {
  const dt = new Date(datetime);
  return format(dt, "dd MMM yyyy, HH:mm:ss");
}

const createStore = () => {
  const {subscribe, set, update} = writable([]);
  return {
    subscribe,
    set,
    update,
    addModel: (model) => {
      return update((models) => [...models, model]);
    },
    refreshModels: (schemaId, page = 1) => {
      return Promise.all([
        api.getModels({schemaId, page}),
        api.getModels({schemaId, deleted: true, page})
      ]).then((results) => {
        set([...results[0], ...results[1]]);
      });
    }
  };
};
var modelsStore = createStore();

/* src/_components/InputField.svelte generated by Svelte v3.24.1 */

function create_else_block$3(ctx) {
	let input;
	let input_value_value;
	let mounted;
	let dispose;

	return {
		c() {
			input = element("input");
			this.h();
		},
		l(nodes) {
			input = claim_element(nodes, "INPUT", {
				class: true,
				type: true,
				value: true,
				placeholder: true,
				name: true,
				id: true
			});

			this.h();
		},
		h() {
			attr(input, "class", "w-full mr-2 form-input");
			attr(input, "type", "text");
			input.value = input_value_value = /*value*/ ctx[2] ? JSON.stringify(/*value*/ ctx[2]) : "";
			attr(input, "placeholder", /*attribute_type*/ ctx[0]);
			attr(input, "name", /*name*/ ctx[1]);
			attr(input, "id", "attr_type");
		},
		m(target, anchor) {
			insert(target, input, anchor);

			if (!mounted) {
				dispose = listen(input, "input", /*propagateUpdate*/ ctx[3]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*value*/ 4 && input_value_value !== (input_value_value = /*value*/ ctx[2] ? JSON.stringify(/*value*/ ctx[2]) : "") && input.value !== input_value_value) {
				input.value = input_value_value;
			}

			if (dirty & /*attribute_type*/ 1) {
				attr(input, "placeholder", /*attribute_type*/ ctx[0]);
			}

			if (dirty & /*name*/ 2) {
				attr(input, "name", /*name*/ ctx[1]);
			}
		},
		d(detaching) {
			if (detaching) detach(input);
			mounted = false;
			dispose();
		}
	};
}

// (30:2) {#if attribute_type === 'text' || attribute_type === 'upload' || attribute_type === 'array'}
function create_if_block$3(ctx) {
	let textarea;
	let textarea_value_value;
	let mounted;
	let dispose;

	return {
		c() {
			textarea = element("textarea");
			this.h();
		},
		l(nodes) {
			textarea = claim_element(nodes, "TEXTAREA", {
				class: true,
				rows: true,
				value: true,
				placeholder: true,
				name: true,
				id: true
			});

			children(textarea).forEach(detach);
			this.h();
		},
		h() {
			attr(textarea, "class", "w-full mr-2 form-input");
			attr(textarea, "rows", "3");
			textarea.value = textarea_value_value = JSON.stringify(/*value*/ ctx[2], null, 2);
			attr(textarea, "placeholder", /*attribute_type*/ ctx[0]);
			attr(textarea, "name", /*name*/ ctx[1]);
			attr(textarea, "id", "attr_type");
		},
		m(target, anchor) {
			insert(target, textarea, anchor);

			if (!mounted) {
				dispose = listen(textarea, "input", /*propagateUpdate*/ ctx[3]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*value*/ 4 && textarea_value_value !== (textarea_value_value = JSON.stringify(/*value*/ ctx[2], null, 2))) {
				textarea.value = textarea_value_value;
			}

			if (dirty & /*attribute_type*/ 1) {
				attr(textarea, "placeholder", /*attribute_type*/ ctx[0]);
			}

			if (dirty & /*name*/ 2) {
				attr(textarea, "name", /*name*/ ctx[1]);
			}
		},
		d(detaching) {
			if (detaching) detach(textarea);
			mounted = false;
			dispose();
		}
	};
}

function create_fragment$5(ctx) {
	let label;
	let span;
	let t0;
	let t1;
	let br;
	let t2;

	function select_block_type(ctx, dirty) {
		if (/*attribute_type*/ ctx[0] === "text" || /*attribute_type*/ ctx[0] === "upload" || /*attribute_type*/ ctx[0] === "array") return create_if_block$3;
		return create_else_block$3;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			label = element("label");
			span = element("span");
			t0 = text(/*name*/ ctx[1]);
			t1 = space();
			br = element("br");
			t2 = space();
			if_block.c();
			this.h();
		},
		l(nodes) {
			label = claim_element(nodes, "LABEL", { class: true, for: true });
			var label_nodes = children(label);
			span = claim_element(label_nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t0 = claim_text(span_nodes, /*name*/ ctx[1]);
			span_nodes.forEach(detach);
			t1 = claim_space(label_nodes);
			br = claim_element(label_nodes, "BR", {});
			t2 = claim_space(label_nodes);
			if_block.l(label_nodes);
			label_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span, "class", "w-full");
			attr(label, "class", "block w-10/12");
			attr(label, "for", "attr_type");
		},
		m(target, anchor) {
			insert(target, label, anchor);
			append(label, span);
			append(span, t0);
			append(label, t1);
			append(label, br);
			append(label, t2);
			if_block.m(label, null);
		},
		p(ctx, [dirty]) {
			if (dirty & /*name*/ 2) set_data(t0, /*name*/ ctx[1]);

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(label, null);
				}
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(label);
			if_block.d();
		}
	};
}

function instance$5($$self, $$props, $$invalidate) {
	const dispatch = createEventDispatcher();
	let { id } = $$props;
	let { attribute_type } = $$props;
	let { name } = $$props;
	let { value = "" } = $$props;

	// TODO: Rewrite to store?
	const propagateUpdate = e => {
		const data = {
			id,
			props: {
				[name]: {
					name,
					value: e.target.value,
					attribute_type
				}
			}
		};

		dispatch("formChanged", data);
	};

	$$self.$$set = $$props => {
		if ("id" in $$props) $$invalidate(4, id = $$props.id);
		if ("attribute_type" in $$props) $$invalidate(0, attribute_type = $$props.attribute_type);
		if ("name" in $$props) $$invalidate(1, name = $$props.name);
		if ("value" in $$props) $$invalidate(2, value = $$props.value);
	};

	return [attribute_type, name, value, propagateUpdate, id];
}

class InputField extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$5, create_fragment$5, safe_not_equal, {
			id: 4,
			attribute_type: 0,
			name: 1,
			value: 2
		});
	}
}

/* src/_components/NewModelInputField.svelte generated by Svelte v3.24.1 */

function create_fragment$4(ctx) {
	let label;
	let p;
	let t0;
	let t1;
	let span;
	let t2;
	let t3;
	let t4;
	let t5;
	let input;
	let input_placeholder_value;
	let mounted;
	let dispose;

	return {
		c() {
			label = element("label");
			p = element("p");
			t0 = text(/*name*/ ctx[1]);
			t1 = space();
			span = element("span");
			t2 = text("(");
			t3 = text(/*attribute_type*/ ctx[0]);
			t4 = text(")");
			t5 = space();
			input = element("input");
			this.h();
		},
		l(nodes) {
			label = claim_element(nodes, "LABEL", { class: true });
			var label_nodes = children(label);
			p = claim_element(label_nodes, "P", { class: true });
			var p_nodes = children(p);
			t0 = claim_text(p_nodes, /*name*/ ctx[1]);
			t1 = claim_space(p_nodes);
			span = claim_element(p_nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t2 = claim_text(span_nodes, "(");
			t3 = claim_text(span_nodes, /*attribute_type*/ ctx[0]);
			t4 = claim_text(span_nodes, ")");
			span_nodes.forEach(detach);
			p_nodes.forEach(detach);
			t5 = claim_space(label_nodes);

			input = claim_element(label_nodes, "INPUT", {
				class: true,
				type: true,
				value: true,
				placeholder: true
			});

			label_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span, "class", "text-gray-600");
			attr(p, "class", "w-full mb-2");
			attr(input, "class", "w-10/12 mr-2 form-input");
			attr(input, "type", "text");
			input.value = /*value*/ ctx[2];
			attr(input, "placeholder", input_placeholder_value = /*getExample*/ ctx[4](/*attribute_type*/ ctx[0]));
			attr(label, "class", "block w-10/12");
		},
		m(target, anchor) {
			insert(target, label, anchor);
			append(label, p);
			append(p, t0);
			append(p, t1);
			append(p, span);
			append(span, t2);
			append(span, t3);
			append(span, t4);
			append(label, t5);
			append(label, input);

			if (!mounted) {
				dispose = listen(input, "input", /*input_handler*/ ctx[6]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*name*/ 2) set_data(t0, /*name*/ ctx[1]);
			if (dirty & /*attribute_type*/ 1) set_data(t3, /*attribute_type*/ ctx[0]);

			if (dirty & /*value*/ 4 && input.value !== /*value*/ ctx[2]) {
				input.value = /*value*/ ctx[2];
			}

			if (dirty & /*attribute_type*/ 1 && input_placeholder_value !== (input_placeholder_value = /*getExample*/ ctx[4](/*attribute_type*/ ctx[0]))) {
				attr(input, "placeholder", input_placeholder_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(label);
			mounted = false;
			dispose();
		}
	};
}

function instance$4($$self, $$props, $$invalidate) {
	let { newProps } = $$props;
	let { attribute_type } = $$props;
	let { name } = $$props;
	let { value = "" } = $$props;

	function setProp({ name, value, attribute_type }) {
		$$invalidate(5, newProps[name] = { name, value, attribute_type }, newProps);
	}

	const getExample = type => {
		if (type === "string" || type === "text") return "\"my text\"";
		if (type === "integer") return "1337";
		if (type === "float") return "13.37";
		if (type === "array") return "[\"my\", \"array\", 10]";
		if (type === "boolean") return "true";
		if (type === "datetime") return "\"2019-04-03T00:00:00.000Z\"";
	};

	const input_handler = e => {
		setProp({
			name,
			value: e.target.value,
			attribute_type
		});
	};

	$$self.$$set = $$props => {
		if ("newProps" in $$props) $$invalidate(5, newProps = $$props.newProps);
		if ("attribute_type" in $$props) $$invalidate(0, attribute_type = $$props.attribute_type);
		if ("name" in $$props) $$invalidate(1, name = $$props.name);
		if ("value" in $$props) $$invalidate(2, value = $$props.value);
	};

	return [attribute_type, name, value, setProp, getExample, newProps, input_handler];
}

class NewModelInputField extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance$4, create_fragment$4, safe_not_equal, {
			newProps: 5,
			attribute_type: 0,
			name: 1,
			value: 2
		});
	}
}

/* src/pages/Models/Manage/_new.svelte generated by Svelte v3.24.1 */

function get_each_context$2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[9] = list[i].name;
	child_ctx[10] = list[i].attribute_type;
	child_ctx[12] = i;
	return child_ctx;
}

// (31:20) {:else}
function create_else_block$2(ctx) {
	let t;

	return {
		c() {
			t = text("+");
		},
		l(nodes) {
			t = claim_text(nodes, "+");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (31:2) {#if showNewForm}
function create_if_block_1$1(ctx) {
	let t;

	return {
		c() {
			t = text("-");
		},
		l(nodes) {
			t = claim_text(nodes, "-");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (34:0) {#if showNewForm}
function create_if_block$2(ctx) {
	let form;
	let t0;
	let br;
	let t1;
	let div;
	let button0;
	let t2;
	let t3;
	let button1;
	let t4;
	let form_intro;
	let form_outro;
	let current;
	let mounted;
	let dispose;
	let each_value = /*props*/ ctx[0];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			form = element("form");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t0 = space();
			br = element("br");
			t1 = space();
			div = element("div");
			button0 = element("button");
			t2 = text("Create");
			t3 = space();
			button1 = element("button");
			t4 = text("Cancel");
			this.h();
		},
		l(nodes) {
			form = claim_element(nodes, "FORM", { class: true });
			var form_nodes = children(form);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(form_nodes);
			}

			t0 = claim_space(form_nodes);
			br = claim_element(form_nodes, "BR", {});
			t1 = claim_space(form_nodes);
			div = claim_element(form_nodes, "DIV", { class: true });
			var div_nodes = children(div);
			button0 = claim_element(div_nodes, "BUTTON", { class: true });
			var button0_nodes = children(button0);
			t2 = claim_text(button0_nodes, "Create");
			button0_nodes.forEach(detach);
			t3 = claim_space(div_nodes);
			button1 = claim_element(div_nodes, "BUTTON", { type: true, class: true });
			var button1_nodes = children(button1);
			t4 = claim_text(button1_nodes, "Cancel");
			button1_nodes.forEach(detach);
			div_nodes.forEach(detach);
			form_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(button0, "class", "button");
			attr(button1, "type", "button");
			attr(button1, "class", "ml-4 button link");
			attr(div, "class", "flex w-full mt-4");
			attr(form, "class", "flex flex-wrap p-6 mb-4 border border-blue-500 rounded");
		},
		m(target, anchor) {
			insert(target, form, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(form, null);
			}

			append(form, t0);
			append(form, br);
			append(form, t1);
			append(form, div);
			append(div, button0);
			append(button0, t2);
			append(div, t3);
			append(div, button1);
			append(button1, t4);
			current = true;

			if (!mounted) {
				dispose = [
					listen(button1, "click", /*click_handler_1*/ ctx[8]),
					listen(form, "submit", prevent_default(/*handleSubmit*/ ctx[3]))
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*props, newProps*/ 5) {
				each_value = /*props*/ ctx[0];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$2(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$2(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(form, t0);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			add_render_callback(() => {
				if (form_outro) form_outro.end(1);
				if (!form_intro) form_intro = create_in_transition(form, slide, {});
				form_intro.start();
			});

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			if (form_intro) form_intro.invalidate();
			form_outro = create_out_transition(form, slide, {});
			current = false;
		},
		d(detaching) {
			if (detaching) detach(form);
			destroy_each(each_blocks, detaching);
			if (detaching && form_outro) form_outro.end();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (37:4) {#each props as { name, attribute_type }
function create_each_block$2(ctx) {
	let div;
	let newmodelinputfield;
	let updating_newProps;
	let current;

	function newmodelinputfield_newProps_binding(value) {
		/*newmodelinputfield_newProps_binding*/ ctx[7].call(null, value);
	}

	let newmodelinputfield_props = {
		attribute_type: /*attribute_type*/ ctx[10],
		name: /*name*/ ctx[9],
		value: "",
		placeholder: /*attribute_type*/ ctx[10]
	};

	if (/*newProps*/ ctx[2] !== void 0) {
		newmodelinputfield_props.newProps = /*newProps*/ ctx[2];
	}

	newmodelinputfield = new NewModelInputField({ props: newmodelinputfield_props });
	binding_callbacks.push(() => bind(newmodelinputfield, "newProps", newmodelinputfield_newProps_binding));

	return {
		c() {
			div = element("div");
			create_component(newmodelinputfield.$$.fragment);
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			claim_component(newmodelinputfield.$$.fragment, div_nodes);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div, "class", "w-5/12 mb-2 mr-4");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			mount_component(newmodelinputfield, div, null);
			current = true;
		},
		p(ctx, dirty) {
			const newmodelinputfield_changes = {};
			if (dirty & /*props*/ 1) newmodelinputfield_changes.attribute_type = /*attribute_type*/ ctx[10];
			if (dirty & /*props*/ 1) newmodelinputfield_changes.name = /*name*/ ctx[9];
			if (dirty & /*props*/ 1) newmodelinputfield_changes.placeholder = /*attribute_type*/ ctx[10];

			if (!updating_newProps && dirty & /*newProps*/ 4) {
				updating_newProps = true;
				newmodelinputfield_changes.newProps = /*newProps*/ ctx[2];
				add_flush_callback(() => updating_newProps = false);
			}

			newmodelinputfield.$set(newmodelinputfield_changes);
		},
		i(local) {
			if (current) return;
			transition_in(newmodelinputfield.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(newmodelinputfield.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_component(newmodelinputfield);
		}
	};
}

function create_fragment$3(ctx) {
	let button;
	let t0;
	let t1;
	let if_block1_anchor;
	let current;
	let mounted;
	let dispose;

	function select_block_type(ctx, dirty) {
		if (/*showNewForm*/ ctx[1]) return create_if_block_1$1;
		return create_else_block$2;
	}

	let current_block_type = select_block_type(ctx);
	let if_block0 = current_block_type(ctx);
	let if_block1 = /*showNewForm*/ ctx[1] && create_if_block$2(ctx);

	return {
		c() {
			button = element("button");
			if_block0.c();
			t0 = text(" New record");
			t1 = space();
			if (if_block1) if_block1.c();
			if_block1_anchor = empty();
			this.h();
		},
		l(nodes) {
			button = claim_element(nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			if_block0.l(button_nodes);
			t0 = claim_text(button_nodes, " New record");
			button_nodes.forEach(detach);
			t1 = claim_space(nodes);
			if (if_block1) if_block1.l(nodes);
			if_block1_anchor = empty();
			this.h();
		},
		h() {
			attr(button, "class", "my-4 ml-auto button");
		},
		m(target, anchor) {
			insert(target, button, anchor);
			if_block0.m(button, null);
			append(button, t0);
			insert(target, t1, anchor);
			if (if_block1) if_block1.m(target, anchor);
			insert(target, if_block1_anchor, anchor);
			current = true;

			if (!mounted) {
				dispose = listen(button, "click", /*click_handler*/ ctx[6]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
				if_block0.d(1);
				if_block0 = current_block_type(ctx);

				if (if_block0) {
					if_block0.c();
					if_block0.m(button, t0);
				}
			}

			if (/*showNewForm*/ ctx[1]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty & /*showNewForm*/ 2) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block$2(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
				}
			} else if (if_block1) {
				group_outros();

				transition_out(if_block1, 1, 1, () => {
					if_block1 = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block1);
			current = true;
		},
		o(local) {
			transition_out(if_block1);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(button);
			if_block0.d();
			if (detaching) detach(t1);
			if (if_block1) if_block1.d(detaching);
			if (detaching) detach(if_block1_anchor);
			mounted = false;
			dispose();
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let showNewForm = false;
	let { schemaId } = $$props;
	let { schemaName } = $$props;
	let { props } = $$props;
	let newProps = {};

	const handleSubmit = () => {
		api.createModel(schemaName, newProps).then(data => {
			if (data) {
				modelsStore.refreshModels(schemaId);
				data && success("Model created.");
				$$invalidate(1, showNewForm = false);
			}
		});
	};

	const click_handler = () => $$invalidate(1, showNewForm = !showNewForm);

	function newmodelinputfield_newProps_binding(value) {
		newProps = value;
		$$invalidate(2, newProps);
	}

	const click_handler_1 = () => $$invalidate(1, showNewForm = !showNewForm);

	$$self.$$set = $$props => {
		if ("schemaId" in $$props) $$invalidate(4, schemaId = $$props.schemaId);
		if ("schemaName" in $$props) $$invalidate(5, schemaName = $$props.schemaName);
		if ("props" in $$props) $$invalidate(0, props = $$props.props);
	};

	return [
		props,
		showNewForm,
		newProps,
		handleSubmit,
		schemaId,
		schemaName,
		click_handler,
		newmodelinputfield_newProps_binding,
		click_handler_1
	];
}

class New extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { schemaId: 4, schemaName: 5, props: 0 });
	}
}

/* src/pages/Models/Manage/_filter.svelte generated by Svelte v3.24.1 */

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[15] = list[i];
	child_ctx[17] = i;
	return child_ctx;
}

// (57:18) {:else}
function create_else_block$1(ctx) {
	let t;

	return {
		c() {
			t = text("+");
		},
		l(nodes) {
			t = claim_text(nodes, "+");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (57:0) {#if showFilters}
function create_if_block_5(ctx) {
	let t;

	return {
		c() {
			t = text("-");
		},
		l(nodes) {
			t = claim_text(nodes, "-");
		},
		m(target, anchor) {
			insert(target, t, anchor);
		},
		d(detaching) {
			if (detaching) detach(t);
		}
	};
}

// (60:0) {#if showFilters}
function create_if_block$1(ctx) {
	let form;
	let select0;
	let option0;
	let t0;
	let t1;
	let select1;
	let option1;
	let t2;
	let option2;
	let t3;
	let option3;
	let t4;
	let option4;
	let t5;
	let if_block0_anchor;
	let if_block1_anchor;
	let t6;
	let input;
	let input_value_value;
	let t7;
	let show_if = /*showValueField*/ ctx[6](/*selectedOperation*/ ctx[2], /*selectedProperty*/ ctx[3]);
	let t8;
	let br;
	let t9;
	let div;
	let button0;
	let t10;
	let t11;
	let button1;
	let t12;
	let form_intro;
	let form_outro;
	let current;
	let mounted;
	let dispose;
	let each_value = /*props*/ ctx[0];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	let if_block0 = (/*selectedProperty*/ ctx[3].attribute_type === "string" || /*selectedProperty*/ ctx[3].attribute_type === "text") && create_if_block_4();
	let if_block1 = (/*selectedProperty*/ ctx[3].attribute_type === "integer" || /*selectedProperty*/ ctx[3].attribute_type === "float") && create_if_block_3();
	let if_block2 = /*selectedProperty*/ ctx[3].attribute_type === "array" && create_if_block_2();
	let if_block3 = show_if && create_if_block_1(ctx);

	return {
		c() {
			form = element("form");
			select0 = element("select");
			option0 = element("option");
			t0 = text("Choose property");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t1 = space();
			select1 = element("select");
			option1 = element("option");
			t2 = text("Choose filter type");
			option2 = element("option");
			t3 = text("contains");
			option3 = element("option");
			t4 = text("exists");
			option4 = element("option");
			t5 = text("not contains");
			if (if_block0) if_block0.c();
			if_block0_anchor = empty();
			if (if_block1) if_block1.c();
			if_block1_anchor = empty();
			if (if_block2) if_block2.c();
			t6 = space();
			input = element("input");
			t7 = space();
			if (if_block3) if_block3.c();
			t8 = space();
			br = element("br");
			t9 = space();
			div = element("div");
			button0 = element("button");
			t10 = text("Filter");
			t11 = space();
			button1 = element("button");
			t12 = text("Cancel");
			this.h();
		},
		l(nodes) {
			form = claim_element(nodes, "FORM", { class: true });
			var form_nodes = children(form);
			select0 = claim_element(form_nodes, "SELECT", { name: true, class: true, required: true });
			var select0_nodes = children(select0);
			option0 = claim_element(select0_nodes, "OPTION", { value: true, class: true });
			var option0_nodes = children(option0);
			t0 = claim_text(option0_nodes, "Choose property");
			option0_nodes.forEach(detach);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(select0_nodes);
			}

			select0_nodes.forEach(detach);
			t1 = claim_space(form_nodes);
			select1 = claim_element(form_nodes, "SELECT", { name: true, class: true, required: true });
			var select1_nodes = children(select1);
			option1 = claim_element(select1_nodes, "OPTION", { value: true, class: true });
			var option1_nodes = children(option1);
			t2 = claim_text(option1_nodes, "Choose filter type");
			option1_nodes.forEach(detach);
			option2 = claim_element(select1_nodes, "OPTION", { value: true });
			var option2_nodes = children(option2);
			t3 = claim_text(option2_nodes, "contains");
			option2_nodes.forEach(detach);
			option3 = claim_element(select1_nodes, "OPTION", { value: true });
			var option3_nodes = children(option3);
			t4 = claim_text(option3_nodes, "exists");
			option3_nodes.forEach(detach);
			option4 = claim_element(select1_nodes, "OPTION", { value: true });
			var option4_nodes = children(option4);
			t5 = claim_text(option4_nodes, "not contains");
			option4_nodes.forEach(detach);
			if (if_block0) if_block0.l(select1_nodes);
			if_block0_anchor = empty();
			if (if_block1) if_block1.l(select1_nodes);
			if_block1_anchor = empty();
			if (if_block2) if_block2.l(select1_nodes);
			select1_nodes.forEach(detach);
			t6 = claim_space(form_nodes);
			input = claim_element(form_nodes, "INPUT", { type: true, name: true, value: true });
			t7 = claim_space(form_nodes);
			if (if_block3) if_block3.l(form_nodes);
			t8 = claim_space(form_nodes);
			br = claim_element(form_nodes, "BR", {});
			t9 = claim_space(form_nodes);
			div = claim_element(form_nodes, "DIV", { class: true });
			var div_nodes = children(div);
			button0 = claim_element(div_nodes, "BUTTON", { class: true });
			var button0_nodes = children(button0);
			t10 = claim_text(button0_nodes, "Filter");
			button0_nodes.forEach(detach);
			t11 = claim_space(div_nodes);
			button1 = claim_element(div_nodes, "BUTTON", { type: true, class: true });
			var button1_nodes = children(button1);
			t12 = claim_text(button1_nodes, "Cancel");
			button1_nodes.forEach(detach);
			div_nodes.forEach(detach);
			form_nodes.forEach(detach);
			this.h();
		},
		h() {
			option0.__value = "";
			option0.value = option0.__value;
			attr(option0, "class", "text-gray-500");
			attr(select0, "name", "property");
			attr(select0, "class", "mr-4 form-select");
			select0.required = true;
			if (/*selectedProperty*/ ctx[3] === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[10].call(select0));
			option1.__value = "";
			option1.value = option1.__value;
			attr(option1, "class", "text-gray-500");
			option2.__value = "contains";
			option2.value = option2.__value;
			option3.__value = "exists";
			option3.value = option3.__value;
			option4.__value = "not_contains";
			option4.value = option4.__value;
			attr(select1, "name", "operation");
			attr(select1, "class", "mr-2 form-select");
			select1.required = true;
			if (/*selectedOperation*/ ctx[2] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[12].call(select1));
			attr(input, "type", "hidden");
			attr(input, "name", "type");
			input.value = input_value_value = /*getPropType*/ ctx[5](/*props*/ ctx[0], /*selectedProperty*/ ctx[3]);
			attr(button0, "class", "button");
			attr(button1, "type", "button");
			attr(button1, "class", "ml-4 button link");
			attr(div, "class", "flex w-full mt-4");
			attr(form, "class", "flex flex-wrap items-center p-6 mb-4 border border-blue-500 rounded");
		},
		m(target, anchor) {
			insert(target, form, anchor);
			append(form, select0);
			append(select0, option0);
			append(option0, t0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(select0, null);
			}

			select_option(select0, /*selectedProperty*/ ctx[3]);
			append(form, t1);
			append(form, select1);
			append(select1, option1);
			append(option1, t2);
			append(select1, option2);
			append(option2, t3);
			append(select1, option3);
			append(option3, t4);
			append(select1, option4);
			append(option4, t5);
			if (if_block0) if_block0.m(select1, null);
			append(select1, if_block0_anchor);
			if (if_block1) if_block1.m(select1, null);
			append(select1, if_block1_anchor);
			if (if_block2) if_block2.m(select1, null);
			select_option(select1, /*selectedOperation*/ ctx[2]);
			append(form, t6);
			append(form, input);
			append(form, t7);
			if (if_block3) if_block3.m(form, null);
			append(form, t8);
			append(form, br);
			append(form, t9);
			append(form, div);
			append(div, button0);
			append(button0, t10);
			append(div, t11);
			append(div, button1);
			append(button1, t12);
			current = true;

			if (!mounted) {
				dispose = [
					listen(select0, "change", /*select0_change_handler*/ ctx[10]),
					listen(select0, "blur", /*blur_handler*/ ctx[11]),
					listen(select1, "change", /*select1_change_handler*/ ctx[12]),
					listen(button1, "click", /*click_handler_1*/ ctx[13]),
					listen(form, "submit", prevent_default(/*handleSubmit*/ ctx[4]))
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*props*/ 1) {
				each_value = /*props*/ ctx[0];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(select0, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}

			if (dirty & /*selectedProperty, props*/ 9) {
				select_option(select0, /*selectedProperty*/ ctx[3]);
			}

			if (/*selectedProperty*/ ctx[3].attribute_type === "string" || /*selectedProperty*/ ctx[3].attribute_type === "text") {
				if (if_block0) ; else {
					if_block0 = create_if_block_4();
					if_block0.c();
					if_block0.m(select1, if_block0_anchor);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*selectedProperty*/ ctx[3].attribute_type === "integer" || /*selectedProperty*/ ctx[3].attribute_type === "float") {
				if (if_block1) ; else {
					if_block1 = create_if_block_3();
					if_block1.c();
					if_block1.m(select1, if_block1_anchor);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (/*selectedProperty*/ ctx[3].attribute_type === "array") {
				if (if_block2) ; else {
					if_block2 = create_if_block_2();
					if_block2.c();
					if_block2.m(select1, null);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (dirty & /*selectedOperation*/ 4) {
				select_option(select1, /*selectedOperation*/ ctx[2]);
			}

			if (!current || dirty & /*props, selectedProperty*/ 9 && input_value_value !== (input_value_value = /*getPropType*/ ctx[5](/*props*/ ctx[0], /*selectedProperty*/ ctx[3]))) {
				input.value = input_value_value;
			}

			if (dirty & /*selectedOperation, selectedProperty*/ 12) show_if = /*showValueField*/ ctx[6](/*selectedOperation*/ ctx[2], /*selectedProperty*/ ctx[3]);

			if (show_if) {
				if (if_block3) {
					if_block3.p(ctx, dirty);
				} else {
					if_block3 = create_if_block_1(ctx);
					if_block3.c();
					if_block3.m(form, t8);
				}
			} else if (if_block3) {
				if_block3.d(1);
				if_block3 = null;
			}
		},
		i(local) {
			if (current) return;

			add_render_callback(() => {
				if (form_outro) form_outro.end(1);
				if (!form_intro) form_intro = create_in_transition(form, slide, {});
				form_intro.start();
			});

			current = true;
		},
		o(local) {
			if (form_intro) form_intro.invalidate();
			form_outro = create_out_transition(form, slide, {});
			current = false;
		},
		d(detaching) {
			if (detaching) detach(form);
			destroy_each(each_blocks, detaching);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (if_block3) if_block3.d();
			if (detaching && form_outro) form_outro.end();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (70:6) {#each props as prop, i}
function create_each_block$1(ctx) {
	let option;
	let t0_value = /*prop*/ ctx[15].name + "";
	let t0;
	let t1;
	let t2_value = /*prop*/ ctx[15].attribute_type + "";
	let t2;
	let t3;
	let option_value_value;

	return {
		c() {
			option = element("option");
			t0 = text(t0_value);
			t1 = text(" (");
			t2 = text(t2_value);
			t3 = text(")");
			this.h();
		},
		l(nodes) {
			option = claim_element(nodes, "OPTION", { value: true });
			var option_nodes = children(option);
			t0 = claim_text(option_nodes, t0_value);
			t1 = claim_text(option_nodes, " (");
			t2 = claim_text(option_nodes, t2_value);
			t3 = claim_text(option_nodes, ")");
			option_nodes.forEach(detach);
			this.h();
		},
		h() {
			option.__value = option_value_value = /*prop*/ ctx[15].name;
			option.value = option.__value;
		},
		m(target, anchor) {
			insert(target, option, anchor);
			append(option, t0);
			append(option, t1);
			append(option, t2);
			append(option, t3);
		},
		p(ctx, dirty) {
			if (dirty & /*props*/ 1 && t0_value !== (t0_value = /*prop*/ ctx[15].name + "")) set_data(t0, t0_value);
			if (dirty & /*props*/ 1 && t2_value !== (t2_value = /*prop*/ ctx[15].attribute_type + "")) set_data(t2, t2_value);

			if (dirty & /*props*/ 1 && option_value_value !== (option_value_value = /*prop*/ ctx[15].name)) {
				option.__value = option_value_value;
				option.value = option.__value;
			}
		},
		d(detaching) {
			if (detaching) detach(option);
		}
	};
}

// (82:6) {#if selectedProperty.attribute_type === 'string' || selectedProperty.attribute_type === 'text'}
function create_if_block_4(ctx) {
	let option0;
	let t0;
	let option1;
	let t1;
	let option2;
	let t2;
	let option3;
	let t3;

	return {
		c() {
			option0 = element("option");
			t0 = text("ends with");
			option1 = element("option");
			t1 = text("starts with");
			option2 = element("option");
			t2 = text("not ends with");
			option3 = element("option");
			t3 = text("not starts with");
			this.h();
		},
		l(nodes) {
			option0 = claim_element(nodes, "OPTION", { value: true });
			var option0_nodes = children(option0);
			t0 = claim_text(option0_nodes, "ends with");
			option0_nodes.forEach(detach);
			option1 = claim_element(nodes, "OPTION", { value: true });
			var option1_nodes = children(option1);
			t1 = claim_text(option1_nodes, "starts with");
			option1_nodes.forEach(detach);
			option2 = claim_element(nodes, "OPTION", { value: true });
			var option2_nodes = children(option2);
			t2 = claim_text(option2_nodes, "not ends with");
			option2_nodes.forEach(detach);
			option3 = claim_element(nodes, "OPTION", { value: true });
			var option3_nodes = children(option3);
			t3 = claim_text(option3_nodes, "not starts with");
			option3_nodes.forEach(detach);
			this.h();
		},
		h() {
			option0.__value = "ends_with";
			option0.value = option0.__value;
			option1.__value = "starts_with";
			option1.value = option1.__value;
			option2.__value = "not_ends_with";
			option2.value = option2.__value;
			option3.__value = "not_starts_with";
			option3.value = option3.__value;
		},
		m(target, anchor) {
			insert(target, option0, anchor);
			append(option0, t0);
			insert(target, option1, anchor);
			append(option1, t1);
			insert(target, option2, anchor);
			append(option2, t2);
			insert(target, option3, anchor);
			append(option3, t3);
		},
		d(detaching) {
			if (detaching) detach(option0);
			if (detaching) detach(option1);
			if (detaching) detach(option2);
			if (detaching) detach(option3);
		}
	};
}

// (89:6) {#if selectedProperty.attribute_type === 'integer' || selectedProperty.attribute_type === 'float'}
function create_if_block_3(ctx) {
	let option;
	let t;

	return {
		c() {
			option = element("option");
			t = text("range");
			this.h();
		},
		l(nodes) {
			option = claim_element(nodes, "OPTION", { value: true });
			var option_nodes = children(option);
			t = claim_text(option_nodes, "range");
			option_nodes.forEach(detach);
			this.h();
		},
		h() {
			option.__value = "range";
			option.value = option.__value;
		},
		m(target, anchor) {
			insert(target, option, anchor);
			append(option, t);
		},
		d(detaching) {
			if (detaching) detach(option);
		}
	};
}

// (93:6) {#if selectedProperty.attribute_type === 'array'}
function create_if_block_2(ctx) {
	let option0;
	let t0;
	let option1;
	let t1;

	return {
		c() {
			option0 = element("option");
			t0 = text("value in");
			option1 = element("option");
			t1 = text("not value in");
			this.h();
		},
		l(nodes) {
			option0 = claim_element(nodes, "OPTION", { value: true });
			var option0_nodes = children(option0);
			t0 = claim_text(option0_nodes, "value in");
			option0_nodes.forEach(detach);
			option1 = claim_element(nodes, "OPTION", { value: true });
			var option1_nodes = children(option1);
			t1 = claim_text(option1_nodes, "not value in");
			option1_nodes.forEach(detach);
			this.h();
		},
		h() {
			option0.__value = "value_in";
			option0.value = option0.__value;
			option1.__value = "not_value_in";
			option1.value = option1.__value;
		},
		m(target, anchor) {
			insert(target, option0, anchor);
			append(option0, t0);
			insert(target, option1, anchor);
			append(option1, t1);
		},
		d(detaching) {
			if (detaching) detach(option0);
			if (detaching) detach(option1);
		}
	};
}

// (101:4) {#if showValueField(selectedOperation, selectedProperty)}
function create_if_block_1(ctx) {
	let input;
	let t0;
	let p;
	let t1;
	let t2_value = /*getHint*/ ctx[7](/*selectedOperation*/ ctx[2]) + "";
	let t2;

	return {
		c() {
			input = element("input");
			t0 = space();
			p = element("p");
			t1 = text("Example: ");
			t2 = text(t2_value);
			this.h();
		},
		l(nodes) {
			input = claim_element(nodes, "INPUT", { type: true, name: true, class: true });
			t0 = claim_space(nodes);
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t1 = claim_text(p_nodes, "Example: ");
			t2 = claim_text(p_nodes, t2_value);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(input, "type", "text");
			attr(input, "name", "value");
			attr(input, "class", "w-64 form-input");
			attr(p, "class", "ml-4 text-gray-600");
		},
		m(target, anchor) {
			insert(target, input, anchor);
			insert(target, t0, anchor);
			insert(target, p, anchor);
			append(p, t1);
			append(p, t2);
		},
		p(ctx, dirty) {
			if (dirty & /*selectedOperation*/ 4 && t2_value !== (t2_value = /*getHint*/ ctx[7](/*selectedOperation*/ ctx[2]) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) detach(input);
			if (detaching) detach(t0);
			if (detaching) detach(p);
		}
	};
}

function create_fragment$2(ctx) {
	let button;
	let t0;
	let t1;
	let if_block1_anchor;
	let current;
	let mounted;
	let dispose;

	function select_block_type(ctx, dirty) {
		if (/*showFilters*/ ctx[1]) return create_if_block_5;
		return create_else_block$1;
	}

	let current_block_type = select_block_type(ctx);
	let if_block0 = current_block_type(ctx);
	let if_block1 = /*showFilters*/ ctx[1] && create_if_block$1(ctx);

	return {
		c() {
			button = element("button");
			if_block0.c();
			t0 = text(" Filter");
			t1 = space();
			if (if_block1) if_block1.c();
			if_block1_anchor = empty();
			this.h();
		},
		l(nodes) {
			button = claim_element(nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			if_block0.l(button_nodes);
			t0 = claim_text(button_nodes, " Filter");
			button_nodes.forEach(detach);
			t1 = claim_space(nodes);
			if (if_block1) if_block1.l(nodes);
			if_block1_anchor = empty();
			this.h();
		},
		h() {
			attr(button, "class", "my-4 ml-auto button");
		},
		m(target, anchor) {
			insert(target, button, anchor);
			if_block0.m(button, null);
			append(button, t0);
			insert(target, t1, anchor);
			if (if_block1) if_block1.m(target, anchor);
			insert(target, if_block1_anchor, anchor);
			current = true;

			if (!mounted) {
				dispose = listen(button, "click", /*click_handler*/ ctx[9]);
				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
				if_block0.d(1);
				if_block0 = current_block_type(ctx);

				if (if_block0) {
					if_block0.c();
					if_block0.m(button, t0);
				}
			}

			if (/*showFilters*/ ctx[1]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty & /*showFilters*/ 2) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block$1(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
				}
			} else if (if_block1) {
				group_outros();

				transition_out(if_block1, 1, 1, () => {
					if_block1 = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block1);
			current = true;
		},
		o(local) {
			transition_out(if_block1);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(button);
			if_block0.d();
			if (detaching) detach(t1);
			if (if_block1) if_block1.d(detaching);
			if (detaching) detach(if_block1_anchor);
			mounted = false;
			dispose();
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	createEventDispatcher();
	let { props } = $$props;
	let { schemaId } = $$props;
	let showFilters = false;
	let selectedOperation = "";
	let selectedProperty = "";

	const handleSubmit = evt => {
		const form = evt.target;
		const fd = new FormData(form);
		const filters = Object.fromEntries(fd);
		filtersStore.set(filters);
		modelsStore.refreshModels(schemaId);
		info("Refreshing models...");
	};

	const getPropType = (props, name) => {
		const prop = props.find(prop => prop.name === name);

		if (prop) {
			return prop.attribute_type;
		}
	};

	const showValueField = (op, { attribute_type: type }) => {
		if (op === "value-in" || op === "value-not-in") {
			if (type === "array") return true;
			return false;
		}

		return true;
	};

	const getHint = op => {
		if (op === "range") return "{ gt: \"10\", lt: \"20\" } - remember about JSON format and double quotes";
		if (op === "value_in" || op === "not_value_in") return "[10, \"platformOS\", 30] - remember about square brackets and double quotes";
		if (op === "ends_with" || op === "not-ends-with") return "\"platformOS\" - remember about double quotes";
		if (op === "starts_with" || op === "not-starts-with") return "\"platformOS\" - remember about double quotes";
		if (op === "exists" || op === "not-starts-with") return "true - booleans are NOT inside quotes";
		return "\"platformOS\" - remember about double quotes";
	};

	const click_handler = () => $$invalidate(1, showFilters = !showFilters);

	function select0_change_handler() {
		selectedProperty = select_value(this);
		$$invalidate(3, selectedProperty);
		$$invalidate(0, props);
	}

	const blur_handler = () => $$invalidate(2, selectedOperation = undefined);

	function select1_change_handler() {
		selectedOperation = select_value(this);
		$$invalidate(2, selectedOperation);
	}

	const click_handler_1 = () => {
		filtersStore.reset();
		$$invalidate(1, showFilters = false);
	};

	$$self.$$set = $$props => {
		if ("props" in $$props) $$invalidate(0, props = $$props.props);
		if ("schemaId" in $$props) $$invalidate(8, schemaId = $$props.schemaId);
	};

	return [
		props,
		showFilters,
		selectedOperation,
		selectedProperty,
		handleSubmit,
		getPropType,
		showValueField,
		getHint,
		schemaId,
		click_handler,
		select0_change_handler,
		blur_handler,
		select1_change_handler,
		click_handler_1
	];
}

class Filter extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { props: 0, schemaId: 8 });
	}
}

/* src/pages/Models/Manage/_pagination.svelte generated by Svelte v3.24.1 */

function create_fragment$1(ctx) {
	let ul;
	let li0;
	let button0;
	let t0;
	let t1;
	let li1;
	let t2;
	let t3_value = /*$pageStore*/ ctx[0].total_pages + "";
	let t3;
	let t4;
	let li2;
	let t5;
	let t6_value = /*$pageStore*/ ctx[0].page + "";
	let t6;
	let t7;
	let li3;
	let button1;
	let t8;
	let mounted;
	let dispose;

	return {
		c() {
			ul = element("ul");
			li0 = element("li");
			button0 = element("button");
			t0 = text("Previous page");
			t1 = space();
			li1 = element("li");
			t2 = text("Total Pages: ");
			t3 = text(t3_value);
			t4 = space();
			li2 = element("li");
			t5 = text("Current page: ");
			t6 = text(t6_value);
			t7 = space();
			li3 = element("li");
			button1 = element("button");
			t8 = text("Next page");
			this.h();
		},
		l(nodes) {
			ul = claim_element(nodes, "UL", { class: true });
			var ul_nodes = children(ul);
			li0 = claim_element(ul_nodes, "LI", {});
			var li0_nodes = children(li0);
			button0 = claim_element(li0_nodes, "BUTTON", { class: true });
			var button0_nodes = children(button0);
			t0 = claim_text(button0_nodes, "Previous page");
			button0_nodes.forEach(detach);
			li0_nodes.forEach(detach);
			t1 = claim_space(ul_nodes);
			li1 = claim_element(ul_nodes, "LI", {});
			var li1_nodes = children(li1);
			t2 = claim_text(li1_nodes, "Total Pages: ");
			t3 = claim_text(li1_nodes, t3_value);
			li1_nodes.forEach(detach);
			t4 = claim_space(ul_nodes);
			li2 = claim_element(ul_nodes, "LI", {});
			var li2_nodes = children(li2);
			t5 = claim_text(li2_nodes, "Current page: ");
			t6 = claim_text(li2_nodes, t6_value);
			li2_nodes.forEach(detach);
			t7 = claim_space(ul_nodes);
			li3 = claim_element(ul_nodes, "LI", {});
			var li3_nodes = children(li3);
			button1 = claim_element(li3_nodes, "BUTTON", { class: true });
			var button1_nodes = children(button1);
			t8 = claim_text(button1_nodes, "Next page");
			button1_nodes.forEach(detach);
			li3_nodes.forEach(detach);
			ul_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(button0, "class", "button secondary");
			attr(button1, "class", "button secondary");
			attr(ul, "class", "flex justify-between");
		},
		m(target, anchor) {
			insert(target, ul, anchor);
			append(ul, li0);
			append(li0, button0);
			append(button0, t0);
			append(ul, t1);
			append(ul, li1);
			append(li1, t2);
			append(li1, t3);
			append(ul, t4);
			append(ul, li2);
			append(li2, t5);
			append(li2, t6);
			append(ul, t7);
			append(ul, li3);
			append(li3, button1);
			append(button1, t8);

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*decrementPage*/ ctx[2]),
					listen(button1, "click", /*incrementPage*/ ctx[1])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*$pageStore*/ 1 && t3_value !== (t3_value = /*$pageStore*/ ctx[0].total_pages + "")) set_data(t3, t3_value);
			if (dirty & /*$pageStore*/ 1 && t6_value !== (t6_value = /*$pageStore*/ ctx[0].page + "")) set_data(t6, t6_value);
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(ul);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	let $pageStore;
	component_subscribe($$self, pageStore, $$value => $$invalidate(0, $pageStore = $$value));

	const incrementPage = () => {
		pageStore.increment();
		const ps = get_store_value(pageStore);
		modelsStore.refreshModels(ps.schemaId, ps.page);
	};

	const decrementPage = () => {
		pageStore.decrement();
		const ps = get_store_value(pageStore);
		modelsStore.refreshModels(ps.schemaId, ps.page);
	};

	return [$pageStore, incrementPage, decrementPage];
}

class Pagination extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
	}
}

/* src/pages/Models/Manage/[id].svelte generated by Svelte v3.24.1 */

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[24] = list[i].name;
	child_ctx[25] = list[i].attribute_type;
	child_ctx[23] = i;
	return child_ctx;
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[17] = list[i].id;
	child_ctx[18] = list[i].created_at;
	child_ctx[19] = list[i].updated_at;
	child_ctx[20] = list[i].deleted_at;
	child_ctx[21] = list[i].properties;
	child_ctx[23] = i;
	return child_ctx;
}

// (120:12) {#each props as { name, attribute_type }
function create_each_block_1(ctx) {
	let div;
	let inputfield;
	let current;

	inputfield = new InputField({
			props: {
				attribute_type: /*attribute_type*/ ctx[25],
				name: /*name*/ ctx[24],
				id: /*id*/ ctx[17],
				value: /*properties*/ ctx[21][/*name*/ ctx[24]]
			}
		});

	inputfield.$on("formChanged", /*handleFormChanged*/ ctx[6]);

	return {
		c() {
			div = element("div");
			create_component(inputfield.$$.fragment);
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			claim_component(inputfield.$$.fragment, div_nodes);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div, "class", "w-5/12 mb-3 mr-4");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			mount_component(inputfield, div, null);
			current = true;
		},
		p(ctx, dirty) {
			const inputfield_changes = {};
			if (dirty & /*props*/ 8) inputfield_changes.attribute_type = /*attribute_type*/ ctx[25];
			if (dirty & /*props*/ 8) inputfield_changes.name = /*name*/ ctx[24];
			if (dirty & /*data*/ 4) inputfield_changes.id = /*id*/ ctx[17];
			if (dirty & /*data, props*/ 12) inputfield_changes.value = /*properties*/ ctx[21][/*name*/ ctx[24]];
			inputfield.$set(inputfield_changes);
		},
		i(local) {
			if (current) return;
			transition_in(inputfield.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(inputfield.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_component(inputfield);
		}
	};
}

// (141:12) {:else}
function create_else_block(ctx) {
	let button;
	let t;
	let mounted;
	let dispose;

	function click_handler_3(...args) {
		return /*click_handler_3*/ ctx[13](/*id*/ ctx[17], ...args);
	}

	return {
		c() {
			button = element("button");
			t = text("Delete");
			this.h();
		},
		l(nodes) {
			button = claim_element(nodes, "BUTTON", { class: true, type: true });
			var button_nodes = children(button);
			t = claim_text(button_nodes, "Delete");
			button_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(button, "class", "ml-auto button danger");
			attr(button, "type", "button");
		},
		m(target, anchor) {
			insert(target, button, anchor);
			append(button, t);

			if (!mounted) {
				dispose = listen(button, "click", click_handler_3);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (134:12) {#if deleted_at}
function create_if_block(ctx) {
	let div;
	let p;
	let t0;
	let br;
	let t1;
	let t2_value = getTime(/*deleted_at*/ ctx[20]) + "";
	let t2;
	let t3;
	let button;
	let t4;
	let mounted;
	let dispose;

	function click_handler_2(...args) {
		return /*click_handler_2*/ ctx[12](/*id*/ ctx[17], ...args);
	}

	return {
		c() {
			div = element("div");
			p = element("p");
			t0 = text("This record was deleted at: ");
			br = element("br");
			t1 = space();
			t2 = text(t2_value);
			t3 = space();
			button = element("button");
			t4 = text("Restore record");
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			p = claim_element(div_nodes, "P", { class: true });
			var p_nodes = children(p);
			t0 = claim_text(p_nodes, "This record was deleted at: ");
			br = claim_element(p_nodes, "BR", {});
			t1 = claim_space(p_nodes);
			t2 = claim_text(p_nodes, t2_value);
			p_nodes.forEach(detach);
			t3 = claim_space(div_nodes);
			button = claim_element(div_nodes, "BUTTON", { class: true, type: true });
			var button_nodes = children(button);
			t4 = claim_text(button_nodes, "Restore record");
			button_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "mb-2");
			attr(button, "class", "button secondary");
			attr(button, "type", "button");
			attr(div, "class", "w-64 ml-auto");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, p);
			append(p, t0);
			append(p, br);
			append(p, t1);
			append(p, t2);
			append(div, t3);
			append(div, button);
			append(button, t4);

			if (!mounted) {
				dispose = listen(button, "click", click_handler_2);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty & /*data*/ 4 && t2_value !== (t2_value = getTime(/*deleted_at*/ ctx[20]) + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			dispose();
		}
	};
}

// (104:2) {#each data as { id, created_at, updated_at, deleted_at, properties }
function create_each_block(key_1, ctx) {
	let article;
	let div2;
	let div1;
	let header;
	let h3;
	let t0;
	let t1_value = /*id*/ ctx[17] + "";
	let t1;
	let t2;
	let p;
	let t3;
	let t4_value = getTime(/*created_at*/ ctx[18]) + "";
	let t4;
	let t5;
	let br;
	let t6;
	let t7_value = getTime(/*updated_at*/ ctx[19]) + "";
	let t7;
	let t8;
	let form;
	let t9;
	let div0;
	let button;
	let t10;
	let t11;
	let footer;
	let t12;
	let article_transition;
	let current;
	let mounted;
	let dispose;
	let each_value_1 = /*props*/ ctx[3];
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	function submit_handler(...args) {
		return /*submit_handler*/ ctx[11](/*id*/ ctx[17], ...args);
	}

	function select_block_type(ctx, dirty) {
		if (/*deleted_at*/ ctx[20]) return create_if_block;
		return create_else_block;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	return {
		key: key_1,
		first: null,
		c() {
			article = element("article");
			div2 = element("div");
			div1 = element("div");
			header = element("header");
			h3 = element("h3");
			t0 = text("ID: ");
			t1 = text(t1_value);
			t2 = space();
			p = element("p");
			t3 = text("Created: ");
			t4 = text(t4_value);
			t5 = space();
			br = element("br");
			t6 = text("\n              Updated: ");
			t7 = text(t7_value);
			t8 = space();
			form = element("form");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t9 = space();
			div0 = element("div");
			button = element("button");
			t10 = text("Save");
			t11 = space();
			footer = element("footer");
			if_block.c();
			t12 = space();
			this.h();
		},
		l(nodes) {
			article = claim_element(nodes, "ARTICLE", { class: true });
			var article_nodes = children(article);
			div2 = claim_element(article_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			header = claim_element(div1_nodes, "HEADER", { class: true });
			var header_nodes = children(header);
			h3 = claim_element(header_nodes, "H3", { class: true });
			var h3_nodes = children(h3);
			t0 = claim_text(h3_nodes, "ID: ");
			t1 = claim_text(h3_nodes, t1_value);
			h3_nodes.forEach(detach);
			t2 = claim_space(header_nodes);
			p = claim_element(header_nodes, "P", { class: true });
			var p_nodes = children(p);
			t3 = claim_text(p_nodes, "Created: ");
			t4 = claim_text(p_nodes, t4_value);
			t5 = claim_space(p_nodes);
			br = claim_element(p_nodes, "BR", {});
			t6 = claim_text(p_nodes, "\n              Updated: ");
			t7 = claim_text(p_nodes, t7_value);
			p_nodes.forEach(detach);
			header_nodes.forEach(detach);
			t8 = claim_space(div1_nodes);
			form = claim_element(div1_nodes, "FORM", { class: true });
			var form_nodes = children(form);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(form_nodes);
			}

			t9 = claim_space(form_nodes);
			div0 = claim_element(form_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			button = claim_element(div0_nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			t10 = claim_text(button_nodes, "Save");
			button_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			form_nodes.forEach(detach);
			t11 = claim_space(div1_nodes);
			footer = claim_element(div1_nodes, "FOOTER", { class: true });
			var footer_nodes = children(footer);
			if_block.l(footer_nodes);
			footer_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			t12 = claim_space(article_nodes);
			article_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h3, "class", "text-3xl font-light");
			attr(p, "class", "ml-auto");
			attr(header, "class", "flex pb-6 mb-6 border-b border-blue-600");
			attr(button, "class", "button");
			attr(div0, "class", "w-full mt-4");
			attr(form, "class", "flex flex-wrap");
			attr(footer, "class", "flex");
			attr(div1, "class", "h-full p-8 bg-gray-200 rounded");
			toggle_class(div1, "bg-red-200", /*deleted_at*/ ctx[20]);
			attr(div2, "class", "w-full");
			attr(article, "class", "flex flex-wrap w-full mb-6");
			this.first = article;
		},
		m(target, anchor) {
			insert(target, article, anchor);
			append(article, div2);
			append(div2, div1);
			append(div1, header);
			append(header, h3);
			append(h3, t0);
			append(h3, t1);
			append(header, t2);
			append(header, p);
			append(p, t3);
			append(p, t4);
			append(p, t5);
			append(p, br);
			append(p, t6);
			append(p, t7);
			append(div1, t8);
			append(div1, form);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(form, null);
			}

			append(form, t9);
			append(form, div0);
			append(div0, button);
			append(button, t10);
			append(div1, t11);
			append(div1, footer);
			if_block.m(footer, null);
			append(article, t12);
			current = true;

			if (!mounted) {
				dispose = listen(form, "submit", prevent_default(submit_handler));
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if ((!current || dirty & /*data*/ 4) && t1_value !== (t1_value = /*id*/ ctx[17] + "")) set_data(t1, t1_value);
			if ((!current || dirty & /*data*/ 4) && t4_value !== (t4_value = getTime(/*created_at*/ ctx[18]) + "")) set_data(t4, t4_value);
			if ((!current || dirty & /*data*/ 4) && t7_value !== (t7_value = getTime(/*updated_at*/ ctx[19]) + "")) set_data(t7, t7_value);

			if (dirty & /*props, data, handleFormChanged*/ 76) {
				each_value_1 = /*props*/ ctx[3];
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(form, t9);
					}
				}

				group_outros();

				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(footer, null);
				}
			}

			if (dirty & /*data*/ 4) {
				toggle_class(div1, "bg-red-200", /*deleted_at*/ ctx[20]);
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value_1.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			add_render_callback(() => {
				if (!article_transition) article_transition = create_bidirectional_transition(article, slide, {}, true);
				article_transition.run(1);
			});

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			if (!article_transition) article_transition = create_bidirectional_transition(article, slide, {}, false);
			article_transition.run(0);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(article);
			destroy_each(each_blocks, detaching);
			if_block.d();
			if (detaching && article_transition) article_transition.end();
			mounted = false;
			dispose();
		}
	};
}

function create_fragment(ctx) {
	let div4;
	let div0;
	let h1;
	let t0;
	let t1;
	let div1;
	let newmodel;
	let t2;
	let div2;
	let filter;
	let t3;
	let div3;
	let button0;
	let t4;
	let t5;
	let button1;
	let t6;
	let t7;
	let section;
	let each_blocks = [];
	let each_1_lookup = new Map();
	let t8;
	let pagination;
	let current;
	let mounted;
	let dispose;

	newmodel = new New({
			props: {
				props: /*props*/ ctx[3],
				schemaName: /*schemaName*/ ctx[0]
			}
		});

	filter = new Filter({
			props: {
				props: /*props*/ ctx[3],
				schemaId: /*schemaId*/ ctx[4]
			}
		});

	let each_value = /*data*/ ctx[2];
	const get_key = ctx => /*id*/ ctx[17];

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context(ctx, each_value, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
	}

	pagination = new Pagination({});

	return {
		c() {
			div4 = element("div");
			div0 = element("div");
			h1 = element("h1");
			t0 = text(/*schemaName*/ ctx[0]);
			t1 = space();
			div1 = element("div");
			create_component(newmodel.$$.fragment);
			t2 = space();
			div2 = element("div");
			create_component(filter.$$.fragment);
			t3 = space();
			div3 = element("div");
			button0 = element("button");
			t4 = text("Show non-deleted");
			t5 = space();
			button1 = element("button");
			t6 = text("Show deleted");
			t7 = space();
			section = element("section");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t8 = space();
			create_component(pagination.$$.fragment);
			this.h();
		},
		l(nodes) {
			div4 = claim_element(nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			div0 = claim_element(div4_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			h1 = claim_element(div0_nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t0 = claim_text(h1_nodes, /*schemaName*/ ctx[0]);
			h1_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t1 = claim_space(div4_nodes);
			div1 = claim_element(div4_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			claim_component(newmodel.$$.fragment, div1_nodes);
			div1_nodes.forEach(detach);
			t2 = claim_space(div4_nodes);
			div2 = claim_element(div4_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			claim_component(filter.$$.fragment, div2_nodes);
			div2_nodes.forEach(detach);
			t3 = claim_space(div4_nodes);
			div3 = claim_element(div4_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			button0 = claim_element(div3_nodes, "BUTTON", { type: true, class: true });
			var button0_nodes = children(button0);
			t4 = claim_text(button0_nodes, "Show non-deleted");
			button0_nodes.forEach(detach);
			t5 = claim_space(div3_nodes);
			button1 = claim_element(div3_nodes, "BUTTON", { type: true, class: true });
			var button1_nodes = children(button1);
			t6 = claim_text(button1_nodes, "Show deleted");
			button1_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			t7 = claim_space(nodes);
			section = claim_element(nodes, "SECTION", { class: true });
			var section_nodes = children(section);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(section_nodes);
			}

			section_nodes.forEach(detach);
			t8 = claim_space(nodes);
			claim_component(pagination.$$.fragment, nodes);
			this.h();
		},
		h() {
			attr(h1, "class", "text-4xl");
			attr(div0, "class", "w-1/2");
			attr(div1, "class", "w-full");
			attr(div2, "class", "w-full");
			attr(button0, "type", "button");
			attr(button0, "class", "mr-4 button secondary");
			toggle_class(button0, "active", /*show*/ ctx[1] === "nondeleted");
			attr(button1, "type", "button");
			attr(button1, "class", "button secondary");
			toggle_class(button1, "active", /*show*/ ctx[1] === "deleted");
			attr(div3, "class", "flex w-full");
			attr(div4, "class", "flex flex-wrap mb-6");
			attr(section, "class", "flex flex-wrap text-gray-700 ");
		},
		m(target, anchor) {
			insert(target, div4, anchor);
			append(div4, div0);
			append(div0, h1);
			append(h1, t0);
			append(div4, t1);
			append(div4, div1);
			mount_component(newmodel, div1, null);
			append(div4, t2);
			append(div4, div2);
			mount_component(filter, div2, null);
			append(div4, t3);
			append(div4, div3);
			append(div3, button0);
			append(button0, t4);
			append(div3, t5);
			append(div3, button1);
			append(button1, t6);
			insert(target, t7, anchor);
			insert(target, section, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(section, null);
			}

			insert(target, t8, anchor);
			mount_component(pagination, target, anchor);
			current = true;

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*click_handler*/ ctx[9]),
					listen(button1, "click", /*click_handler_1*/ ctx[10])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (!current || dirty & /*schemaName*/ 1) set_data(t0, /*schemaName*/ ctx[0]);
			const newmodel_changes = {};
			if (dirty & /*props*/ 8) newmodel_changes.props = /*props*/ ctx[3];
			if (dirty & /*schemaName*/ 1) newmodel_changes.schemaName = /*schemaName*/ ctx[0];
			newmodel.$set(newmodel_changes);
			const filter_changes = {};
			if (dirty & /*props*/ 8) filter_changes.props = /*props*/ ctx[3];
			filter.$set(filter_changes);

			if (dirty & /*show*/ 2) {
				toggle_class(button0, "active", /*show*/ ctx[1] === "nondeleted");
			}

			if (dirty & /*show*/ 2) {
				toggle_class(button1, "active", /*show*/ ctx[1] === "deleted");
			}

			if (dirty & /*data, handleUndelete, getTime, handleDelete, handleUpdateModel, props, handleFormChanged*/ 492) {
				const each_value = /*data*/ ctx[2];
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, section, outro_and_destroy_block, create_each_block, null, get_each_context);
				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(newmodel.$$.fragment, local);
			transition_in(filter.$$.fragment, local);

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			transition_in(pagination.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(newmodel.$$.fragment, local);
			transition_out(filter.$$.fragment, local);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			transition_out(pagination.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div4);
			destroy_component(newmodel);
			destroy_component(filter);
			if (detaching) detach(t7);
			if (detaching) detach(section);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}

			if (detaching) detach(t8);
			destroy_component(pagination, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let $params;
	let $modelsStore;
	component_subscribe($$self, params, $$value => $$invalidate(15, $params = $$value));
	component_subscribe($$self, modelsStore, $$value => $$invalidate(16, $modelsStore = $$value));
	const schemaId = $params.id;
	let schemaName;
	let show = "nondeleted";
	let data = [];
	let props = [];

	onMount(() => {
		pageStore.setSchemaId(schemaId);
		modelsStore.refreshModels(schemaId);

		api.getModelSchemas(schemaId).then(schema => {
			$$invalidate(0, schemaName = schema[0].name);
			$$invalidate(3, props = schema[0].properties);
		});
	});

	const handleDelete = id => {
		const confirmation = confirm("Are you sure you want to delete this record?");
		if (!confirmation) return;

		api.deleteModel(id).then(data => {
			modelsStore.refreshModels(schemaId);
			data && success("Model deleted.");
		});
	};

	const formCache = {};

	const handleFormChanged = ({ detail }) => {
		// FIXME: MONSTER - Maybe use store for that?
		const currentData = formCache[detail.id] || {};

		const model = Object.assign({}, currentData, detail.props);
		formCache[detail.id] = model;
	};

	const handleUpdateModel = ({ id }) => {
		api.updateModel({ id, props: formCache[id] }).then(data => {
			data && success("Model updated.");
		});
	};

	const handleUndelete = id => {
		api.undeleteModel(id).then(data => {
			modelsStore.refreshModels(schemaId);
			data && success("Model restored.");
		});
	};

	const click_handler = () => $$invalidate(1, show = "nondeleted");
	const click_handler_1 = () => $$invalidate(1, show = "deleted");
	const submit_handler = (id, e) => handleUpdateModel({ id });
	const click_handler_2 = id => handleUndelete(id);
	const click_handler_3 = id => handleDelete(id);

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*show, $modelsStore*/ 65538) {
			if (show === "nondeleted") {
				$$invalidate(2, data = $modelsStore.filter(m => !m.deleted_at));
			} else {
				$$invalidate(2, data = $modelsStore.filter(m => m.deleted_at));
			}
		}
	};

	return [
		schemaName,
		show,
		data,
		props,
		schemaId,
		handleDelete,
		handleFormChanged,
		handleUpdateModel,
		handleUndelete,
		click_handler,
		click_handler_1,
		submit_handler,
		click_handler_2,
		click_handler_3
	];
}

class U5Bidu5D extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, {});
	}
}

export default U5Bidu5D;
