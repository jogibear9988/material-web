/**
 * @license
 * Copyright 2023 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import '../../menu/menu.js';

import {html, LitElement, PropertyValues} from 'lit';
import {property, query, queryAssignedElements, state} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {html as staticHtml, StaticValue} from 'lit/static-html.js';

import {redispatchEvent} from '../../internal/controller/events.js';
import {List} from '../../list/internal/list.js';
import {DEFAULT_TYPEAHEAD_BUFFER_TIME, Menu} from '../../menu/internal/menu.js';
import {CloseMenuEvent, isElementInSubtree, isSelectableKey} from '../../menu/internal/shared.js';
import {TYPEAHEAD_RECORD} from '../../menu/internal/typeaheadController.js';

import {createRequestDeselectionEvent, createRequestSelectionEvent, getSelectedItems, SelectOption, SelectOptionRecord} from './shared.js';

const VALUE = Symbol('value');

/**
 * @fires input Fired when a selection is made by the user via mouse or keyboard
 * interaction.
 * @fires change Fired when a selection is made by the user via mouse or
 * keyboard interaction.
 * @fires opening Fired when the select's menu is about to open.
 * @fires opened Fired when the select's menu has finished animations and
 * opened.
 * @fires closing Fired when the select's menu is about to close.
 * @fires closed Fired when the select's menu has finished animations and
 * closed.
 */
export abstract class Select extends LitElement {
  /**
   * Opens the menu synchronously with no animation.
   */
  @property({type: Boolean}) quick = false;
  /**
   * Whether or not the select is required.
   */
  @property({type: Boolean}) required = false;
  /**
   * Disables the select.
   */
  @property({type: Boolean, reflect: true}) disabled = false;
  /**
   * The error message that replaces supporting text when `error` is true. If
   * `errorText` is an empty string, then the supporting text will continue to
   * show.
   *
   * Calling `reportValidity()` will automatically update `errorText` to the
   * native `validationMessage`.
   */
  @property({type: String, attribute: 'error-text'}) errorText = '';
  /**
   * The floating label for the field.
   */
  @property() label = '';
  /**
   * Conveys additional information below the text field, such as how it should
   * be used.
   */
  @property({type: String, attribute: 'supporting-text'}) supportingText = '';
  /**
   * Gets or sets whether or not the text field is in a visually invalid state.
   *
   * Calling `reportValidity()` will automatically update `error`.
   */
  @property({type: Boolean, reflect: true}) error = false;
  /**
   * Whether or not the underlying md-menu should be position: fixed to display
   * in a top-level manner.
   */
  @property({type: Boolean, attribute: 'menu-fixed'}) menuFixed = false;
  /**
   * The max time between the keystrokes of the typeahead select / menu behavior
   * before it clears the typeahead buffer.
   */
  @property({type: Number, attribute: 'typeahead-delay'})
  typeaheadDelay = DEFAULT_TYPEAHEAD_BUFFER_TIME;
  /**
   * Whether or not the text field has a leading icon. Used for SSR.
   */
  @property({type: Boolean, attribute: 'has-leading-icon'})
  hasLeadingIcon = false;
  /**
   * Text to display in the field. Only set for SSR.
   */
  @property({attribute: 'display-text'}) displayText = '';

  @state() private focused = false;
  @state() private open = false;
  @query('md-menu') private readonly menu!: Menu|null;
  @query('#label') private readonly labelEl!: HTMLElement;
  @queryAssignedElements({slot: 'leadingicon', flatten: true})
  private readonly leadingIcons!: Element[];

  /**
   * The value of the currently selected option.
   *
   * Note: For SSR, set `[selected]` on the requested option and `displayText`
   * rather than setting `value` setting `value` will incur a DOM query.
   */
  @property()
  get value(): string {
    return this[VALUE];
  }

  set value(value: string) {
    this.lastUserSetValue = value;
    this.select(value);
  }

  [VALUE] = '';

  get options() {
    // NOTE: this does a DOM query.
    return (this.menu?.items ?? []) as SelectOption[];
  }

