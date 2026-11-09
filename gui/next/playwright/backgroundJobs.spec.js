import { test, expect } from '@playwright/test';
import { posInstance } from './helpers/posInstance.js';
import { refuseQuery } from './helpers/refuseQuery.js';


const url = './backgroundJobs';


test('see home screen', async ({ page }) => {
  await page.goto('./');

  await page.getByRole('link', { name: 'Background Jobs', exact: true}).first().click();

  await expect(page).toHaveTitle(`Jobs: ${posInstance.MPKIT_URL.replace('https://', '')}`);
});


test('viewing scheduled background jobs', async ({ page }) => {
  await page.goto(posInstance.MPKIT_URL + 'background_job');
  await expect(page.getByText('background job scheduled')).toBeVisible();
  await page.waitForTimeout(1000);

  await page.goto(url);

  await expect(page.getByRole('cell', { name: 'scheduled background job' }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('cell', { name: 'high' }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'in 10 minutes' }).first()).toBeVisible();
});


test('viewing background job details', async ({ page }) => {
  await page.goto(posInstance.MPKIT_URL + 'background_job');
  await expect(page.getByText('background job scheduled')).toBeVisible();
  await page.waitForTimeout(1000);

  await page.goto(url);

  await page.getByRole('link', { name: 'scheduled background job' }).first().click();
  await expect(page.getByRole('heading', { name: 'scheduled background job' })).toBeVisible();
  await expect(page.locator('span.label .property').first()).toBeVisible();

  // close details panel
  await page.getByRole('link', { name: 'Close details' }).click();
  await expect(page.getByRole('heading', { name: 'scheduled background job' })).toBeHidden();
});


test('deleting scheduled background job', async ({ page }) => {
  await page.goto(posInstance.MPKIT_URL + 'background_job_to_delete');
  await expect(page.getByText('background job scheduled')).toBeVisible();
  await page.waitForTimeout(1000);

  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure you want to delete this background job?');
    await dialog.accept();
  });

  await page.goto(url);
  await expect(page.locator('tr:has-text("background job to delete")').first()).toBeVisible({ timeout: 15000 });

  for(const job of await page.locator('tr:has-text("background job to delete")').all()){
    await job.getByRole('button', { name: 'More options' }).click();
    await job.getByRole('button', { name: 'Delete background job' }).click();
    await expect(job).toBeHidden(20000);
  }
});


// purpose:   answers the list of running jobs and the stop mutation in place of the instance,
//            which has no job that stays running long enough to be stopped by a test
// arguments: page (object), what the stop mutation answers (object),
//            how many reads of the list still show a stopped job (number) - the instance lists
//            running jobs as the workers last reported them, up to ten seconds or so late,
//            fields that replace the job's own (object)
// returns:   whether the stop was asked for (function)
// ------------------------------------------------------------------------
const fakeRunningJob = async (page, stopAnswer, listedAfterStop = 0, fields = {}) => {
  const job = {
    id: 'running-job-1', source_name: 'running background job', queue: 'default',
    liquid_body: "{% log 'running' %}", partial_name: null,
    run_at: new Date().toISOString(), created_at: new Date().toISOString(),
    ...fields
  };
  let stopped = false;

  await page.route('**/api/graph', async route => {
    const query = JSON.parse(route.request().postData() ?? '{}').query ?? '';

    if(query.includes('admin_background_job_stop(')){
      stopped = true;
      await route.fulfill({ json: stopAnswer });
    } else if(query.includes('admin_background_jobs(') && query.includes('type: RUNNING')){
      const gone = stopped && !stopAnswer.errors && stopAnswer.data?.admin_background_job_stop && listedAfterStop-- <= 0;
      const results = gone ? [] : [job];
      await route.fulfill({ json: { data: { admin_background_jobs: {
        has_next_page: false, has_previous_page: false, total_pages: 1, results
      } } } });
    } else {
      await route.fallback();
    }
  });

  return () => stopped;
};


test('stopping a running background job', async ({ page }) => {
  const stopAsked = await fakeRunningJob(page, { data: { admin_background_job_stop: { id: 'running-job-1' } } });

  page.on('dialog', async dialog => {
    expect(dialog.message()).toEqual('Are you sure you want to stop this background job?');
    await dialog.accept();
  });

  await page.goto(url + '?type=RUNNING');
  const job = page.locator('tr:has-text("running background job")');
  await expect(job).toBeVisible({ timeout: 15000 });

  // a running job is stopped, from the same menu other jobs are retried or deleted from
  await job.getByRole('button', { name: 'More options' }).click();
  await expect(job.getByRole('button', { name: 'Delete background job' })).toHaveCount(0);

  await job.getByRole('button', { name: 'Stop background job' }).click();
  await expect(job.getByRole('button', { name: 'Stopping…' })).toBeDisabled();
  // the row says so too, once the menu is closed
  await expect(job.getByText('stopping…', { exact: true })).toBeVisible();
  await expect(page.getByText('Background job running-job-1 is stopping')).toBeVisible();
  expect(stopAsked()).toBe(true);

  await expect(job).toBeHidden({ timeout: 10000 });
});


