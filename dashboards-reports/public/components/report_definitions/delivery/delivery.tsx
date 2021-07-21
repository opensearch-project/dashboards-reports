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
import {
  EuiFormRow,
  EuiPageHeader,
  EuiTitle,
  EuiPageContent,
  EuiPageContentBody,
  EuiHorizontalRule,
  EuiSpacer,
  EuiCheckbox,
  EuiComboBox,
  EuiFieldText,
  EuiButton,
} from '@elastic/eui';
import CSS from 'csstype';
import { getChannelsQueryObject, placeholderChannels, testMessageConfirmationMessage } from './delivery_constants';
import 'react-mde/lib/styles/css/react-mde-all.css';
import { reportDefinitionParams } from '../create/create_report_definition';
import ReactMDE from 'react-mde';
import { converter } from '../utils';
import { getAvailableNotificationsChannels } from '../../main/main_utils';

const styles: CSS.Properties = {
  maxWidth: '800px',
};

// TODO: add to schema to avoid need for export
export let includeDelivery = false;

export type ReportDeliveryProps = {
  edit: boolean;
  editDefinitionId: string;
  reportDefinitionRequest: reportDefinitionParams;
  httpClientProps: any;
  showDeliveryChannelError: boolean;
  deliveryChannelError: string;
};

