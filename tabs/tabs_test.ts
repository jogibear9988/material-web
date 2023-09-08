/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {html} from 'lit';

import {Environment} from '../testing/environment.js';
import {createTokenTests} from '../testing/tokens.js';

import {TabsHarness} from './harness.js';
import {MdPrimaryTab} from './primary-tab.js';
import {MdSecondaryTab} from './secondary-tab.js';
import {MdTabs} from './tabs.js';

interface TabsTestProps {
  selected?: number;
}

function getTabsTemplate(props?: TabsTestProps) {
  return html`
    <md-tabs
      .selected=${props?.selected ?? 0}
    >
      <md-primary-tab>A</md-primary-tab>
      <md-primary-tab>B</md-primary-tab>
      <md-primary-tab>C</md-primary-tab>
    </md-tabs>`;
}

describe('<md-tabs>', () => {
  const env = new Environment();

  async function setupTest(props?: TabsTestProps, template = getTabsTemplate) {
    const root = env.render(template(props));
    await env.waitForStability();
    const tab = root.querySelector<MdTabs>('md-tabs')!;
    const harness = new TabsHarness(tab);
    return {harness, root};
  }

  describe('.styles', () => {
    createTokenTests(MdTabs.styles);
    createTokenTests(MdPrimaryTab.styles);
    createTokenTests(MdSecondaryTab.styles);
  });

  describe('properties', () => {
    it('renders selected with indicator', async () => {
      const {harness} = await setupTest({selected: 1});
      expect(harness.element.selected).toBe(1);
      expect(harness.element.selectedItem)
          .toBe(harness.harnessedItems[1].element);
      harness.harnessedItems.forEach(async (tabHarness, i) => {
        const shouldBeSelected = i === harness.element.selected;
        await tabHarness.element.updateComplete;
        expect(tabHarness.element.selected).toBe(shouldBeSelected);
        expect(await tabHarness.isIndicatorShowing()).toBe(shouldBeSelected);
      });
      await env.waitForStability();
      harness.element.selected = 0;
      await harness.element.updateComplete;
      expect(harness.element.selected).toBe(0);
      harness.harnessedItems.forEach(async (tabHarness, i) => {
        const shouldBeSelected = i === harness.element.selected;
        await tabHarness.element.updateComplete;
        expect(tabHarness.element.selected).toBe(shouldBeSelected);
        expect(await tabHarness.isIndicatorShowing()).toBe(shouldBeSelected);
      });
    });

    it('updates selectedItem', async () => {
      const {harness} = await setupTest({selected: 1});
      expect(harness.element.selectedItem)
          .toBe(harness.harnessedItems[1].element);
      harness.element.selected = 0;
      await harness.element.updateComplete;
      expect(harness.element.selectedItem)
          .toBe(harness.harnessedItems[0].element);
    });

    it('maintains selection when tabs are mutated', async () => {
      const {harness} = await setupTest({selected: 1});
      expect(harness.element.selectedItem.textContent).toBe('B');
      const tab = document.createElement('md-primary-tab');
      tab.textContent = 'tab';
      // add before selected
      harness.element.prepend(tab);
      await env.waitForStability();
      expect(harness.element.selectedItem.textContent).toBe('A');
      // move after selected
      harness.element.selectedItem.after(tab);
      await env.waitForStability();
      expect(harness.element.selectedItem.textContent).toBe('tab');
      // move before selected
      harness.element.prepend(tab);
      await env.waitForStability();
      expect(harness.element.selectedItem.textContent).toBe('A');
      // remove
      tab.remove();
      await env.waitForStability();
      expect(harness.element.selectedItem.textContent).toBe('B');
    });
  });
});
