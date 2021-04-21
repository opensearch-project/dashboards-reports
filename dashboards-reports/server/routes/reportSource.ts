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

import {
  IRouter,
  IOpenSearchDashboardsResponse,
  ResponseError,
} from '../../../../src/core/server';
import { API_PREFIX } from '../../common';
import { checkErrorType, parseOpenSearchErrorResponse } from './utils/helpers';
import { RequestParams } from '@elastic/elasticsearch';
import { schema } from '@osd/config-schema';
import { DEFAULT_MAX_SIZE } from './utils/constants';
import { addToMetric } from './utils/metricHelper';

export default function (router: IRouter) {
  router.get(
    {
      path: `${API_PREFIX}/getReportSource/{reportSourceType}`,
      validate: {
        params: schema.object({
          reportSourceType: schema.string(),
        }),
      },
    },
    async (
      context,
      request,
      response
    ): Promise<IOpenSearchDashboardsResponse<any | ResponseError>> => {
      let responseParams;
      if (request.params.reportSourceType === 'dashboard') {
        const params: RequestParams.Search = {
          index: '.opensearch_dashboards',
          q: 'type:dashboard',
          size: DEFAULT_MAX_SIZE,
        };
        responseParams = params;
      } else if (request.params.reportSourceType === 'visualization') {
        const params: RequestParams.Search = {
          index: '.opensearch_dashboards',
          q: 'type:visualization',
          size: DEFAULT_MAX_SIZE,
        };
        responseParams = params;
      } else if (request.params.reportSourceType === 'search') {
        const params: RequestParams.Search = {
          index: '.opensearch_dashboards',
          q: 'type:search',
          size: DEFAULT_MAX_SIZE,
        };
        responseParams = params;
      } else if (request.params.reportSourceType === 'notebooks') {
        const params: RequestParams.Search = {
          index: '.opendistro-notebooks',
          size: DEFAULT_MAX_SIZE,
        };
        responseParams = params;
      } try {
        const opensearchResp = await context.core.opensearch.legacy.client.callAsCurrentUser(
          'search',
          responseParams
        );
        addToMetric('report_source', 'list', 'count');

        return response.ok({
          body: opensearchResp,
        });
      } catch (error) {
        //@ts-ignore
        context.reporting_plugin.logger.error(
          `Failed to get reports source for ${request.params.reportSourceType}: ${error}`
        );
        addToMetric('report_source', 'list', checkErrorType(error));
        return response.custom({
          statusCode: error.statusCode,
          body: parseOpenSearchErrorResponse(error),
        });
      }
    }
  );
}