export function ReportDelivery(props: ReportDeliveryProps) {
  const {
    edit,
    editDefinitionId,
    reportDefinitionRequest,
    httpClientProps,
    showDeliveryChannelError,
    deliveryChannelError,
  } = props;

  const [sendNotification, setSendNotification] = useState(false);
  const [channels, setChannels] = useState([]);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [notificationSubject, setNotificationSubject] = useState('New report');
  const [notificationMessage, setNotificationMessage] = useState('New report available to view');
  const [selectedTab, setSelectedTab] = React.useState<'write' | 'preview'>(
    'write'
  );
  const [testMessageConfirmation, setTestMessageConfirmation] = useState('');

  const handleSendNotification = (e: { target: { checked: boolean }; }) => {
    setSendNotification(e.target.checked);
    includeDelivery = e.target.checked;
    if (includeDelivery) {
      reportDefinitionRequest.delivery.title = 'New report';
      reportDefinitionRequest.delivery.textDescription = 'New report available to view';
    }
    else {
      reportDefinitionRequest.delivery.title = `\u2014`;
      reportDefinitionRequest.delivery.textDescription = `\u2014`;
    }
  }

  const handleSelectedChannels = (e: Array<{ label: string, id: string}>) => {
    setSelectedChannels(e);
    reportDefinitionRequest.delivery.configIds = [];
    for (let i = 0; i < e.length; ++i) {
      reportDefinitionRequest.delivery.configIds.push(e[i].id);
    }
  }

  const handleNotificationSubject = (e: { target: { value: string }; }) => {
    setNotificationSubject(e.target.value);
    reportDefinitionRequest.delivery.title = e.target.value;
  }

  const handleNotificationMessage = (e: string) => {
    setNotificationMessage(e);
    reportDefinitionRequest.delivery.textDescription = e.toString();
    reportDefinitionRequest.delivery.htmlDescription = converter.makeHtml(e.toString());
  }

  const handleTestMessageConfirmation = (e: string) => {
    setTestMessageConfirmation(e);
  }

  const defaultCreateDeliveryParams = () => {
    includeDelivery = false;
    reportDefinitionRequest.delivery = {
      configIds: [],
      title: `\u2014`, // default values before any Notifications settings are configured
      textDescription: `\u2014`,
      htmlDescription: ''
    };
  };

  const sendTestNotificationsMessage = () => {
    // on success, set test message confirmation message
    // for each config ID in the current channels list

    for (let i = 0; i < selectedChannels.length; ++i) {
      httpClientProps
        .get(`../api/notifications/test_message/${selectedChannels[i].id}`, 
        {
          query: {
            feature: 'reports'
          }
        })
        .then(() => {
          handleTestMessageConfirmation(testMessageConfirmationMessage);
        })
        .catch((error: string) => {
          console.log('error sending test message:', error);
        })
    }
  }

  useEffect(() => {
    httpClientProps
      .get('../api/notifications/get_configs', {
        query: getChannelsQueryObject
      })
      .then(async (response: any) => {  
        let availableChannels = getAvailableNotificationsChannels(response.config_list);
        setChannels(availableChannels);
        return availableChannels;
      })
      .then((availableChannels: any) => {
        if (edit) {
          httpClientProps
            .get(`../api/reporting/reportDefinitions/${editDefinitionId}`)
            .then(async (response: any) => {
              if (response.report_definition.delivery.configIds.length > 0) {
                // add config IDs
                handleSendNotification({target: {checked: true}});
                let delivery = response.report_definition.delivery;
                let editChannelOptions = [];
                for (let i = 0; i < delivery.configIds.length; ++i) {
                  for (let j = 0; j < availableChannels.length; ++j) {
                    if (delivery.configIds[i] === availableChannels[j].id) {
                      let editChannelOption = {
                        label: availableChannels[j].label,
                        id: availableChannels[j].id
                      };
                      editChannelOptions.push(editChannelOption);                  
                    }
                  }
                }
                setSelectedChannels(editChannelOptions);
                setNotificationSubject(delivery.title);
                setNotificationMessage(delivery.textDescription);
                reportDefinitionRequest.delivery = delivery;
              }
            });
        } else {
          defaultCreateDeliveryParams();
        }
      })
      .catch((error: string) => {
        console.log('error: cannot get available channels from Notifications plugin:', error);
      })
  }, []);

  const showNotificationsBody = sendNotification ? (
    <div>
      <EuiSpacer />
      <EuiFormRow 
        label='Channels'
        isInvalid={showDeliveryChannelError}
        error={deliveryChannelError}
      >
        <EuiComboBox
          id='notificationsChannelSelect'
          placeholder={'Select channels'}
          options={channels}
          selectedOptions={selectedChannels}
          onChange={handleSelectedChannels}
          isClearable={true}
        />
      </EuiFormRow>
      <EuiSpacer />
      <EuiFormRow
        label='Notification subject'
        helpText='Required if at least one channel type is Email.'
        style={styles}
      >
        <EuiFieldText
          placeholder={'Enter notification message subject'}
          fullWidth={true}
          value={notificationSubject}
          onChange={handleNotificationSubject}
        />
      </EuiFormRow>
      <EuiSpacer />
      <EuiFormRow
        label='Notification message'
        helpText='Embed variables in your message using Markdown.'
        style={styles}
      >
        <ReactMDE
          value={notificationMessage}
          onChange={handleNotificationMessage}
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
          toolbarCommands={[
            ['header', 'bold', 'italic', 'strikethrough'],
            ['unordered-list', 'ordered-list', 'checked-list'],
          ]}
          generateMarkdownPreview={(markdown) =>
            Promise.resolve(converter.makeHtml(markdown))
          }
        />
      </EuiFormRow>
      <EuiSpacer />
      <EuiFormRow
        helpText={testMessageConfirmation}
        fullWidth={true}
      >
        <EuiButton
          onClick={sendTestNotificationsMessage}
        >
          Send test message
        </EuiButton>
      </EuiFormRow>
    </div>
  ) : null;

  return (
    <EuiPageContent panelPaddingSize={'l'}>
      <EuiPageHeader>
        <EuiTitle>
          <h2>Notification settings</h2>
        </EuiTitle>
      </EuiPageHeader>
      <EuiHorizontalRule />
      <EuiPageContentBody>
        <EuiCheckbox
          id='notificationsDeliveryCheckbox'
          label='Send notification when report is available'
          checked={sendNotification}
          onChange={handleSendNotification}
        />
        {showNotificationsBody}
      </EuiPageContentBody>
    </EuiPageContent>
  );
}