test('a stopped job still listed for a while is read again until it leaves the list', async ({ page }) => {
  await fakeRunningJob(page, { data: { admin_background_job_stop: { id: 'running-job-1' } } }, 2);

  page.on('dialog', dialog => dialog.accept());

  await page.goto(url + '?type=RUNNING');
  const job = page.locator('tr:has-text("running background job")');
  await expect(job).toBeVisible({ timeout: 15000 });

  await job.getByRole('button', { name: 'More options' }).click();
  await job.getByRole('button', { name: 'Stop background job' }).click();

  // the first read after the stop still lists it: it can not be stopped again meanwhile
  await page.waitForTimeout(4000);
  await expect(job.getByRole('button', { name: 'Stopping…' })).toBeDisabled();

  await expect(job).toBeHidden({ timeout: 15000 });
});


test('a stop the instance did not carry out can be asked for again', async ({ page }) => {
  // what the instance answers when the job finished in the meantime
  await fakeRunningJob(page, { data: { admin_background_job_stop: null } });

  page.on('dialog', dialog => dialog.accept());

  await page.goto(url + '?type=RUNNING');
  const job = page.locator('tr:has-text("running background job")');
  await expect(job).toBeVisible({ timeout: 15000 });

  await job.getByRole('button', { name: 'More options' }).click();
  await job.getByRole('button', { name: 'Stop background job' }).click();

  await expect(page.getByText('Background job running-job-1 could not be stopped')).toBeVisible();
  await expect(job.getByRole('button', { name: 'Stop background job' })).toBeEnabled();
  await expect(job.getByText('stopping…', { exact: true })).toBeHidden();
});


test('a running job the background tag did not schedule can be stopped too', async ({ page }) => {
  // a deploy, an export: no code of its own, stopped like any other job
  await fakeRunningJob(page, { data: { admin_background_job_stop: { id: 'running-job-1' } } }, 0, { liquid_body: '', partial_name: null, source_name: null });

  await page.goto(url + '?type=RUNNING');
  const job = page.locator('tr:has-text("running-job-1")');
  await expect(job).toBeVisible({ timeout: 15000 });
  await job.getByRole('button', { name: 'More options' }).click();
  await expect(job.getByRole('button', { name: 'Stop background job' })).toBeVisible();
});


test('going back to the previous job type', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByRole('columnheader', { name: 'Runs' })).toBeVisible();

  await page.getByLabel('Type:').selectOption('DEAD');
  await expect(page).toHaveURL(/type=DEAD/);
  await expect(page.getByRole('columnheader', { name: 'Failed' })).toBeVisible();

  // the list follows the url, so going back shows the scheduled jobs again
  await page.goBack();
  await expect(page.getByRole('columnheader', { name: 'Runs' })).toBeVisible();
  await expect(page.getByLabel('Type:')).toHaveValue('SCHEDULED');
});


// purpose:   schedules a background job with its code inline, so it has a liquid_body to show
// arguments: Playwright's request fixture, the job's source name (string)
// ------------------------------------------------------------------------
const scheduleInlineJob = async (request, name) => {
  const response = await request.post('http://127.0.0.1:3333/api/liquid', {
    data: { content: `{% background source_name: '${name}', delay: 10 %}{% assign greeting = '${name}' %}{% endbackground %}` }
  });
  expect(response.ok()).toBeTruthy();
};


test('highlighting the code of a background job', async ({ page, request }) => {
  const first = `inline job ${Date.now()}`;
  const second = `${first} second`;
  await scheduleInlineJob(request, first);
  await scheduleInlineJob(request, second);

  await page.goto(url);
  await page.getByRole('link', { name: first, exact: true }).click();

  const code = page.getByRole('complementary').locator('pre code');
  await expect(code).toContainText(`assign greeting = '${first}'`);
  await expect(code.locator('.token.keyword').first()).toBeVisible();

  // opening another job shows its code, highlighted, and only that one
  await page.getByRole('link', { name: second, exact: true }).click();
  await expect(code).toContainText(`assign greeting = '${second}'`);
  await expect(code).toHaveCount(1);
  await expect(code.locator('.token.keyword').first()).toBeVisible();
});


