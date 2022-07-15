/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { JSDOM } from 'jsdom';
import { CHROMIUM_PATH, FORMAT, REPORT_TYPE, SELECTOR } from './constants.js';


export async function downloadVisualReport(url, format, width, height, filename, authType, username, password) {
  const window = new JSDOM('').window;

  try {
    const browser = await puppeteer.launch({
      headless: true,
      /**
       * TODO: temp fix to disable sandbox when launching chromium on Linux instance
       * https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md#setting-up-chrome-linux-sandbox
       */
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
        '--font-render-hinting=none',
        '--enable-features=NetworkService',
        '--ignore-certificate-errors',
      ],
      executablePath: CHROMIUM_PATH,
      ignoreHTTPSErrors: true,
      env: {
        TZ: 'UTC', // leave as UTC for now
      },
    });

    const page = await browser.newPage();
    const overridePage = await browser.newPage();
    page.setDefaultNavigationTimeout(0);
    page.setDefaultTimeout(100000);
    overridePage.setDefaultNavigationTimeout(0);
    overridePage.setDefaultTimeout(100000);

    // auth 
    if (username !== undefined && password !== undefined) {
      if(authType === 'basic'){
        await basicAuthentication(page, overridePage, url, username, password);
      }
      else if(authType === 'SAML'){
        await samlAuthentication(page, overridePage, url, username, password);
      }
      else if (authType === 'cognito'){
        await cognitoAuthentication(page, overridePage, url, username, password);
      }
    }
    // no auth
    else {
      await page.goto(url, { waitUntil: 'networkidle0' });
    }

    await page.setViewport({
      width: width,
      height: height,
    });

    const reportSource = getReportSourceFromURL(url);
    // if its an OpenSearch report, remove extra elements
    if (reportSource !== 'Other') {
      await page.evaluate(
        (reportSource, REPORT_TYPE) => {
          // remove buttons
          document
            .querySelectorAll("[class^='euiButton']")
            .forEach((e) => e.remove());
          // remove top navBar
          document
            .querySelectorAll("[class^='euiHeader']")
            .forEach((e) => e.remove());
          // remove visualization editor
          if (reportSource === REPORT_TYPE.VISUALIZATION) {
            document
              .querySelector('[data-test-subj="splitPanelResizer"]')
              ?.remove();
            document.querySelector('.visEditor__collapsibleSidebar')?.remove();
          }
          document.body.style.paddingTop = '0px';
        },
        reportSource,
        REPORT_TYPE
      );      
    }

      // force wait for any resize to load after the above DOM modification
      await page.waitFor(1000);
      switch (reportSource) {
        case 'Dashboard':
          await page.waitForSelector(SELECTOR.DASHBOARD, {
            visible: true,
          });
          break;
        case 'Visualization':
          await page.waitForSelector(SELECTOR.VISUALIZATION, {
            visible: true,
          });
          break;
        case 'Notebook':
          await page.waitForSelector(SELECTOR.NOTEBOOK, {
            visible: true,
          });
          break;
        default:
          break;
      }

      await waitForDynamicContent(page);

      let buffer;
      // create pdf or png accordingly
      if (format === FORMAT.PDF) {
        const scrollHeight = await page.evaluate(
          /* istanbul ignore next */
          () => document.documentElement.scrollHeight
        );
    
        buffer = await page.pdf({
          margin: undefined,
          width: 1680,
          height: scrollHeight + 'px',
          printBackground: true,
          pageRanges: '1',
        });
      } else if (format === FORMAT.PNG) {
        buffer = await page.screenshot({
          fullPage: true,
        });
      }
    
      const fileName = `${filename}.${format}`;
      const curTime = new Date();
      const timeCreated = curTime.valueOf();
      await browser.close();
      const data = { timeCreated, dataUrl: buffer.toString('base64'), fileName };
      await readStreamToFile(data.dataUrl, fileName);
  } catch (e) {
    console.log('error is', e);
    process.exit(1);
  }
}

const waitForDynamicContent = async (
  page,
  timeout = 30000,
  interval = 1000,
  checks = 5
) => {
  const maxChecks = timeout / interval;
  let passedChecks = 0;
  let previousLength = 0;

  let i = 0;
  while (i++ <= maxChecks) {
    let pageContent = await page.content();
    let currentLength = pageContent.length;

    previousLength === 0 || previousLength != currentLength
      ? (passedChecks = 0)
      : passedChecks++;
    if (passedChecks >= checks) {
      break;
    }

    previousLength = currentLength;
    await page.waitFor(interval);
  }
};

const getReportSourceFromURL = (url) => {
  if (url.includes('dashboards')) {
    return 'Dashboard';
  }
  else if (url.includes('visualize')) {
    return 'Visualization';
  }
  else if (url.includes('discover')) {
    return 'Saved search';
  }
  else if (url.includes('notebooks')) {
    return 'Notebook';
  }
  return 'Other';
}

const getUrl = async (url) =>{
  let urlExt = url.split("#");
  let urlRef = "#"+urlExt[1];
  return urlRef;
};

const basicAuthentication = async (page, overridePage, url, username, password) => {
  await page.goto(url, { waitUntil: 'networkidle0' });
  console.log('basic authenticating');
  await page.waitFor(10000);
  await page.type('input[data-test-subj="user-name"]', username);
  await page.type('[data-test-subj="password"]', password);
  await page.click('button[type=submit]');
  await page.waitForTimeout(30000);
  await page.click('label[for=global]');
  await page.click('button[data-test-subj="confirm"]');
  await page.waitForTimeout(25000);
  await overridePage.goto(url,{ waitUntil: 'networkidle0' });
  await overridePage.waitForTimeout(5000);
  await page.goto(url,{ waitUntil: 'networkidle0' });
};

const samlAuthentication = async (page, overridePage, url, username, password) => {
  await page.goto(url, { waitUntil: 'networkidle0' });
  console.log('SAML authenticating');
  await page.waitFor(10000);
  let refUrl;
  await getUrl(url).then((value) => {
    refUrl = value;
  });
  await page.type('[name="identifier"]', username);
  await page.type('[name="credentials.passcode"]', password);
  await page.click('[value="Sign in"]')
  await page.waitForTimeout(30000);
  await page.click('label[for=global]');
  await page.click('button[data-test-subj="confirm"]');
  await page.waitForTimeout(25000);
  await page.click(`a[href='${refUrl}']`);
}

const cognitoAuthentication = async (page, overridePage, url, username, password) => {
  await page.goto(url, { waitUntil: 'networkidle0' });
  console. log('cognito authenticating');
  await page.waitFor(10000);
  await page.type(  '[name="username" ]', username);
  await page.type( ' [name="password"]', password);
  await page.click( '[name="signInSubmitButton"]');
  await page.waitForTimeout(30000);
  await page.click('label[for=global]');
  await page.click('button[data-test-subj="confirm"]');
  await page.waitForTimeout(25000);
  await overridePage.goto(url,{ waitUntil: 'networkidle0' });
  await overridePage.click('label[for=global]');
  await overridePage.click('button[data-test-subj="confirm"]');
  await overridePage.waitForTimeout(5000);
  await page.goto(url,{ waitUntil: 'networkidle0' });
}


export const readStreamToFile = async (
  stream,
  fileName
) => {
  let base64Image = stream.split(';base64,').pop();
  fs.writeFile(fileName, base64Image, {encoding: 'base64'}, function (err) {
    console.log('Downloaded report');
  })
};

export const getFileFormatPrefix = (fileFormat) => {
  const fileFormatPrefix = 'data:' + fileFormat + ';base64,';
  return fileFormatPrefix;
};
