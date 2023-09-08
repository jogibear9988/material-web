/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import '../../divider/divider.js';

import {html, isServer, LitElement, PropertyValues} from 'lit';
import {property, queryAssignedElements, state} from 'lit/decorators.js';

import {polyfillElementInternalsAria, setupHostAria} from '../../internal/aria/aria.js';

import {ANIMATE_INDICATOR, Tab} from './tab.js';

const NAVIGATION_KEYS = new Map([
  ['default', new Set(['Home', 'End'])],
  ['horizontal', new Set(['ArrowLeft', 'ArrowRight'])],
]);

/**
 * @fires change Fired when the selected tab changes. The target's selected or
 * selectedItem and previousSelected or previousSelectedItem provide information
 * about the selection change. The change event is fired when a user interaction
 * like a space/enter key or click cause a selection change. The tab selection
 * based on these actions can be cancelled by calling preventDefault on the
 * triggering `keydown` or `click` event.
 *
 * @example
 * // perform an action if a tab is clicked
 * tabs.addEventListener('change', (event: Event) => {
 *   if (event.target.selected === 2)
 *      takeAction();
 *   }
 * });
 *
 * // prevent a click from triggering tab selection under some condition
 * tabs.addEventListener('click', (event: Event) => {
 *   if (notReady)
 *      event.preventDefault();
 *   }
 * });
 *
 */
export class Tabs extends LitElement {
  static {
    setupHostAria(Tabs, {focusable: false});
  }

  /**
   * The tabs of this tab bar.
   */
  get tabs() {
    return this.maybeTabItems.filter(isTab);
  }

  /**
   * Index of the selected item.
   */
  @property({type: Number}) selected = 0;

  /**
   * Whether or not to select an item when focused.
   */
  @property({type: Boolean, attribute: 'select-on-focus'})
  selectOnFocus = false;

  private previousSelected = -1;
  private readonly scrollMargin = 48;

  @queryAssignedElements({flatten: true})
  private readonly maybeTabItems!: HTMLElement[];

  // this tracks if items have changed, which triggers rendering so they can
  // be kept in sync
  @state() private itemsDirty = false;

  /**
   * The item currently selected.
   */
  get selectedItem() {
    return this.tabs[this.selected];
  }

  /**
   * The item previously selected.
   */
  private get previousSelectedItem() {
    return this.tabs[this.previousSelected];
  }

  /**
   * The item currently focused.
   */
  private get focusedItem() {
    return this.tabs.find((el: HTMLElement) => el.matches(':focus-within'));
  }

  private readonly internals = polyfillElementInternalsAria(
      this, (this as HTMLElement /* needed for closure */).attachInternals());

  constructor() {
    super();
    if (!isServer) {
      this.internals.role = 'tablist';
      this.addEventListener('keydown', this.handleKeydown);
      this.addEventListener('keyup', this.handleKeyup);
      this.addEventListener('focusout', this.handleFocusout);
    }
  }

  protected override willUpdate(changed: PropertyValues) {
    if (changed.has('selected')) {
      this.previousSelected = changed.get('selected') ?? -1;
    }
    if (this.itemsDirty) {
      this.itemsDirty = false;
      this.previousSelected = -1;
    }
  }

  protected override render() {
    return html`
      <div class="tabs">
        <slot @slotchange=${this.handleSlotChange} @click=${
        this.handleItemClick}></slot>
      </div>
      <md-divider part="divider"></md-divider>
    `;
  }

  protected override async updated(changed: PropertyValues) {
    const itemsChanged = changed.has('itemsDirty');
    // sync state with items.
    if (itemsChanged) {
      this.tabs.forEach((item, i) => {
        item.active = this.selected === i;
      });
    }
    if (itemsChanged || changed.has('selected')) {
      if (this.previousSelectedItem && this.selectedItem &&
          this.previousSelectedItem !== this.selectedItem) {
        this.previousSelectedItem.active = false;
        this.selectedItem.active = true;
        this.selectedItem[ANIMATE_INDICATOR](this.previousSelectedItem);
      }
      if (this.selectedItem !== this.focusedItem) {
        this.updateFocusableItem(this.selectedItem);
      }
      await this.scrollItemIntoView();
    }
  }

