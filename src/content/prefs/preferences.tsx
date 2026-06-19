import React from 'react';
import ReactDOM from 'react-dom';
import type { createRoot } from 'react-dom/client';

import { logger } from '../utils';

import { SchemaPanel, type TitleFormatOption } from './schema-panel';
import { SyncConfigsTable } from './sync-configs-table';
import {
  ZotanaPref,
  PAGE_TITLE_FORMAT_L10N_IDS,
  PageTitleFormat,
  getZotanaPref,
  setZotanaPref,
} from './zotana-pref';

type ReactDOMClient = typeof ReactDOM & { createRoot: typeof createRoot };

class Preferences {
  public async init(): Promise<void> {
    await Zotero.uiReadyPromise;

    this.initTextPref('zotana-tanaToken', ZotanaPref.tanaToken);
    this.initTextPref('zotana-tanaParentNodeId', ZotanaPref.tanaParentNodeId);
    this.initTextPref('zotana-tanaBaseUrl', ZotanaPref.tanaBaseUrl);

    const titleFormatOptions = await this.buildTitleFormatOptions();
    this.initSchemaPanel(titleFormatOptions);
    await this.initSyncConfigsTable();
  }

  private initSchemaPanel(titleFormatOptions: TitleFormatOption[]): void {
    const container = document.getElementById('zotana-schemaPanel-container');
    if (!container) {
      logger.error('Failed to find schema panel container');
      return;
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    (ReactDOM as ReactDOMClient)
      .createRoot(container)
      .render(<SchemaPanel titleFormatOptions={titleFormatOptions} />);
  }

  /**
   * Bind a plain text input to a string preference: populate from the stored
   * value and write back (trimmed) on input. Zotero's native `preference`
   * binding is reserved for the checkbox; text inputs are handled here.
   */
  private initTextPref(elementId: string, pref: ZotanaPref): void {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const input = document.getElementById(elementId) as HTMLInputElement | null;
    if (!input) {
      logger.error(`Failed to find input '${elementId}'`);
      return;
    }

    const current = getZotanaPref(pref);
    if (typeof current === 'string') input.value = current;

    input.addEventListener('input', () => {
      setZotanaPref(pref, input.value.trim());
    });
  }

  /**
   * Resolve the localized reference-node-title dropdown options (rendered inside
   * the React schema panel). The citation-key option needs Better BibTeX.
   */
  private async buildTitleFormatOptions(): Promise<TitleFormatOption[]> {
    const isBetterBibTeXActive = await this.isBetterBibTeXActive();

    const options: TitleFormatOption[] = [];
    for (const format of Object.values(PageTitleFormat)) {
      const label = await document.l10n.formatValue(
        PAGE_TITLE_FORMAT_L10N_IDS[format],
      );
      options.push({
        value: format,
        label: label || format,
        disabled:
          format === PageTitleFormat.itemCitationKey && !isBetterBibTeXActive,
      });
    }
    return options;
  }

  private async initSyncConfigsTable(): Promise<void> {
    // oxlint-disable-next-line typescript/no-non-null-assertion
    const syncConfigsTableContainer = document.getElementById(
      'zotana-syncConfigsTable-container',
    )!;
    const collection = await document.l10n.formatValue(
      'zotana-preferences-collection-column',
    );
    const syncEnabled = await document.l10n.formatValue(
      'zotana-preferences-sync-enabled-column',
    );
    const columnLabels = {
      collectionFullName: collection || 'Collection',
      syncEnabled: syncEnabled || 'Sync Enabled',
    };

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    (ReactDOM as ReactDOMClient)
      .createRoot(syncConfigsTableContainer)
      .render(
        <SyncConfigsTable
          columnLabels={columnLabels}
          container={syncConfigsTableContainer}
        />,
      );
  }

  private async isBetterBibTeXActive(): Promise<boolean> {
    const { AddonManager } = ChromeUtils.importESModule(
      'resource://gre/modules/AddonManager.sys.mjs',
    );
    const addon = await AddonManager.getAddonByID(
      'better-bibtex@iris-advies.com',
    );
    return Boolean(addon?.isActive);
  }
}

type WindowWithZotanaPreferences = typeof window & {
  Zotana_Preferences: Preferences;
};

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
(window as WindowWithZotanaPreferences).Zotana_Preferences = new Preferences();
