import { Account } from '../models/account'
import { IMenu } from '../models/app-menu'
import { Popup } from '../models/popup'
import { DeviceRegisterState } from '../stores'
import { WindowState } from './window-state'
import { Shell } from './shells'

import {
  ApplicationTheme,
  ICustomTheme,
} from '../ui/common/application-theme'
import { Banner } from '../models/banner'
import { DragElement } from '../models/drag-drop'
import { ILastThankYou } from '../models/last-thank-you'

/** All of the shared app state. */
export interface IAppState {
  readonly userList: any

  readonly accounts: ReadonlyArray<Account>

  /**
   * The state of the ongoing (if any) sign in process. See SignInState
   * and SignInStore for more details. Null if no current sign in flow
   * is active. Sign in flows are initiated through the dispatcher methods
   * beginDotComSignIn and beginEnterpriseSign in or via the
   * showDotcomSignInDialog and showEnterpriseSignInDialog methods.
   */
  readonly deviceRegisterState: DeviceRegisterState | null

  /**
   * The current state of the window, ie maximized, minimized full-screen etc.
   */
  readonly windowState: WindowState | null

  /**
   * The current zoom factor of the window represented as a fractional number
   * where 1 equals 100% (ie actual size) and 2 represents 200%.
   */
  readonly windowZoomFactor: number

  /**
   * A value indicating whether or not the current application
   * window has focus.
   */
  readonly appIsFocused: boolean

  // readonly showWelcomeFlow: boolean
  readonly showDeviceRegisterFlow: boolean
  // readonly focusCommitMessage: boolean
  readonly currentPopup: Popup | null
  readonly currentFoldout: Foldout | null
  readonly currentBanner: Banner | null

  /**
   * The shape of the drag element rendered in the `app.renderDragElement`. It
   * is used in conjunction with the `Draggable` component.
   */
  readonly currentDragElement: DragElement | null

  /**
   * A list of currently open menus with their selected items
   * in the application menu.
   *
   * The semantics around what constitutes an open menu and how
   * selection works is defined by the AppMenu class and the
   * individual components transforming that state.
   *
   * Note that as long as the renderer has received an application
   * menu from the main process there will always be one menu
   * "open", that is the root menu which can't be closed. In other
   * words, a non-zero length appMenuState does not imply that the
   * application menu should be visible. Currently thats defined by
   * whether the app menu is open as a foldout (see currentFoldout).
   *
   * Not applicable on macOS unless the in-app application menu has
   * been explicitly enabled for testing purposes.
   */
  readonly appMenuState: ReadonlyArray<IMenu>

  readonly errors: ReadonlyArray<Error>

  /** Map from the emoji shortcut (e.g., :+1:) to the image's local path. */
  readonly emoji: Map<string, string>

  /**
   * The width of the repository sidebar.
   *
   * This affects the changes and history sidebar
   * as well as the first toolbar section which contains
   * repo selection on all platforms and repo selection and
   * app menu on Windows.
   *
   * Lives on IAppState as opposed to IRepositoryState
   * because it's used in the toolbar as well as the
   * repository.
   */
  readonly sidebarWidth: IConstrainedValue

  /**
   * Used to highlight access keys throughout the app when the
   * Alt key is pressed. Only applicable on non-macOS platforms.
   */
  readonly highlightAccessKeys: boolean

  /** Whether we should show the update banner */
  readonly isUpdateAvailableBannerVisible: boolean

  /** Whether there is an update to showcase */
  readonly isUpdateShowcaseVisible: boolean

  /** Whether we should ask the user to move the app to /Applications */
  readonly askToMoveToApplicationsFolderSetting: boolean

  /** The external editor to use when opening repositories */
  readonly selectedExternalEditor: string | null

  /** The current setting for whether the user has disable usage reports */
  readonly optOutOfUsageTracking: boolean
  /**
   * A cached entry representing an external editor found on the user's machine:
   *
   *  - If the `selectedExternalEditor` can be found, choose that
   *  - Otherwise, if any editors found, this will be set to the first value
   *    based on the search order in `app/src/lib/editors/{platform}.ts`
   *  - If no editors found, this will remain `null`
   */
  readonly resolvedExternalEditor: string | null

  /** The user's preferred shell. */
  readonly selectedShell: Shell

  /** The selected appearance (aka theme) preference */
  readonly selectedTheme: ApplicationTheme

  /** The custom theme  */
  readonly customTheme?: ICustomTheme

  /** The currently applied appearance (aka theme) */
  readonly currentTheme: ApplicationTheme

  /**
   * Record of what logged in users have been checked to see if thank you is in
   * order for external contributions in latest release.
   */
  readonly lastThankYou: ILastThankYou | undefined

  /**
   * Whether or not the user enabled high-signal notifications.
   */
  readonly notificationsEnabled: boolean
}

export enum FoldoutType {
  AppMenu,
  AddMenu,
}

export type AppMenuFoldout = {
  type: FoldoutType.AppMenu

  /**
   * Whether or not the application menu was opened with the Alt key, this
   * enables access key highlighting for applicable menu items as well as
   * keyboard navigation by pressing access keys.
   */
  enableAccessKeyNavigation: boolean

  /**
   * Whether the menu was opened by pressing Alt (or Alt+X where X is an
   * access key for one of the top level menu items). This is used as a
   * one-time signal to the AppMenu to use some special semantics for
   * selection and focus. Specifically it will ensure that the last opened
   * menu will receive focus.
   */
  openedWithAccessKey?: boolean
}

export type Foldout =
  | { type: FoldoutType.AddMenu }
  | AppMenuFoldout

/**
 * This represents the various states the History tab can be in.
 *
 * By default, it should show the history of the current branch.
 */
export enum HistoryTabMode {
  History = 'History',
  Compare = 'Compare',
}

/**
 * This represents whether the compare tab is currently viewing the
 * commits ahead or behind when merging some other branch into your
 * current branch.
 */
export enum ComparisonMode {
  Ahead = 'Ahead',
  Behind = 'Behind',
}

/**
 * The default comparison state is to display the history for the current
 * branch.
 */
export interface IDisplayHistory {
  readonly kind: HistoryTabMode.History
}

export interface IViewHistory {
  readonly kind: HistoryTabMode.History
}

/**
 * An action to send to the application store to update the compare state
 */
export type CompareAction = IViewHistory

/**
 * An interface for describing a desired value and a valid range
 *
 * Note that the value can be greater than `max` or less than `min`, it's
 * an indication of the desired value. The real value needs to be validated
 * or coerced using a function like `clamp`.
 *
 * Yeah this is a terrible name.
 */
export interface IConstrainedValue {
  readonly value: number
  readonly max: number
  readonly min: number
}