  /**
   * The index of the currently selected option.
   *
   * Note: For SSR, set `[selected]` on the requested option and `displayText`
   * rather than setting `selectedIndex` setting `selectedIndex` will incur a
   * DOM query.
   */
  @property({type: Number, attribute: 'selected-index'})
  get selectedIndex(): number {
    // tslint:disable-next-line:enforce-name-casing
    const [_option, index] = (this.getSelectedOptions() ?? [])[0] ?? [];
    return index ?? -1;
  }

  set selectedIndex(index: number) {
    this.lastUserSetSelectedIndex = index;
    this.selectIndex(index);
  }

  /**
   * Returns an array of selected options.
   *
   * NOTE: md-select only suppoprts single selection.
   */
  get selectedOptions() {
    return (this.getSelectedOptions() ?? []).map(([option]) => option);
  }

  protected abstract readonly fieldTag: StaticValue;

  /**
   * Used for initializing select when the user sets the `value` directly.
   */
  private lastUserSetValue: string|null = null;

  /**
   * Used for initializing select when the user sets the `selectedIndex`
   * directly.
   */
  private lastUserSetSelectedIndex: number|null = null;

  /**
   * Used for `input` and `change` event change detection.
   */
  private lastSelectedOption: SelectOption|null = null;

  // tslint:disable-next-line:enforce-name-casing
  private lastSelectedOptionRecords: SelectOptionRecord[] = [];

  protected override render() {
    return html`
      <span
          class="select ${classMap(this.getRenderClasses())}"
          @focusout=${this.handleFocusout}>
        ${this.renderField()}
        ${this.renderMenu()}
      </span>
    `;
  }

  private getRenderClasses() {
    return {
      'disabled': this.disabled,
      'error': this.error,
      'open': this.open,
    };
  }

  private renderField() {
    // TODO(b/290078041): add aria-label/describedby
    return staticHtml`
      <${this.fieldTag}
          aria-haspopup="listbox"
          role="combobox"
          part="field"
          id="field"
          tabindex=${this.disabled ? '-1' : '0'}
          aria-expanded=${this.open ? 'true' : 'false'}
          class="field"
          label=${this.label}
          .focused=${this.focused || this.open}
          .populated=${!!this.displayText}
          .disabled=${this.disabled}
          .required=${this.required}
          .error=${this.error}
          ?has-start=${this.hasLeadingIcon}
          has-end
          supporting-text=${this.supportingText}
          error-text=${this.errorText}
          @keydown =${this.handleKeydown}
          @click=${this.handleClick}
          @focus=${this.handleFocus}
          @blur=${this.handleBlur}>
        ${this.renderFieldContent()}
      </${this.fieldTag}>`;
  }

  private renderFieldContent() {
    return [
      this.renderLeadingIcon(),
      this.renderLabel(),
      this.renderTrailingIcon(),
    ];
  }

  private renderLeadingIcon() {
    return html`
      <span class="icon leading" slot="start">
         <slot name="leadingicon" @slotchange=${this.handleIconChange}></slot>
      </span>
     `;
  }

  private renderTrailingIcon() {
    return html`
      <span class="icon trailing" slot="end">
        <slot name="trailingicon" @slotchange=${this.handleIconChange}>
          <svg height="5" viewBox="7 10 10 5" focusable="false">
            <polygon class="down" stroke="none" fill-rule="evenodd" points="7 10 12 15 17 10"></polygon>
            <polygon class="up" stroke="none" fill-rule="evenodd" points="7 15 12 10 17 15"></polygon>
          </svg>
        </slot>
      </span>
     `;
  }

  private renderLabel() {
    // need to render &nbsp; so that line-height can apply and give it a
    // non-zero height
    return html`<div id="label">${this.displayText || html`&nbsp;`}</div>`;
  }

  private renderMenu() {
    return html`
      <md-menu
          id="listbox"
          default-focus="NONE"
          type="listbox"
          stay-open-on-focusout
          part="menu"
          exportparts="focus-ring: menu-focus-ring"
          anchor="field"
          .open=${this.open}
          .quick=${this.quick}
          .fixed=${this.menuFixed}
          .typeaheadDelay=${this.typeaheadDelay}
          @opening=${this.handleOpening}
          @opened=${this.redispatchEvent}
          @closing=${this.redispatchEvent}
          @closed=${this.redispatchEvent}
          @close-menu=${this.handleCloseMenu}
          @request-selection=${this.handleRequestSelection}
          @request-deselection=${this.handleRequestDeselection}>
        ${this.renderMenuContent()}
      </md-menu>`;
  }