test('highlighting the code of a background job opened from a link', async ({ page, request }) => {
  const name = `inline job ${Date.now()} linked`;
  await scheduleInlineJob(request, name);

  await page.goto(url);
  const href = await page.getByRole('link', { name, exact: true }).getAttribute('href');

  await page.goto('.' + href);

  const code = page.getByRole('complementary').locator('pre code');
  await expect(code).toContainText(`assign greeting = '${name}'`);
  await expect(code.locator('.token.keyword').first()).toBeVisible();
});



// purpose:   deletes every scheduled background job with the given source name
// arguments: Playwright's request fixture, the jobs' source name (string)
// ------------------------------------------------------------------------
const deleteScheduledJobs = async (request, name) => {
  const graph = async (query) => {
    const response = await request.post('http://127.0.0.1:3333/api/graph', { data: { query } });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).data;
  };

  const { admin_background_jobs: jobs } = await graph('{ admin_background_jobs(per_page: 100, filter: { type: SCHEDULED }) { results { id source_name } } }');

  for(const job of jobs.results.filter(job => job.source_name === name)){
    await graph(`mutation { admin_background_job_delete(id: ${JSON.stringify(job.id)}) { id } }`);
  }
};


test('paging through scheduled background jobs', async ({ page, request }) => {
  const name = 'paging job';
  // jobs left by a run that did not finish would push the other tests' jobs off the first page
  await deleteScheduledJobs(request, name);

  try {
    // more than the 20 jobs that fit on one page
    const response = await request.post('http://127.0.0.1:3333/api/liquid', {
      data: { content: `{% for i in (1..21) %}{% background source_name: '${name}', delay: 10 %}{% assign i = i %}{% endbackground %}{% endfor %}` }
    });
    expect(response.ok()).toBeTruthy();

    await page.goto(url);
    await expect(page.getByLabel('Page:')).toHaveValue('1');

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByLabel('Page:')).toHaveValue('2');

    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(page).toHaveURL(/page=1/);
    await expect(page.getByLabel('Page:')).toHaveValue('1');
  } finally {
    await deleteScheduledJobs(request, name);
  }
});


// purpose:   shows one dead job in the 'Dead' list and answers retrying or deleting it the given way,
//            so the test does not depend on a job having failed on the instance
// arguments: page (object), answer for the retry and delete mutations (object)
// ------------------------------------------------------------------------
const deadJob = { id: '999999', source_name: 'dead background job', queue: 'high', attempts: 3, created_at: new Date().toISOString(), dead_at: new Date().toISOString(), error_message: 'it failed' };

const routeDeadJob = async (page, answer) => {
  await page.route('**/api/graph', async route => {
    const query = route.request().postData() ?? '';

    if(query.includes('admin_background_jobs(') && query.includes('type: DEAD')){
      await route.fulfill({ json: { data: { admin_background_jobs: { has_next_page: false, has_previous_page: false, total_pages: 1, results: [deadJob] } } } });
    } else if(query.includes('admin_background_job_retry') || query.includes('admin_background_job_delete')){
      await route.fulfill({ json: answer });
    } else {
      await route.fallback();
    }
  });
};


test('retrying a dead background job', async ({ page }) => {
  await routeDeadJob(page, { data: { admin_background_job_retry: { id: deadJob.id } } });

  await page.goto(url + '?type=DEAD');

  const row = page.locator('tr:has-text("dead background job")');
  await row.getByRole('button', { name: 'More options' }).click();
  await row.getByRole('button', { name: 'Retry' }).click();

  await expect(page.getByText(`Background job ${deadJob.id} planned to run again`)).toBeVisible();
});


test('telling that a background job could not be run again', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  // the instance refuses, answering the way GraphQL does: errors, and no job
  await routeDeadJob(page, { errors: [{ message: 'refused' }], data: { admin_background_job_retry: null } });

  await page.goto(url + '?type=DEAD');

  const row = page.locator('tr:has-text("dead background job")');
  await row.getByRole('button', { name: 'More options' }).click();
  await row.getByRole('button', { name: 'Retry' }).click();

  await expect(page.getByText(`Background job ${deadJob.id} could not be run again`)).toBeVisible();
  expect(errors).toEqual([]);
});


test('telling that a background job could not be deleted', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());

  await routeDeadJob(page, { errors: [{ message: 'refused' }], data: { admin_background_job_delete: null } });

  await page.goto(url + '?type=DEAD');

  const row = page.locator('tr:has-text("dead background job")');
  await row.getByRole('button', { name: 'More options' }).click();
  await row.getByRole('button', { name: 'Delete background job' }).click();

  await expect(page.getByText(`Background job ${deadJob.id} could not be deleted`)).toBeVisible();
  expect(errors).toEqual([]);
});


