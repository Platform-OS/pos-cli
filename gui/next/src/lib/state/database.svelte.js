/*
  database tables and the record being edited

  usage: import { databaseState } from '#lib/state/database.svelte.js'

  The records shown, and the page, sorting, filter and deleted switch they are shown with,
  are not here: they come from the table page's load function and the url
  (see #lib/database/query.js).
*/


class Database {
  // tables for current instance (array)
  tables = $state([]);
  // id of the table being viewed, from the url (string or null)
  tableId = $state(null);
  // currently viewed table (object or undefined)
  table = $derived(this.tables.find(table => table.id === this.tableId));
  // currently viewed/edited record (object or null)
  record = $state(null);
}

const databaseState = new Database();



// exports
// ------------------------------------------------------------------------
export { databaseState };
