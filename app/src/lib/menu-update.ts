import { MenuIDs } from '../models/menu-ids'
import { merge } from './merge'
import { IAppState } from '../lib/app-state'
import { updateMenuState as ipcUpdateMenuState } from '../ui/main-process-proxy'
import { AppMenu, MenuItem } from '../models/app-menu'

export interface IMenuItemState {
  readonly enabled?: boolean
}

/**
 * Utility class for coalescing updates to menu items
 */
class MenuStateBuilder {
  private readonly _state: Map<MenuIDs, IMenuItemState>

  public constructor(state: Map<MenuIDs, IMenuItemState> = new Map()) {
    this._state = state
  }

  /**
   * Returns an Map where each key is a MenuID and the values
   * are IMenuItemState instances containing information about
   * whether a particular menu item should be enabled/disabled or
   * visible/hidden.
   */
  public get state() {
    return new Map<MenuIDs, IMenuItemState>(this._state)
  }

  private updateMenuItem<K extends keyof IMenuItemState>(
    id: MenuIDs,
    state: Pick<IMenuItemState, K>
  ) {
    const currentState = this._state.get(id) || {}
    this._state.set(id, merge(currentState, state))
  }

  /** Set the state of the given menu item id to enabled */
  public enable(id: MenuIDs): this {
    this.updateMenuItem(id, { enabled: true })
    return this
  }

  /** Set the state of the given menu item id to disabled */
  public disable(id: MenuIDs): this {
    this.updateMenuItem(id, { enabled: false })
    return this
  }

  /** Set the enabledness of the given menu item id */
  public setEnabled(id: MenuIDs, enabled: boolean): this {
    this.updateMenuItem(id, { enabled })
    return this
  }

  /**
   * Create a new state builder by merging the current state with the state from
   * the other state builder. This will replace values in `this` with values
   * from `other`.
   */
  public merge(other: MenuStateBuilder): MenuStateBuilder {
    const merged = new Map<MenuIDs, IMenuItemState>(this._state)
    for (const [key, value] of other._state) {
      merged.set(key, value)
    }
    return new MenuStateBuilder(merged)
  }
}

function menuItemStateEqual(state: IMenuItemState, menuItem: MenuItem) {
  if (
    state.enabled !== undefined &&
    menuItem.type !== 'separator' &&
    menuItem.enabled !== state.enabled
  ) {
    return false
  }

  return true
}

const allMenuIds: ReadonlyArray<MenuIDs> = [
  'rename-branch',
  'delete-branch',
  'discard-all-changes',
  'stash-all-changes',
  'preferences',
  'update-branch-with-contribution-target-branch',
  'compare-to-branch',
  'merge-branch',
  'rebase-branch',
  'view-repository-on-github',
  'compare-on-github',
  'branch-on-github',
  'open-in-shell',
  'push',
  'pull',
  'branch',
  'repository',
  'go-to-commit-message',
  'create-branch',
  'show-changes',
  'show-history',
  'show-repository-list',
  'show-branches-list',
  'open-working-directory',
  'show-repository-settings',
  'open-external-editor',
  'remove-repository',
  'new-repository',
  'add-local-repository',
  'clone-repository',
  'about',
  'create-pull-request',
  'squash-and-merge-branch',
]

function getAllMenusDisabledBuilder(): MenuStateBuilder {
  const menuStateBuilder = new MenuStateBuilder()

  for (const menuId of allMenuIds) {
    menuStateBuilder.disable(menuId)
  }

  return menuStateBuilder
}

function getMenuState(state: IAppState): Map<MenuIDs, IMenuItemState> {
  if (state.currentPopup) {
    return getAllMenusDisabledBuilder().state
  }

  return getAllMenusEnabledBuilder()
    .merge(getInWelcomeFlowBuilder(state.showWelcomeFlow)).state
}

function getAllMenusEnabledBuilder(): MenuStateBuilder {
  const menuStateBuilder = new MenuStateBuilder()
  for (const menuId of allMenuIds) {
    menuStateBuilder.enable(menuId)
  }
  return menuStateBuilder
}

function getInWelcomeFlowBuilder(inWelcomeFlow: boolean): MenuStateBuilder {
  const welcomeScopedIds: ReadonlyArray<MenuIDs> = [
    'new-repository',
    'add-local-repository',
    'clone-repository',
    'preferences',
    'about',
  ]

  const menuStateBuilder = new MenuStateBuilder()
  if (inWelcomeFlow) {
    for (const id of welcomeScopedIds) {
      menuStateBuilder.disable(id)
    }
  } else {
    for (const id of welcomeScopedIds) {
      menuStateBuilder.enable(id)
    }
  }

  return menuStateBuilder
}

/**
 * Update the menu state in the main process.
 *
 * This function will set the enabledness and visibility of menu items
 * in the main process based on the AppState. All changes will be
 * batched together into one ipc message.
 */
export function updateMenuState(
  state: IAppState,
  currentAppMenu: AppMenu | null
) {
  const menuState = getMenuState(state)

  // Try to avoid updating sending the IPC message at all
  // if we have a current app menu that we can compare against.
  if (currentAppMenu) {
    for (const [id, menuItemState] of menuState.entries()) {
      const appMenuItem = currentAppMenu.getItemById(id)

      if (appMenuItem && menuItemStateEqual(menuItemState, appMenuItem)) {
        menuState.delete(id)
      }
    }
  }

  if (menuState.size === 0) {
    return
  }

  // because we can't send Map over the wire, we need to convert
  // the remaining entries into an array that can be serialized
  const array = new Array<{ id: MenuIDs; state: IMenuItemState }>()
  menuState.forEach((value, key) => array.push({ id: key, state: value }))
  ipcUpdateMenuState(array)
}
