/*
  the records view (page, sorting, filter, deleted) as it is kept in the url

  usage: import { parseQuery, queryHref } from '#lib/database/query.js'

  The url is the only place this state lives, so every change is a navigation and the
  records are loaded by the page's load function: SvelteKit applies only the latest
  navigation, so a slow response can no longer overwrite a newer one.

  Everything read from the url is checked here, because record.get writes the sort field,
  the filter name and operation and an id filter's value into the text of a GraphQL query,
  and a url is something anyone can link to.
*/


// a name of a property, a sort field or a GraphQL operation (regexp)
const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
// comparisons offered for a range filter (array)
const rangeComparisons = ['gt', 'gte', 'lt', 'lte'];

const defaults = {
  page: 1,
  by: 'created_at',
  order: 'DESC',
  deleted: 'false'
};

// url parameters for the filter, by the field of the filters form they hold (object)
const filterParams = {
  name: 'filter_name',
  attribute_type: 'filter_type',
  operation: 'filter_operation',
  value: 'filter_value',
  minFilter: 'filter_min',
  minFilterValue: 'filter_min_value',
  maxFilter: 'filter_max',
  maxFilterValue: 'filter_max_value'
};

// the filter shown when none is applied (object)
const emptyFilter = () => ({ attribute_type: 'id', name: 'id', operation: 'value', value: '' });


// purpose:		reads the filter from the url, if there is a valid one
// arguments:	url search params (URLSearchParams)
// returns:		filter with the fields of the filters form (object)
// ------------------------------------------------------------------------
const parseFilter = (searchParams) => {
  const filter = {};

  for(const [field, param] of Object.entries(filterParams)){
    if(searchParams.has(param)){
      filter[field] = searchParams.get(param);
    }
  }

  if(!identifier.test(filter.name ?? '') || !identifier.test(filter.operation ?? '') || !identifier.test(filter.attribute_type ?? '')){
    return emptyFilter();
  }

  // the id is filtered on directly rather than through a query variable
  if(filter.name === 'id' && filter.value && !/^\d+$/.test(filter.value)){
    return emptyFilter();
  }

  for(const comparison of ['minFilter', 'maxFilter']){
    if(filter[comparison] !== undefined && !rangeComparisons.includes(filter[comparison])){
      return emptyFilter();
    }
  }

  return filter;
};


// purpose:		reads the records view from the url
// arguments:	url search params (URLSearchParams)
// returns:		filters (object) and sort (object) in the shape record.get takes
// ------------------------------------------------------------------------
const parseQuery = (searchParams) => {
  const page = parseInt(searchParams.get('page'));
  const by = searchParams.get('sort_by');
  const order = searchParams.get('sort_order');

  return {
    filters: {
      page: page > 0 ? page : defaults.page,
      attributes: [parseFilter(searchParams)],
      deleted: searchParams.get('deleted') === 'true' ? 'true' : defaults.deleted
    },
    sort: {
      by: identifier.test(by ?? '') ? by : defaults.by,
      order: order === 'ASC' || order === 'DESC' ? order : defaults.order
    }
  };
};


// purpose:		builds the link to the records view with some of it changed
// arguments:	current url (URL)
//				what to change (object), any of:
//				  page (int), sort ({ by, order }), deleted ('true' or 'false'),
//				  filter (object with the fields of the filters form, or null to clear it)
// returns:		path and query string, with defaults left out (string)
// ------------------------------------------------------------------------
const queryHref = (url, changes = {}) => {
  const current = parseQuery(url.searchParams);

  const page = changes.page ?? current.filters.page;
  const sort = changes.sort ?? current.sort;
  const deleted = changes.deleted ?? current.filters.deleted;
  const filter = changes.filter === undefined ? current.filters.attributes[0] : (changes.filter ?? emptyFilter());

  const params = new URLSearchParams();

  if(parseInt(page) !== defaults.page){
    params.set('page', page);
  }
  if(sort.by !== defaults.by){
    params.set('sort_by', sort.by);
  }
  if(sort.order !== defaults.order){
    params.set('sort_order', sort.order);
  }
  if(deleted === 'true'){
    params.set('deleted', 'true');
  }

  const hasValue = filter.value || filter.minFilterValue || filter.maxFilterValue;
  if(hasValue){
    for(const [field, param] of Object.entries(filterParams)){
      if(filter[field] !== undefined && filter[field] !== ''){
        params.set(param, filter[field]);
      }
    }
  }

  const query = params.toString();

  return url.pathname + (query ? '?' + query : '');
};



// exports
// ------------------------------------------------------------------------
export { parseQuery, queryHref };
