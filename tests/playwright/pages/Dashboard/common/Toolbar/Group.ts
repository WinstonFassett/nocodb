import { expect } from '@playwright/test';
import BasePage from '../../../Base';
import { ToolbarPage } from './index';
import { getTextExcludeIconText } from '../../../../tests/utils/general';

export class ToolbarGroupPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`[data-testid="nc-groups-menu"]`);
  }

  async verify({ index, column, direction }: { index: number; column: string; direction: string }) {
    const fieldLocator = await this.get().locator('.nc-group-field-select').nth(index);
    const fieldText = await getTextExcludeIconText(fieldLocator);
    await expect(fieldText).toBe(column);

    await expect(
      await this.get().locator('.nc-group-dir-select >> span.ant-select-selection-item').nth(index)
    ).toHaveText(direction);
  }

  async add({
    columnTitle,
    isAscending,
    isLocallySaved,
  }: {
    columnTitle: string;
    isAscending: boolean;
    isLocallySaved: boolean;
  }) {
    // open group menu
    await this.toolbar.clickGroup();

    await this.get().locator(`button:has-text("Add Group Option")`).click();

    // read content of the dropdown
    const col = await this.rootPage.locator('.nc-group-field-select').textContent();
    if (col !== columnTitle) {
      await this.rootPage.locator('.nc-group-field-select').last().click();
      await this.rootPage
        .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
        .locator(`div[label="${columnTitle}"]`)
        .last()
        .click();
    }

    // network request will be triggered only after dir-select is clicked
    //
    // const selectColumn = this.rootPage
    //   .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
    //   .locator(`div[label="${columnTitle}"]`)
    //   .last()
    //   .click();
    // await this.waitForResponse({
    //   uiAction: selectColumn,
    //   httpMethodsToMatch: isLocallySaved ? ['GET'] : ['POST', 'PATCH'],
    //   requestUrlPathToMatch: isLocallySaved ? `/api/v1/db/public/` : `/groups`,
    // });
    // await this.toolbar.parent.dashboard.waitForLoaderToDisappear();

    await this.rootPage.locator('.nc-group-dir-select').last().click();
    const selectGroupDirection = () =>
      this.rootPage
        .locator('.nc-dropdown-group-dir')
        .locator('.ant-select-item')
        .nth(isAscending ? 0 : 1)
        .click();

    await this.waitForResponse({
      uiAction: selectGroupDirection,
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: isLocallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
    });
    await this.toolbar.parent.dashboard.waitForLoaderToDisappear();
    // close group menu
    await this.toolbar.clickGroup();
    await this.toolbar.parent.waitLoading();
  }

  // todo: remove this opening group menu logic
  async reset() {
    // open group menu
    await this.toolbar.clickGroup();

    await this.get().locator('.nc-group-item-remove-btn').click();

    // close group menu
    await this.toolbar.clickGroup();
  }

  click({ title }: { title: string }) {
    return this.get().locator(`[data-testid="nc-fields-menu-${title}"]`).locator('input[type="checkbox"]').click();
  }
}
