/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

import React, { useEffect, useState } from 'react';
import { i18n } from '@osd/i18n';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPage,
  EuiPageHeader,
  EuiTitle,
  EuiPageBody,
  EuiPageContent,
  EuiHorizontalRule,
  EuiSpacer,
  EuiDescriptionList,
  EuiDescriptionListTitle,
  EuiDescriptionListDescription,
  EuiPageHeaderSection,
  EuiLink,
  EuiIcon,
  EuiGlobalToastList,
} from '@elastic/eui';
import { displayDeliveryChannels, fileFormatsUpper, generateReportById, getAvailableNotificationsChannels } from '../main_utils';
import { GenerateReportLoadingModal } from '../loading_modal';
import { ReportSchemaType } from '../../../../server/model';
import { converter } from '../../report_definitions/utils';
import dateMath from '@elastic/datemath';
import {
  permissionsMissingActions,
  permissionsMissingToast,
  timeRangeMatcher,
} from '../../utils/utils';
import { TRIGGER_TYPE } from '../../../../server/routes/utils/constants';
import { getChannelsQueryObject } from '../../report_definitions/delivery/delivery_constants';

interface ReportDetails {
  reportName: string;
  description: string;
  created: string;
  lastUpdated: string;
  source: string;
  time_period: string;
  defaultFileFormat: string;
  state: string | undefined;
  reportHeader: string;
  reportFooter: string;
  triggerType: string;
  scheduleType: string;
  scheduleDetails: string;
  configIds: Array<string> | string; 
  title: string;
  textDescription: string;
  htmlDescription: string;
  queryUrl: string;
}

export const ReportDetailsComponent = (props: { reportDetailsComponentTitle: any; reportDetailsComponentContent: any; }) => {
  const { reportDetailsComponentTitle, reportDetailsComponentContent } = props;

  return (
    <EuiFlexItem>
      <EuiDescriptionList>
        <EuiDescriptionListTitle>
          {reportDetailsComponentTitle}
        </EuiDescriptionListTitle>
        <EuiDescriptionListDescription>
          {reportDetailsComponentContent}
        </EuiDescriptionListDescription>
      </EuiDescriptionList>
    </EuiFlexItem>
  );
};

// convert markdown to plain text, trim it if it's longer than 3 lines
export const trimAndRenderAsText = (markdown: string) => {
  if (!markdown) return markdown;
  const lines = markdown.split('\n').filter((line) => line);
  const elements = lines.slice(0, 3).map((line, i) => <p key={i}>{line}</p>);
  return lines.length <= 3 ? elements : elements.concat(<p key={3}>...</p>);
};

export const formatEmails = (emails: string[]) => {
  return Array.isArray(emails) ? emails.join(', ') : emails;
};

