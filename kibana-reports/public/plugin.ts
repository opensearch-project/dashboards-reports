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
  AppMountParameters,
  CoreSetup,
  CoreStart,
  Plugin,
} from '../../../src/core/public';
import {
  OpendistroReportsOpenSearchDashboardsPluginSetup,
  OpendistroReportsOpenSearchDashboardsPluginStart,
  AppPluginStartDependencies,
} from './types';
import './components/context_menu/context_menu';
import { PLUGIN_NAME } from '../common';

export class OpendistroReportsOpenSearchDashboardsPlugin
  implements
    Plugin<
      OpendistroReportsOpenSearchDashboardsPluginSetup,
      OpendistroReportsOpenSearchDashboardsPluginStart
    > {
  public setup(core: CoreSetup): OpendistroReportsOpenSearchDashboardsPluginSetup {
    // Register an application into the side navigation menu
    core.application.register({
      id: PLUGIN_NAME,
      title: 'Reporting',
      category: {
        id: 'odfe',
        label: 'Open Distro for Elasticsearch',
        order: 2000,
      },
      order: 2000,
      async mount(params: AppMountParameters) {
        // Load application bundle
        const { renderApp } = await import('./application');
        // Get start services as specified in opensearch_dashboards.json
        const [coreStart, depsStart] = await core.getStartServices();
        // Render the application
        return renderApp(
          coreStart,
          depsStart as AppPluginStartDependencies,
          params
        );
      },
    });

    // Return methods that should be available to other plugins
    return {};
  }

  public start(core: CoreStart): OpendistroReportsOpenSearchDashboardsPluginStart {
    return {};
  }

  public stop() {}
}
