// purpose:   makes the instance answer one query with a GraphQL error, the way it answers a
//            query it cannot run (HTTP 200, errors in the body), and lets every other request through
// arguments: page (object), text that only that query contains, such as 'admin_tables(' (string)
// ------------------------------------------------------------------------
const refuseQuery = async (page, fragment) => {
  await page.route('**/api/graph', async route => {
    const query = route.request().postData() ?? '';

    if(query.includes(fragment)){
      await route.fulfill({ json: { errors: [{ message: 'refused by the test' }], data: null } });
    } else {
      await route.fallback();
    }
  });
};


export { refuseQuery };
