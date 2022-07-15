#!/usr/bin/env node
/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */


import _ from 'lodash';
import { ArgumentParser } from 'argparse';
import { exit } from 'process';
import { downloadVisualReport } from './download_helpers.js';

"use strict";

// url OR report source type and ID
const parser = new ArgumentParser({
  description: 'Argument parser for Reporting Anything'
});

parser.add_argument('-u', '--url', {help: 'url of report'});
parser.add_argument('-f', '--format', {help: 'File format of the report'});
parser.add_argument('-w', '--width', { help: 'Window width of the report'});
parser.add_argument('-t', '--height', {help: 'Window height of the report'});
parser.add_argument('-n', '--filename', {help: 'File name of the report'});
parser.add_argument('-a', '--auth', {help: 'authentication type of the report; options are bas'});
parser.add_argument('-c', '--credentials', {help: 'login credentials in the format of username:password'});

const parsed_args = parser.parse_args();

if (parsed_args.url === undefined) {
  console.log('Please specify a URL');
  exit(1);
}

if (parsed_args.format !== undefined && 
    parsed_args.format.toUpperCase() !== 'PDF' && 
    parsed_args.format.toUpperCase() !== 'PNG') {
  console.log('Please specify a valid file format: one of PDF or PNG');
  exit(1);
}

let format;

// default format is PDF
if (parsed_args.format === undefined) {
  format = 'pdf';
} else {
  format = parsed_args.format;
}

let width, height;
// set default width and height if not specified
if (parsed_args.width === undefined) {
  width = 1680;
}
if (parsed_args.height === undefined) {
  height = 2560;
}

let filename;
if (parsed_args.filename !== undefined) {
  filename = parsed_args.filename;
}
else {
  filename = 'reporting_anything';
}

let authType;
if (parsed_args.auth !== undefined) {
  authType = parsed_args.auth;
}
else {
  authType = 'basic';
}

let username, password;
if (parsed_args.credentials !== undefined) {
  const split = parsed_args.credentials.split(':');
  username = split[0];
  password = split[1];
}

await downloadVisualReport(parsed_args.url, format, width, height, filename, authType, username, password);
