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