  private renderMenuContent() {
    return html`<slot></slot>`;
  }

  /**
   * Handles opening the select on keydown and typahead selection when the menu
   * is closed.
   */
  private handleKeydown(event: KeyboardEvent) {
    if (this.open || this.disabled || !this.menu) {
      return;
    }

    const typeaheadController = this.menu.typeaheadController;
    const isOpenKey = event.code === 'Space' || event.code === 'ArrowDown' ||
        event.code === 'Enter';

    // Do not open if currently typing ahead because the user may be typing the
    // spacebar to match a word with a space
    if (!typeaheadController.isTypingAhead && isOpenKey) {
      event.preventDefault();
      this.open = true;
      return;
    }

    const isPrintableKey = event.key.length === 1;

    // Handles typing ahead when the menu is closed by delegating the event to
    // the underlying menu's typeaheadController
    if (isPrintableKey) {
      typeaheadController.onKeydown(event);
      event.preventDefault();

      const {lastActiveRecord} = typeaheadController;

      if (!lastActiveRecord) {
        return;
      }

      this.labelEl?.setAttribute?.('aria-live', 'polite');
      const hasChanged = this.selectItem(
          lastActiveRecord[TYPEAHEAD_RECORD.ITEM] as SelectOption);

      if (hasChanged) {
        this.dispatchInteractionEvents();
      }
    }
  }

  private handleClick() {
    this.open = true;
  }

  private handleFocus() {
    this.focused = true;
  }

  private handleBlur() {
    this.focused = false;
  }

  /**
   * Handles closing the menu when the focus leaves the select's subtree.
   */
  private handleFocusout(event: FocusEvent) {
    // Don't close the menu if we are switching focus between menu,
    // select-option, and field
    if (event.relatedTarget && isElementInSubtree(event.relatedTarget, this)) {
      return;
    }

    this.open = false;
  }

  /**
   * Gets a list of all selected select options as a list item record array.
   *
   * @return An array of selected list option records.
   */
  private getSelectedOptions() {
    if (!this.menu) {
      this.lastSelectedOptionRecords = [];
      return null;
    }

    const items = this.menu.items as SelectOption[];
    this.lastSelectedOptionRecords = getSelectedItems(items);
    return this.lastSelectedOptionRecords;
  }

  override async getUpdateComplete() {
    await this.menu?.updateComplete;
    return super.getUpdateComplete();
  }

  /**
   * Gets the selected options from the DOM, and updates the value and display
   * text to the first selected option's value and headline respectively.
   *
   * @return Whether or not the selected option has changed since last update.
   */
  private updateValueAndDisplayText() {
    const selectedOptions = this.getSelectedOptions() ?? [];
    // Used to determine whether or not we need to fire an input / change event
    // which fire whenever the option element changes (value or selectedIndex)
    // on user interaction.
    let hasSelectedOptionChanged = false;

    if (selectedOptions.length) {
      const [firstSelectedOption] = selectedOptions[0];
      hasSelectedOptionChanged =
          this.lastSelectedOption !== firstSelectedOption;
      this.lastSelectedOption = firstSelectedOption;
      this[VALUE] = firstSelectedOption.value;
      this.displayText = firstSelectedOption.headline;

    } else {
      hasSelectedOptionChanged = this.lastSelectedOption !== null;
      this.lastSelectedOption = null;
      this[VALUE] = '';
      this.displayText = '';
    }

    return hasSelectedOptionChanged;
  }

  protected override update(changed: PropertyValues<this>) {
    // In SSR the options will be ready to query, so try to figure out what
    // the value and display text should be.
    if (!this.hasUpdated) {
      this.initUserSelection();
    }

    super.update(changed);
  }

  protected override async firstUpdated(changed: PropertyValues<this>) {
    await this.menu?.updateComplete;
    // If this has been handled on update already due to SSR, try again.
    if (!this.lastSelectedOptionRecords.length) {
      this.initUserSelection();
    }

    super.firstUpdated(changed);
  }