test('telling that the background jobs could not be loaded', async ({ page }) => {
  await refuseQuery(page, 'admin_background_jobs(');
  await page.goto(url);

  await expect(page.locator('.notification.error:not(.disabled)')).toContainText('Could not load the background jobs: refused by the test');
});


// purpose:   answers the jobs list in place of the instance, with as many jobs of each type as
//            asked for, 20 a page, so that paging and switching types can be tested
// arguments: page (object), number of jobs of each type (object), the job a details query
//            answers with (object, optional)
// returns:   the list queries asked for, as { type, page } (array)
// ------------------------------------------------------------------------
const fakeJobLists = async (page, counts, details) => {
  const asked = [];

  await page.route('**/api/graph', async route => {
    const query = JSON.parse(route.request().postData() ?? '{}').query ?? '';
    if(!query.includes('admin_background_jobs(')){
      return route.fallback();
    }

    const type = query.match(/type: (\w+)/)?.[1] ?? 'SCHEDULED';
    const pageNumber = parseInt(query.match(/\bpage: (\d+)/)?.[1] ?? '1');
    const total = counts[type] ?? 0;
    const totalPages = Math.ceil(total / 20);

    let results;
    if(query.includes('id: { value:')){
      results = details ? [details] : [];
    } else {
      asked.push({ type, page: pageNumber });
      results = Array.from({ length: Math.max(0, Math.min(20, total - (pageNumber - 1) * 20)) }, (_, i) => {
        const n = (pageNumber - 1) * 20 + i;
        return { id: `${type.toLowerCase()}-${n}`, source_name: `${type.toLowerCase()} job ${n}`, queue: 'default',
          run_at: new Date().toISOString(), dead_at: type === 'DEAD' ? new Date().toISOString() : null };
      });
    }

    await route.fulfill({ json: { data: { admin_background_jobs: {
      has_next_page: pageNumber < totalPages, has_previous_page: pageNumber > 1, total_pages: totalPages, results
    } } } });
  });

  return asked;
};


test('switching the type works whatever the page field holds, and starts on its first page', async ({ page }) => {
  await fakeJobLists(page, { SCHEDULED: 45, DEAD: 25 });

  await page.goto(url + '?type=SCHEDULED&page=3');
  await expect(page.getByText('scheduled job 40')).toBeVisible();

  // a page number out of range used to fail the form's validation, which blocked every submit
  await page.getByRole('spinbutton').fill('9');
  await page.getByLabel('Type:').selectOption('DEAD');

  await expect(page.getByText('dead job 0', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/type=DEAD&page=1/);
  await expect(page.getByRole('spinbutton')).toHaveValue('1');
});


test('a page number past the last page shows the last page', async ({ page }) => {
  await fakeJobLists(page, { SCHEDULED: 45 });

  await page.goto(url + '?type=SCHEDULED&page=1');
  await expect(page.getByText('scheduled job 0', { exact: true })).toBeVisible();

  await page.getByRole('spinbutton').fill('9');

  await expect(page.getByText('scheduled job 40')).toBeVisible();
  await expect(page).toHaveURL(/page=3/);
  await expect(page.getByRole('spinbutton')).toHaveValue('3');
});


test('a link to a page past the last one shows the last page instead of an empty list', async ({ page }) => {
  await fakeJobLists(page, { DEAD: 25 });

  await page.goto(url + '?type=DEAD&page=7');

  await expect(page.getByText('dead job 20')).toBeVisible();
  await expect(page).toHaveURL(/type=DEAD&page=2/);
});


test('switching the type closes the details of a job of the other type', async ({ page }) => {
  await fakeJobLists(page, { SCHEDULED: 5, DEAD: 5 }, {
    id: 'dead-1', source_name: 'dead job 1', queue: 'default', created_at: new Date().toISOString(),
    dead_at: new Date().toISOString(), error_message: 'boom', arguments: { url: '/somewhere' }
  });

  await page.goto(url + '/dead/dead-1?type=DEAD&page=1');
  // a job whose arguments carry a url without the request context used to fail to render
  await expect(page.getByText('boom')).toBeVisible();
  await expect(page.locator('dd', { hasText: '/somewhere' })).toBeVisible();

  await page.getByLabel('Type:').selectOption('SCHEDULED');

  await expect(page).toHaveURL(/\/backgroundJobs\?type=SCHEDULED&page=1$/);
  await expect(page.getByText('boom')).toBeHidden();
});


test('the list of running jobs is read again by itself', async ({ page }) => {
  const asked = await fakeJobLists(page, { RUNNING: 1 });

  await page.goto(url + '?type=RUNNING');
  await expect(page.getByText('running job 0')).toBeVisible();

  await expect.poll(() => asked.filter(query => query.type === 'RUNNING').length, { timeout: 15000 }).toBeGreaterThanOrEqual(3);
});