  // focus item on keydown and optionally select it
  private readonly handleKeydown = async (event: KeyboardEvent) => {
    const {key} = event;
    const shouldHandleKey = NAVIGATION_KEYS.get('default')!.has(key) ||
        NAVIGATION_KEYS.get('horizontal')!.has(key);
    // await to after user may cancel event.
    if (!shouldHandleKey || (await this.wasEventPrevented(event, true))) {
      return;
    }
    let indexToFocus = -1;
    const focused = this.focusedItem ?? this.selectedItem;
    const itemCount = this.tabs.length;
    const isPrevKey = key === 'ArrowLeft' || key === 'ArrowUp';
    if (key === 'Home') {
      indexToFocus = 0;
    } else if (key === 'End') {
      indexToFocus = itemCount - 1;
    } else {
      const focusedIndex = this.tabs.indexOf(focused) || 0;
      indexToFocus = focusedIndex + (isPrevKey ? -1 : 1);
      indexToFocus =
          indexToFocus < 0 ? itemCount - 1 : indexToFocus % itemCount;
    }
    const itemToFocus = this.tabs[indexToFocus];
    if (itemToFocus !== null && itemToFocus !== focused) {
      this.updateFocusableItem(itemToFocus);
      itemToFocus.focus();
      if (this.selectOnFocus) {
        this.selected = indexToFocus;
        await this.dispatchInteraction();
      }
    }
  };

  // scroll to item on keyup.
  private readonly handleKeyup = () => {
    this.scrollItemIntoView(this.focusedItem ?? this.selectedItem);
  };

  // restore focus to selected item when blurring.
  private readonly handleFocusout = async () => {
    await this.updateComplete;
    const nowFocused =
        (this.getRootNode() as unknown as DocumentOrShadowRoot).activeElement as
        Tab;
    if (this.tabs.indexOf(nowFocused) === -1) {
      this.updateFocusableItem(this.selectedItem);
    }
  };

  // Note, this is async to allow the event to bubble to user code, which
  // may call `preventDefault`. If it does, avoid performing the tabs action
  // which is selecting a new tab. Sometimes, the native event must be
  // prevented to avoid, for example, scrolling. In this case, the event is
  // patched to be able to detect if the user calls prevent default.
  // Alternatively, the event could be stopped and re-dispatched synchroously,
  // but this would be complicated since the event should be re-dispatched from
  // the initial element to potentially trigger a native action (e.g. a history
  // navigation via a tab label), and this could result in some listener hearing
  // 2x events.
  private async wasEventPrevented(event: Event, preventNativeDefault = false) {
    if (preventNativeDefault) {
      // prevent native default to stop, e.g. scrolling.
      event.preventDefault();
      // reset prevention to see if user is cancelling this action.
      Object.defineProperties(event, {
        'defaultPrevented': {value: false, writable: true, configurable: true},
        'preventDefault': {
          // Type needed for closure conformance. Using the Event type results
          // in a type error.
          value(this: {defaultPrevented: boolean}) {
            this.defaultPrevented = true;
          },
          writable: true,
          configurable: true
        }
      });
    }
    // allow event to propagate to user code.
    await new Promise(requestAnimationFrame);
    return event.defaultPrevented;
  }

  private async dispatchInteraction() {
    // wait for items to render.
    await new Promise(requestAnimationFrame);
    const event = new Event('change', {bubbles: true});
    this.dispatchEvent(event);
  }

  private updateFocusableItem(focusableItem: HTMLElement|null) {
    for (const item of this.tabs) {
      item.tabIndex = item === focusableItem ? 0 : -1;
    }
  }

  private async handleItemClick(event: Event) {
    const {target} = event;
    if (await this.wasEventPrevented(event)) {
      return;
    }
    const item = (target as Element).closest(`${this.localName} > *`) as Tab;
    const i = this.tabs.indexOf(item);
    if (i > -1 && this.selected !== i) {
      this.selected = i;
      this.updateFocusableItem(this.selectedItem);
      // note, Safari will not focus the button here, but if focus is manually
      // triggered, this can match focus-visible and show the focus-ring,
      // so avoid the temptation to cal focus!
      await this.dispatchInteraction();
    }
  }

  private handleSlotChange() {
    this.itemsDirty = true;
  }

  private async itemsUpdateComplete() {
    for (const item of this.tabs) {
      await item.updateComplete;
    }
    return true;
  }

  // ensures the given item is visible in view; defaults to the selected item
  private async scrollItemIntoView(item = this.selectedItem) {
    if (!item) {
      return;
    }
    // wait for items to render.
    await this.itemsUpdateComplete();
    const offset = item.offsetLeft;
    const extent = item.offsetWidth;
    const scroll = this.scrollLeft;
    const hostExtent = this.offsetWidth;
    const min = offset - this.scrollMargin;
    const max = offset + extent - hostExtent + this.scrollMargin;
    const to = Math.min(min, Math.max(max, scroll));
    const behavior =
        // type annotation because `instant` is valid but not included in type.
        this.focusedItem !== undefined ? 'smooth' : 'instant' as ScrollBehavior;
    this.scrollTo({behavior, top: 0, left: to});
  }
}

function isTab(element: HTMLElement): element is Tab {
  return element instanceof Tab;
}