  /**
   * Focuses and activates the last selected item upon opening, and resets other
   * active items.
   */
  private async handleOpening(e: Event) {
    this.labelEl?.removeAttribute?.('aria-live');
    this.redispatchEvent(e);

    const items = this.menu!.items;
    const activeItem = List.getActiveItem(items)?.item;
    const [selectedItem] = this.lastSelectedOptionRecords[0] ?? [null];

    // This is true if the user keys through the list but clicks out of the menu
    // thus no close-menu event is fired by an item and we can't clean up in
    // handleCloseMenu.
    if (activeItem && activeItem !== selectedItem) {
      activeItem.active = false;
    }

    if (selectedItem) {
      selectedItem.active = true;
      selectedItem.focus();
    }
  }

  private redispatchEvent(e: Event) {
    redispatchEvent(this, e);
  }

  /**
   * Determines the reason for closing, and updates the UI accordingly.
   */
  private handleCloseMenu(event: CloseMenuEvent) {
    const reason = event.detail.reason;
    const item = event.detail.itemPath[0] as SelectOption;
    this.open = false;
    let hasChanged = false;

    if (reason.kind === 'CLICK_SELECTION') {
      hasChanged = this.selectItem(item);
    } else if (reason.kind === 'KEYDOWN' && isSelectableKey(reason.key)) {
      hasChanged = this.selectItem(item);
    } else {
      // This can happen on ESC being pressed
      item.active = false;
      item.blur();
    }

    // Dispatch interaction events since selection has been made via keyboard
    // or mouse.
    if (hasChanged) {
      this.dispatchInteractionEvents();
    }
  }

  /**
   * Selects a given option, deselects other options, and updates the UI.
   *
   * @return Whether the last selected option has changed.
   */
  private selectItem(item: SelectOption) {
    this.lastSelectedOptionRecords.forEach(([option]) => {
      if (item !== option) {
        option.selected = false;
      }
    });
    item.selected = true;

    return this.updateValueAndDisplayText();
  }

  /**
   * Handles updating selection when an option element requests selection via
   * property / attribute change.
   */
  private handleRequestSelection(
      event: ReturnType<typeof createRequestSelectionEvent>) {
    const requestingOptionEl = event.target as SelectOption & HTMLElement;

    // No-op if this item is already selected.
    if (this.lastSelectedOptionRecords.some(
            ([option]) => option === requestingOptionEl)) {
      return;
    }

    this.selectItem(requestingOptionEl);
  }

  /**
   * Handles updating selection when an option element requests deselection via
   * property / attribute change.
   */
  private handleRequestDeselection(
      event: ReturnType<typeof createRequestDeselectionEvent>) {
    const requestingOptionEl = event.target as SelectOption & HTMLElement;

    // No-op if this item is not even in the list of tracked selected items.
    if (!this.lastSelectedOptionRecords.some(
            ([option]) => option === requestingOptionEl)) {
      return;
    }

    this.updateValueAndDisplayText();
  }

  /**
   * Selects an option given the value of the option, and updates MdSelect's
   * value.
   */
  select(value: string) {
    const optionToSelect = this.options.find(option => option.value === value);
    if (optionToSelect) {
      this.selectItem(optionToSelect);
    }
  }

  /**
   * Selects an option given the index of the option, and updates MdSelect's
   * value.
   */
  selectIndex(index: number) {
    const optionToSelect = this.options[index];
    if (optionToSelect) {
      this.selectItem(optionToSelect);
    }
  }

  /**
   * Attempts to initialize the selected option from user-settable values like
   * SSR, setting `value`, or `selectedIndex` at startup.
   */
  private initUserSelection() {
    // User has set `.value` directly, but internals have not yet booted up.
    if (this.lastUserSetValue && !this.lastSelectedOptionRecords.length) {
      this.select(this.lastUserSetValue);

      // User has set `.selectedIndex` directly, but internals have not yet
      // booted up.
    } else if (
        this.lastUserSetSelectedIndex !== null &&
        !this.lastSelectedOptionRecords.length) {
      this.selectIndex(this.lastUserSetSelectedIndex);

      // Regular boot up!
    } else {
      this.updateValueAndDisplayText();
    }
  }

  private handleIconChange() {
    this.hasLeadingIcon = this.leadingIcons.length > 0;
  }

  /**
   * Dispatches the `input` and `change` events.
   */
  private dispatchInteractionEvents() {
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    this.dispatchEvent(new Event('change', {bubbles: true}));
  }
}