export function ReportDetails(props: { match?: any; setBreadcrumbs?: any; httpClient: any; }) {
  const [reportDetails, setReportDetails] = useState<ReportDetails>({
    reportName: '',
    description: '',
    created: '',
    lastUpdated: '',
    source: '',
    time_period: '',
    defaultFileFormat: '',
    state: '',
    reportHeader: '',
    reportFooter: '',
    triggerType: '',
    scheduleType: '',
    scheduleDetails: '',
    configIds: [],
    title: '',
    textDescription: '',
    htmlDescription: '',
    queryUrl: ''
  });
  const [toasts, setToasts] = useState([]);
  const [showLoading, setShowLoading] = useState(false);

  const reportId = props.match['params']['reportId'];

  const handleLoading = (e: boolean | ((prevState: boolean) => boolean)) => {
    setShowLoading(e);
  };

  const addPermissionsMissingDownloadToastHandler = () => {
    const toast = permissionsMissingToast(
      permissionsMissingActions.GENERATING_REPORT
    );
    // @ts-ignore
    setToasts(toasts.concat(toast));
  };

  const handlePermissionsMissingDownloadToast = () => {
    addPermissionsMissingDownloadToastHandler();
  };

  const addErrorToastHandler = (
    title = i18n.translate(
      'opensearch.reports.details.errorLoadingReportDetails',
      { defaultMessage: 'Error loading report details.' }
    ),
    text = ''
  ) => {
    const errorToast = {
      title,
      text,
      color: 'danger',
      iconType: 'alert',
      id: 'reportDetailsErrorToast',
    };
    // @ts-ignore
    setToasts(toasts.concat(errorToast));
  };

  const handleErrorToast = (title?: string, text?: string) => {
    addErrorToastHandler(title, text);
  };

  const addSuccessToastHandler = () => {
    const successToast = {
      title: 'Success',
      color: 'success',
      text: (
        <p>
          {i18n.translate(
            'opensearch.reports.details.reportSuccessfullyDownloaded',
            { defaultMessage: 'Report successfully downloaded!' }
          )}
        </p>
      ),
      id: 'onDemandDownloadSuccessToast',
    };
    // @ts-ignore
    setToasts(toasts.concat(successToast));
  };

  const handleSuccessToast = () => {
    addSuccessToastHandler();
  };

  const removeToast = (removedToast: { id: any; }) => {
    setToasts(toasts.filter((toast : any) => toast.id !== removedToast.id));
  };

  const handleReportDetails = (e: React.SetStateAction<ReportDetails>) => {
    setReportDetails(e);
  };

  const convertTimestamp = (timestamp: number | undefined) => {
    let displayDate = `\u2014`;
    if (timestamp) {
      let readableDate = new Date(timestamp);
      displayDate = readableDate.toLocaleString();
    }
    return displayDate;
  };

  const parseTimePeriod = (queryUrl: string) => {
    let [fromDateString, toDateString] : RegExpMatchArray | null = queryUrl.match(
      timeRangeMatcher
    );

    fromDateString = decodeURIComponent(fromDateString.replace(/[']+/g, ''));
    toDateString = decodeURIComponent(toDateString.replace(/[']+/g, ''));

    let fromDateParsed = dateMath.parse(fromDateString);
    let toDateParsed = dateMath.parse(toDateString, { roundUp: true });

    const fromTimePeriod = fromDateParsed?.toDate();
    const toTimePeriod = toDateParsed?.toDate();
    return (
      fromTimePeriod?.toLocaleString() + ' -> ' + toTimePeriod?.toLocaleString()
    );
  };

  const getReportDetailsData = (
    report: ReportSchemaType, 
    availableChannels: Array<{ label: string; id: string; }>
    ) : ReportDetails => {
    const {
      report_definition: reportDefinition,
      last_updated: lastUpdated,
      state,
      query_url: queryUrl,
    } = report;
    const { report_params: reportParams, trigger, delivery } = reportDefinition;
    const {
      trigger_type: triggerType,
      trigger_params: triggerParams,
    } = trigger;
    const {
      configIds: configIds,
      title: title,
      textDescription: textDescription,
      htmlDescription: htmlDescription
    } = delivery;
    const coreParams = reportParams.core_params;
    // covert timestamp to local date-time string
    let reportDetails = {
      reportName: reportParams.report_name,
      description:
        reportParams.description === '' ? `\u2014` : reportParams.description,
      created: convertTimestamp(report.time_created),
      lastUpdated: convertTimestamp(report.last_updated),
      source: reportParams.report_source,
      // TODO:  we have all data needed, time_from, time_to, time_duration,
      // think of a way to better display
      time_period: (reportParams.report_source !== 'Notebook') ? parseTimePeriod(queryUrl) : `\u2014`,
      defaultFileFormat: coreParams.report_format,
      state: state,
      reportHeader:
        reportParams.core_params.hasOwnProperty('header') &&
        reportParams.core_params.header != ''
          ? converter.makeMarkdown(reportParams.core_params.header)
          : `\u2014`,
      reportFooter:
        reportParams.core_params.hasOwnProperty('footer') &&
        reportParams.core_params.footer != ''
          ? converter.makeMarkdown(reportParams.core_params.footer)
          : `\u2014`,
      triggerType: triggerType,
      scheduleType: triggerParams ? triggerParams.schedule_type : `\u2014`,
      scheduleDetails: `\u2014`,
      configIds: (configIds.length > 0) ? displayDeliveryChannels(configIds, availableChannels) : `\u2014`,
      title: (title !== '') ? title : `\u2014`,
      textDescription: (textDescription !== '') ? textDescription : `\u2014`,
      htmlDescription: (htmlDescription !== '') ? htmlDescription : `\u2014`,
      queryUrl: queryUrl,
    };
    return reportDetails;
  };

  useEffect(() => {
    const { httpClient } = props;
    httpClient
    .get('../api/reporting_notifications/get_configs', {
      query: getChannelsQueryObject
    })
    .then(async (response: any) => {
      console.log('notification get configs is', response);
      let availableChannels = getAvailableNotificationsChannels(response.config_list);
      return availableChannels;
    })
    .catch((error: any) => {
      console.log('error when retrieving notification configs:', error);
    })
    .then((availableChannels: any) => {
      httpClient
      .get('../api/reporting/reports/' + reportId)
      .then((response: ReportSchemaType) => {
        handleReportDetails(getReportDetailsData(response, availableChannels));
        props.setBreadcrumbs([
          {
            text: i18n.translate(
              'opensearch.reports.details.breadcrumb.reporting',
              { defaultMessage: 'Reporting' }
            ),
            href: '#',
          },
          {
            text: i18n.translate(
              'opensearch.reports.details.breadcrumb.reportDetails',
              {
                defaultMessage: 'Report details: {name}',
                values: {
                  name: response.report_definition.report_params.report_name,
                },
              }
            ),
          },
        ]);
      })
      .catch((error: any) => {
        console.log('Error when fetching report details: ', error);
        handleErrorToast();
      });
    })
  }, []);

  const downloadIconDownload = async () => {
    handleLoading(true);
    await generateReportById(
      reportId,
      props.httpClient,
      handleSuccessToast,
      handleErrorToast,
      handlePermissionsMissingDownloadToast
    );
    handleLoading(false);
  };

  const fileFormatDownload = (data: ReportDetails) => {
    let formatUpper = data['defaultFileFormat'];
    formatUpper = fileFormatsUpper[formatUpper];
    return (
      <EuiLink onClick={downloadIconDownload}>
        {formatUpper + ' '}
        <EuiIcon type="importAction" />
      </EuiLink>
    );
  };

  const sourceURL = (data: ReportDetails) => {
    return (
      <EuiLink href={`${data.queryUrl}`} target="_blank">
        {data['source']}
      </EuiLink>
    );
  };

  const triggerSection = 
    reportDetails.triggerType === TRIGGER_TYPE.onDemand ? (
      <ReportDetailsComponent
      reportDetailsComponentTitle={i18n.translate(
        'opensearch.reports.details.reportTrigger.reportType',
        { defaultMessage: 'Report trigger' }
      )}
      reportDetailsComponentContent={reportDetails.triggerType}
    />
    ) : (
      <EuiFlexGroup>
        <ReportDetailsComponent
          reportDetailsComponentTitle={i18n.translate(
            'opensearch.reports.details.reportTrigger.reportType',
            { defaultMessage: 'Report trigger' }
          )}
          reportDetailsComponentContent={reportDetails.triggerType}
        />
        <ReportDetailsComponent
          reportDetailsComponentTitle={i18n.translate(
            'opensearch.reports.details.reportTrigger.scheduleType',
            { defaultMessage: 'Schedule type' }
          )}
          reportDetailsComponentContent={reportDetails.scheduleType}
        />
        <ReportDetailsComponent
          reportDetailsComponentTitle={i18n.translate(
            'opensearch.reports.details.reportTrigger.scheduleDetails',
            { defaultMessage: 'Schedule details' }
          )}
          reportDetailsComponentContent={reportDetails.scheduleDetails}
        />
        <ReportDetailsComponent
          reportDetailsComponentTitle={''}
          reportDetailsComponentContent={''}
        />
      </EuiFlexGroup>
    )

  const showLoadingModal = showLoading ? (
    <GenerateReportLoadingModal setShowLoading={setShowLoading} />
  ) : null;

  return (
    <EuiPage>
      <EuiPageBody>
        <EuiTitle size="l">
          <h1>
            {i18n.translate('opensearch.reports.details.title', {
              defaultMessage: 'Report details',
            })}
          </h1>
        </EuiTitle>
        <EuiSpacer size="m" />
        <EuiPageContent panelPaddingSize={'l'}>
          <EuiPageHeader>
            <EuiFlexGroup>
              <EuiFlexItem>
                <EuiPageHeaderSection>
                  <EuiTitle>
                    <h2>{reportDetails.reportName}</h2>
                  </EuiTitle>
                </EuiPageHeaderSection>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiPageHeader>
          <EuiHorizontalRule />
          <EuiTitle>
            <h3>
              {i18n.translate('opensearch.reports.details.reportSettings', {
                defaultMessage: 'Report Settings',
              })}
            </h3>
          </EuiTitle>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={i18n.translate(
                'opensearch.reports.details.reportSettings.name',
                { defaultMessage: 'Name' }
              )}
              reportDetailsComponentContent={reportDetails.reportName}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={i18n.translate(
                'opensearch.reports.details.reportSettings.description',
                { defaultMessage: 'Description' }
              )}
              reportDetailsComponentContent={reportDetails.description}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={i18n.translate(
                'opensearch.reports.details.reportSettings.created',
                { defaultMessage: 'Created' }
              )}
              reportDetailsComponentContent={reportDetails.created}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={i18n.translate(
                'opensearch.reports.details.reportSettings.lastUpdated',
                { defaultMessage: 'Last updated' }
              )}
              reportDetailsComponentContent={reportDetails.lastUpdated}
            />
          </EuiFlexGroup>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={i18n.translate(
                'opensearch.reports.details.reportSettings.source',
                { defaultMessage: 'Source' }
              )}
              reportDetailsComponentContent={sourceURL(reportDetails)}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={i18n.translate(
                'opensearch.reports.details.reportSettings.timePeriod',
                { defaultMessage: 'Time period' }
              )}
              reportDetailsComponentContent={reportDetails.time_period}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={i18n.translate(
                'opensearch.reports.details.reportSettings.fileFormat',
                { defaultMessage: 'File format' }
              )}
              reportDetailsComponentContent={fileFormatDownload(reportDetails)}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={i18n.translate(
                'opensearch.reports.details.reportSettings.state',
                { defaultMessage: 'State' }
              )}
              reportDetailsComponentContent={reportDetails.state}
            />
          </EuiFlexGroup>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={i18n.translate(
                'opensearch.reports.details.reportSettings.reportHeader',
                { defaultMessage: 'Report header' }
              )}
              reportDetailsComponentContent={trimAndRenderAsText(
                reportDetails.reportHeader
              )}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={i18n.translate(
                'opensearch.reports.details.reportSettings.reportFooter',
                { defaultMessage: 'Report footer' }
              )}
              reportDetailsComponentContent={trimAndRenderAsText(
                reportDetails.reportFooter
              )}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={''}
              reportDetailsComponentContent={''}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={''}
              reportDetailsComponentContent={''}
            />
          </EuiFlexGroup>
          <EuiSpacer />
          {triggerSection}
          <EuiSpacer />
          <EuiTitle>
            <h3>Notification settings</h3>
          </EuiTitle>
          <EuiSpacer />
          <EuiFlexGroup>
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Config IDs'}
              reportDetailsComponentContent={
                reportDetails.configIds
              }
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Title'}
              reportDetailsComponentContent={reportDetails.title}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Text description'}
              reportDetailsComponentContent={reportDetails.textDescription}
            />
            <ReportDetailsComponent
              reportDetailsComponentTitle={'Html description'}
              reportDetailsComponentContent={trimAndRenderAsText(
                reportDetails.htmlDescription
              )}
            />
          </EuiFlexGroup>
        </EuiPageContent>
        <EuiGlobalToastList
          toasts={toasts}
          dismissToast={removeToast}
          toastLifeTimeMs={6000}
        />
        {showLoadingModal}
      </EuiPageBody>
    </EuiPage>
  );
}
