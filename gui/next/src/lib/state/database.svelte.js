/*
  database tables and the records currently viewed

  usage: import { databaseState } from '#lib/state/database.svelte.js'
*/


const defaultFilters = () => ({
  page: 1,
  attributes: [
    { attribute_type: 'id', name: 'id', operation: 'value', value: '' }
  ],
  deleted: 'false'
});

const defaultSort = () => ({
  by: 'created_at',
  order: 'DESC'
});


class Database {
  // tables for current instance (array)
  tables = $state([]);
  // id of the table being viewed, from the url (string or null)
  tableId = $state(null);
  // currently viewed table (object or undefined)
  table = $derived(this.tables.find(table => table.id === this.tableId));
  // currently viewed records list (object)
  records = $state({});
  // currently viewed/edited record (object or null)
  record = $state(null);
  // filters for the records (object)
  filters = $state(defaultFilters());
  // sort order for the records (object)
  sort = $state(defaultSort());

  // purpose:		clears all the filters and the sort order
  // ------------------------------------------------------------------------
  clearFilters(){
    this.filters = defaultFilters();
    this.sort = defaultSort();
  }
}

const databaseState = new Database();



// exports
// ------------------------------------------------------------------------
export { databaseState };
