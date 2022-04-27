/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import puppeteer from 'puppeteer-core';
import createDOMPurify from 'dompurify';
import fs from 'fs';
import { JSDOM } from 'jsdom';
import { CHROMIUM_PATH, REPORT_TYPE_URLS, FORMAT, REPORT_TYPE, SELECTOR } from './constants.js';


export async function downloadVisualReport(url, type, object_id, format, width, height) {
  const window = new JSDOM('').window;
  const DOMPurify = createDOMPurify(window);

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
      ],
      executablePath: CHROMIUM_PATH,
      ignoreHTTPSErrors: true,
      env: {
        TZ: 'UTC', // leave as UTC for now
      },
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);
    page.setDefaultTimeout(100000);

    let queryUrl = '';
    if (url != undefined) {
      queryUrl = url;
    }
    else {
      queryUrl = 'http://localhost:5601/app/';
      // create URL from report source type and saved object ID
      if (type.toUpperCase() === 'DASHBOARD') {
        queryUrl += REPORT_TYPE_URLS.DASHBOARD;
      }
      else if (type.toUpperCase() === 'VISUALIZATION') {
        queryUrl += REPORT_TYPE_URLS.VISUALIZATION;
      }
      else if (type.toUpperCase() === 'NOTEBOOK') {
        queryUrl += REPORT_TYPE_URLS.NOTEBOOK;
      }
      queryUrl += '/' + object_id;
    }
    await page.goto(queryUrl, { waitUntil: 'networkidle0' });
    await page.setViewport({
      width: width,
      height: height,
    });

    let reportSource;
    if (url !== undefined) {
      reportSource = getReportSourceFromURL(url);
    }
    else {
      reportSource = type;
    }

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
    
      const fileName = `reporting_anything.${format}`;
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
  var fileFormatPrefix = 'data:' + fileFormat + ';base64,';
  return fileFormatPrefix;
};