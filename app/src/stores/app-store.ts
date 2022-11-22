import {
  AccountsStore,
  DeviceRegisterStore,
} from '.'
import { Account } from '../models/account'
import { AppMenu, IMenu } from '../models/app-menu'

import { Popup, PopupType } from '../models/popup'
import { themeChangeMonitor } from '../ui/common/theme-change-monitor'
import {
  ApplicationTheme,
  getPersistedThemeName,
  ICustomTheme,
  setPersistedTheme,
} from '../ui/common/application-theme'
import {
  getAppMenu,
  getCurrentWindowState,
  getCurrentWindowZoomFactor,
  updateAccounts,
  setWindowZoomFactor,
} from '../ui/main-process-proxy'
import {
  API,
  getAccountForEndpoint,
} from '../lib/api'
import { shell } from '../lib/app-shell'
import {
  Foldout,
  FoldoutType,
  IAppState,
  IConstrainedValue,
} from '../lib/app-state'
import {
  findEditorOrDefault,
  launchExternalEditor,
} from '../lib/editors'

import { updateMenuState } from '../lib/menu-update'
import {
  Default as DefaultShell,
  findShellOrDefault,
  launchShell,
  parse as parseShell,
  Shell,
} from '../lib/shells'
import { ILaunchStats, StatsStore } from '../lib/stats'
import { hasShownDeviceRegisterFlow, markDeviceRegisterFlowComplete } from '../lib/device-register'
import { WindowState } from '../lib/window-state'
import { TypedBaseStore } from './base-store'

import {
  setNumber,
  setBoolean,
  getBoolean,
  getNumber,
  // getEnum,
  getObject,
  setObject,
  getFloatNumber,
} from '../lib/local-storage'
import { ExternalEditorError, suggestedExternalEditor } from '../lib/editors/shared'
import { Banner, BannerType } from '../models/banner'
import { DragElement } from '../models/drag-drop'
import { ILastThankYou } from '../models/last-thank-you'
import { clamp } from '../lib/clamp'
import { EndpointToken } from '../lib/endpoint-token'
import {
  NotificationsStore,
  getNotificationsEnabled,
} from './notifications-store'
import * as ipcRenderer from '../lib/ipc-renderer'

const defaultSidebarWidth: number = 250
const sidebarWidthConfigKey: string = 'sidebar-width'

const askToMoveToApplicationsFolderDefault: boolean = true

const askToMoveToApplicationsFolderKey: string = 'askToMoveToApplicationsFolder'

const shellKey = 'shell'

const repositoryIndicatorsEnabledKey = 'enable-repository-indicators'

const lastThankYouKey = 'version-and-users-of-last-thank-you'
const customThemeKey = 'custom-theme-key'
export class AppStore extends TypedBaseStore<IAppState> {

  private userList: any = {};
  private accounts: ReadonlyArray<Account> = new Array<Account>()
  // private recentRepositories: ReadonlyArray<number> = new Array<number>()

  private showDeviceRegisterFlow = false
  private currentPopup: Popup | null = null
  private currentFoldout: Foldout | null = null
  private currentBanner: Banner | null = null
  private errors: ReadonlyArray<Error> = new Array<Error>()
  private emitQueued = false

  /** Map from shortcut (e.g., :+1:) to on disk URL. */
  private emoji = new Map<string, string>()

  /**
   * The Application menu as an AppMenu instance or null if
   * the main process has not yet provided the renderer with
   * a copy of the application menu structure.
   */
  private appMenu: AppMenu | null = null

  /**
   * Used to highlight access keys throughout the app when the
   * Alt key is pressed. Only applicable on non-macOS platforms.
   */
  private highlightAccessKeys: boolean = false

  /**
   * A value indicating whether or not the current application
   * window has focus.
   */
  private appIsFocused: boolean = false

  private sidebarWidth = constrain(defaultSidebarWidth)

  private windowState: WindowState | null = null
  private windowZoomFactor: number = 1
  private isUpdateAvailableBannerVisible: boolean = false
  private isUpdateShowcaseVisible: boolean = false

  private askToMoveToApplicationsFolderSetting: boolean =
    askToMoveToApplicationsFolderDefault

  private selectedExternalEditor: string | null = null

  private resolvedExternalEditor: string | null = null

  /** The user's preferred shell. */
  private selectedShell = DefaultShell

  /** The current repository filter text */
  // private repositoryFilterText: string = ''

  private selectedTheme = ApplicationTheme.System
  private customTheme?: ICustomTheme
  private currentTheme: ApplicationTheme = ApplicationTheme.Light

  // private useWindowsOpenSSH: boolean = false

  // private repositoryIndicatorsEnabled: boolean

  /** Which step the user needs to complete next in the onboarding tutorial */
  // private currentOnboardingTutorialStep = TutorialStep.NotApplicable

  private currentDragElement: DragElement | null = null
  private lastThankYou: ILastThankYou | undefined
  private showCIStatusPopover: boolean = false

  public constructor(
    private readonly statsStore: StatsStore,
    private readonly deviceRegisterStore: DeviceRegisterStore,
    private readonly accountsStore: AccountsStore,
    private readonly notificationsStore: NotificationsStore
  ) {
    super()

    this.showDeviceRegisterFlow = !hasShownDeviceRegisterFlow()

    window.addEventListener('resize', () => {
      this.updateResizableConstraints()
      this.emitUpdate()
    })

    this.initializeWindowState()
    this.initializeZoomFactor()
    this.wireupIpcEventHandlers()
    this.wireupStoreEventHandlers()
    getAppMenu()

    // We're considering flipping the default value and have new users
    // start off with repository indicators disabled. As such we'll start
    // persisting the current default to localstorage right away so we
    // can change the default in the future without affecting current
    // users.
    if (getBoolean(repositoryIndicatorsEnabledKey) === undefined) {
      setBoolean(repositoryIndicatorsEnabledKey, true)
    }

    // this.repositoryIndicatorsEnabled =
    //   getBoolean(repositoryIndicatorsEnabledKey) ?? true

    API.onTokenInvalidated(this.onTokenInvalidated)

  }

  private initializeWindowState = async () => {
    const currentWindowState = await getCurrentWindowState()
    if (currentWindowState === undefined) {
      return
    }

    this.windowState = currentWindowState
  }

  private initializeZoomFactor = async () => {
    const zoomFactor = await this.getWindowZoomFactor()
    if (zoomFactor === undefined) {
      return
    }
    this.onWindowZoomFactorChanged(zoomFactor)
  }

  /**
   * On Windows OS, whenever a user toggles their zoom factor, chromium stores it
   * in their `%AppData%/Roaming/GitHub Desktop/Preferences.js` denoted by the
   * file path to the application. That file path contains the apps version.
   * Thus, on every update, the users set zoom level gets reset as there is not
   * defined value for the current app version.
   * */
  private async getWindowZoomFactor() {
    const zoomFactor = await getCurrentWindowZoomFactor()
    // One is the default value, we only care about checking the locally stored
    // value if it is one because that is the default value after an
    // update
    if (zoomFactor !== 1 || !__WIN32__) {
      return zoomFactor
    }

    const locallyStoredZoomFactor = getFloatNumber('zoom-factor')
    if (
      locallyStoredZoomFactor !== undefined &&
      locallyStoredZoomFactor !== zoomFactor
    ) {
      setWindowZoomFactor(locallyStoredZoomFactor)
      return locallyStoredZoomFactor
    }

    return zoomFactor
  }

  private onTokenInvalidated = (endpoint: string) => {
    const account = getAccountForEndpoint(this.accounts, endpoint)

    if (account === null) {
      return
    }

    // If there is a currently open popup, don't do anything here. Since the
    // app can only show one popup at a time, we don't want to close the current
    // one in favor of the error we're about to show.
    if (this.currentPopup !== null) {
      return
    }

    // If the token was invalidated for an account, sign out from that account
    this._removeAccount(account)

    this._showPopup({
      type: PopupType.InvalidatedToken,
      account,
    })
  }

  private wireupIpcEventHandlers() {
    ipcRenderer.on('window-state-changed', (_, windowState) => {
      this.windowState = windowState
      this.emitUpdate()
    })

    ipcRenderer.on('zoom-factor-changed', (event: any, zoomFactor: number) => {
      this.onWindowZoomFactorChanged(zoomFactor)
    })

    ipcRenderer.on('app-menu', (_, menu) => this.setAppMenu(menu))
  }

  private wireupStoreEventHandlers() {
    this.accountsStore.onDidUpdate(accounts => {
      this.accounts = accounts
      const endpointTokens = accounts.map<EndpointToken>(
        ({ endpoint, token }) => ({ endpoint, token })
      )

      updateAccounts(endpointTokens)

      this.emitUpdate()
    })
    this.accountsStore.onDidError(error => this.emitError(error))
  }

  /** Load the emoji from disk. */
  // public async loadEmoji() {
  //   const rootDir = await getAppPath()
  //   readEmoji(rootDir)
  //     .then(emoji => {
  //       this.emoji = emoji
  //       this.emitUpdate()
  //     })
  //     .catch(err => {
  //       log.warn(`Unexpected issue when trying to read emoji into memory`, err)
  //     })
  // }

  protected emitUpdate() {
    // If the window is hidden then we won't get an animation frame, but there
    // may still be work we wanna do in response to the state change. So
    // immediately emit the update.
    if (this.windowState === 'hidden') {
      this.emitUpdateNow()
      return
    }

    if (this.emitQueued) {
      return
    }

    this.emitQueued = true

    window.requestAnimationFrame(() => {
      this.emitUpdateNow()
    })
  }

  private emitUpdateNow() {
    this.emitQueued = false
    const state = this.getState()

    super.emitUpdate(state)
    updateMenuState(state, this.appMenu)
  }

  /**
   * Called when we have reason to suspect that the zoom factor
   * has changed. Note that this doesn't necessarily mean that it
   * has changed with regards to our internal state which is why
   * we double check before emitting an update.
   */
  private onWindowZoomFactorChanged(zoomFactor: number) {
    const current = this.windowZoomFactor
    this.windowZoomFactor = zoomFactor

    if (zoomFactor !== current) {
      setNumber('zoom-factor', zoomFactor)
      this.updateResizableConstraints()
      this.emitUpdate()
    }
  }

  public getState(): IAppState {
    return {
      userList: this.userList,
      accounts: this.accounts,
      windowState: this.windowState,
      windowZoomFactor: this.windowZoomFactor,
      appIsFocused: this.appIsFocused,
      deviceRegisterState: this.deviceRegisterStore.getState(),
      currentPopup: this.currentPopup,
      currentFoldout: this.currentFoldout,
      errors: this.errors,
      showDeviceRegisterFlow: this.showDeviceRegisterFlow,
      emoji: this.emoji,
      sidebarWidth: this.sidebarWidth,
      appMenuState: this.appMenu ? this.appMenu.openMenus : [],
      highlightAccessKeys: this.highlightAccessKeys,
      isUpdateAvailableBannerVisible: this.isUpdateAvailableBannerVisible,
      isUpdateShowcaseVisible: this.isUpdateShowcaseVisible,
      currentBanner: this.currentBanner,
      askToMoveToApplicationsFolderSetting:
        this.askToMoveToApplicationsFolderSetting,
      selectedExternalEditor: this.selectedExternalEditor,
      selectedShell: this.selectedShell,
      // repositoryFilterText: this.repositoryFilterText,
      resolvedExternalEditor: this.resolvedExternalEditor,
      selectedTheme: this.selectedTheme,
      customTheme: this.customTheme,
      currentTheme: this.currentTheme,
      // useWindowsOpenSSH: this.useWindowsOpenSSH,
      optOutOfUsageTracking: this.statsStore.getOptOut(),
      // repositoryIndicatorsEnabled: this.repositoryIndicatorsEnabled,
      currentDragElement: this.currentDragElement,
      lastThankYou: this.lastThankYou,
      // showCIStatusPopover: this.showCIStatusPopover,
      notificationsEnabled: getNotificationsEnabled(),
    }
  }

  private getUserList = async () => {
    const res = await fetch('https://reqres.in/api/users?page=2');
    const data = await res.json();
    return data;
  }

  /** Load the initial state for the app. */
  public async loadInitialState() {
    const [accounts, userList] = await Promise.all([
      this.accountsStore.getAll(),
      this.getUserList(),
    ])

    accounts.forEach(a => {
      log.info(`[AppStore] found account: ${a.login} (${a.name})`)
    })

    this.accounts = accounts
    this.userList = userList

    this.sidebarWidth = constrain(
      getNumber(sidebarWidthConfigKey, defaultSidebarWidth)
    )

    this.updateResizableConstraints()

    this.askToMoveToApplicationsFolderSetting = getBoolean(
      askToMoveToApplicationsFolderKey,
      askToMoveToApplicationsFolderDefault
    )

    const shellValue = localStorage.getItem(shellKey)
    this.selectedShell = shellValue ? parseShell(shellValue) : DefaultShell

    this.selectedTheme = getPersistedThemeName()
    this.customTheme = getObject<ICustomTheme>(customThemeKey)
    // Make sure the persisted theme is applied
    setPersistedTheme(this.selectedTheme)

    this.currentTheme = this.selectedTheme

    themeChangeMonitor.onThemeChanged(theme => {
      this.currentTheme = theme
      this.emitUpdate()
    })

    this.lastThankYou = getObject<ILastThankYou>(lastThankYouKey)

    this.emitUpdateNow()

    this.accountsStore.refresh()
  }

  /**
   * Calculate the constraints of our resizable panes whenever the window
   * dimensions change.
   */
  private updateResizableConstraints() {
    // The combined width of the branch dropdown and the push pull fetch button
    // Since the repository list toolbar button width is tied to the width of
    // the sidebar we can't let it push the branch, and push/pull/fetch buttons
    // off screen.
    const toolbarButtonsWidth = 460

    // Start with all the available width
    let available = window.innerWidth

    // Working our way from left to right (i.e. giving priority to the leftmost
    // pane when we need to constrain the width)
    //
    // 220 was determined as the minimum value since it is the smallest width
    // that will still fit the placeholder text in the branch selector textbox
    // of the history tab
    const maxSidebarWidth = available - toolbarButtonsWidth
    this.sidebarWidth = constrain(this.sidebarWidth, 220, maxSidebarWidth)

    // Now calculate the width we have left to distribute for the other panes
    available -= clamp(this.sidebarWidth)

  }

  public _setNotificationsEnabled(notificationsEnabled: boolean) {
    this.notificationsStore.setNotificationsEnabled(notificationsEnabled)
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _showPopup(popup: Popup): Promise<void> {
    this._closePopup()

    // Always close the app menu when showing a pop up. This is only
    // applicable on Windows where we draw a custom app menu.
    this._closeFoldout(FoldoutType.AppMenu)

    this.currentPopup = popup
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _closePopup(popupType?: PopupType) {
    const currentPopup = this.currentPopup
    if (currentPopup == null) {
      return
    }

    if (popupType !== undefined && currentPopup.type !== popupType) {
      return
    }

    this.currentPopup = null
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _showFoldout(foldout: Foldout): Promise<void> {
    this.currentFoldout = foldout
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _closeCurrentFoldout(): Promise<void> {
    if (this.currentFoldout == null) {
      return
    }

    this.currentFoldout = null
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _closeFoldout(foldout: FoldoutType): Promise<void> {
    if (this.currentFoldout == null) {
      return
    }

    if (foldout !== undefined && this.currentFoldout.type !== foldout) {
      return
    }

    this.currentFoldout = null
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _pushError(error: Error): Promise<void> {
    const newErrors = Array.from(this.errors)
    newErrors.push(error)
    this.errors = newErrors
    this.emitUpdate()

    return Promise.resolve()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _clearError(error: Error): Promise<void> {
    this.errors = this.errors.filter(e => e !== error)
    this.emitUpdate()

    return Promise.resolve()
  }

  public _setSidebarWidth(width: number): Promise<void> {
    this.sidebarWidth = { ...this.sidebarWidth, value: width }
    setNumber(sidebarWidthConfigKey, width)
    this.updateResizableConstraints()
    this.emitUpdate()

    return Promise.resolve()
  }

  public _resetSidebarWidth(): Promise<void> {
    this.sidebarWidth = { ...this.sidebarWidth, value: defaultSidebarWidth }
    localStorage.removeItem(sidebarWidthConfigKey)
    this.updateResizableConstraints()
    this.emitUpdate()

    return Promise.resolve()
  }

  /**
   * Set the global application menu.
   *
   * This is called in response to the main process emitting an event signalling
   * that the application menu has changed in some way like an item being
   * added/removed or an item having its visibility toggled.
   *
   * This method should not be called by the renderer in any other circumstance
   * than as a directly result of the main-process event.
   *
   */
  private setAppMenu(menu: IMenu): Promise<void> {
    if (this.appMenu) {
      this.appMenu = this.appMenu.withMenu(menu)
    } else {
      this.appMenu = AppMenu.fromMenu(menu)
    }

    this.emitUpdate()
    return Promise.resolve()
  }

  public _setAppMenuState(
    update: (appMenu: AppMenu) => AppMenu
  ): Promise<void> {
    if (this.appMenu) {
      this.appMenu = update(this.appMenu)
      this.emitUpdate()
    }
    return Promise.resolve()
  }

  public _setAccessKeyHighlightState(highlight: boolean): Promise<void> {
    if (this.highlightAccessKeys !== highlight) {
      this.highlightAccessKeys = highlight
      this.emitUpdate()
    }

    return Promise.resolve()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _openShell(path: string) {
    this.statsStore.recordOpenShell()

    try {
      const match = await findShellOrDefault(this.selectedShell)
      await launchShell(match, path, error => this._pushError(error))
    } catch (error) {
      this.emitError(error)
    }
  }

  /** Takes a URL and opens it using the system default application */
  public _openInBrowser(url: string): Promise<boolean> {
    return shell.openExternal(url)
  }

  /** Open a path to a repository or file using the user's configured editor */
  public async _openInExternalEditor(fullPath: string): Promise<void> {
    const { selectedExternalEditor } = this.getState()

    try {
      const match = await findEditorOrDefault(selectedExternalEditor)
      if (match === null) {
        this.emitError(
          new ExternalEditorError(
            `No suitable editors installed for GitHub Desktop to launch. Install ${suggestedExternalEditor.name} for your platform and restart GitHub Desktop to try again.`,
            { suggestDefaultEditor: true }
          )
        )
        return
      }

      await launchExternalEditor(fullPath, match)
    } catch (error) {
      this.emitError(error)
    }
  }

  /** Set whether the user has opted out of stats reporting. */
  public async setStatsOptOut(
    optOut: boolean,
    userViewedPrompt: boolean
  ): Promise<void> {
    await this.statsStore.setOptOut(optOut, userViewedPrompt)

    this.emitUpdate()
  }

  public _setAskToMoveToApplicationsFolderSetting(
    value: boolean
  ): Promise<void> {
    this.askToMoveToApplicationsFolderSetting = value

    setBoolean(askToMoveToApplicationsFolderKey, value)
    this.emitUpdate()

    return Promise.resolve()
  }

  public _setShell(shell: Shell): Promise<void> {
    this.selectedShell = shell
    localStorage.setItem(shellKey, shell)
    this.emitUpdate()

    return Promise.resolve()
  }

  public _setUpdateBannerVisibility(visibility: boolean) {
    this.isUpdateAvailableBannerVisible = visibility

    this.emitUpdate()
  }

  public _setUpdateShowCaseVisibility(visibility: boolean) {
    this.isUpdateShowcaseVisible = visibility

    this.emitUpdate()
  }

  public _setBanner(state: Banner) {
    this.currentBanner = state
    this.emitUpdate()
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public _clearBanner(bannerType?: BannerType) {
    const { currentBanner } = this
    if (currentBanner === null) {
      return
    }

    if (bannerType !== undefined && currentBanner.type !== bannerType) {
      return
    }

    this.currentBanner = null
    this.emitUpdate()
  }

  public _recordLaunchStats(stats: ILaunchStats): Promise<void> {
    return this.statsStore.recordLaunchStats(stats)
  }

  public async _setAppFocusState(isFocused: boolean): Promise<void> {
    if (this.appIsFocused !== isFocused) {
      this.appIsFocused = isFocused
      this.emitUpdate()
    }
  }

  public _removeAccount(account: Account): Promise<void> {
    log.info(
      `[AppStore] removing account ${account.login} (${account.name}) from store`
    )
    return this.accountsStore.removeAccount(account)
  }

  /**
   * Set the application-wide theme
   */
  public _setSelectedTheme(theme: ApplicationTheme) {
    setPersistedTheme(theme)
    this.selectedTheme = theme
    this.currentTheme = theme
    this.emitUpdate()

    return Promise.resolve()
  }

  /**
   * Set the custom application-wide theme
   */
  public _setCustomTheme(theme: ICustomTheme) {
    setObject(customThemeKey, theme)
    this.customTheme = theme
    this.emitUpdate()

    return Promise.resolve()
  }

  public getResolvedExternalEditor = () => {
    return this.resolvedExternalEditor
  }

  /** This shouldn't be called directly. See `Dispatcher`. */
  public async _setDragElement(dragElement: DragElement | null): Promise<void> {
    this.currentDragElement = dragElement
    this.emitUpdate()
  }

  public _setLastThankYou(lastThankYou: ILastThankYou) {
    // don't update if same length and same version (assumption
    // is that update will be either adding a user or updating version)
    const sameVersion =
      this.lastThankYou !== undefined &&
      this.lastThankYou.version === lastThankYou.version

    const sameNumCheckedUsers =
      this.lastThankYou !== undefined &&
      this.lastThankYou.checkedUsers.length === lastThankYou.checkedUsers.length

    if (sameVersion && sameNumCheckedUsers) {
      return
    }

    setObject(lastThankYouKey, lastThankYou)
    this.lastThankYou = lastThankYou

    this.emitUpdate()
  }

  public _setShowCIStatusPopover(showCIStatusPopover: boolean) {
    if (this.showCIStatusPopover !== showCIStatusPopover) {
      this.showCIStatusPopover = showCIStatusPopover
      this.emitUpdate()
    }
  }

  public _toggleCIStatusPopover() {
    this.showCIStatusPopover = !this.showCIStatusPopover
    this.emitUpdate()
  }

  public _beginDeviceRegister(): Promise<void> {
    this.deviceRegisterStore.beginDeviceRegister();
    return Promise.resolve();
  }

  public async _registerDevice(
    hotel: string,
    deviceName: string,
    deviceDescription: string
  ): Promise<void> {
    const promise = await this.deviceRegisterStore.registerDevice(hotel, deviceName, deviceDescription);
    this.emitUpdate();
    return promise;
  }

  public async _verifyCode(code: string): Promise<void> {
    const promise = await this.deviceRegisterStore.verifyCode(code);
    this.emitUpdate();
    setTimeout(() => {
      this._endDeviceRegisterFlow();
    }, 1000);
    return promise;
  }

  public _endDeviceRegisterFlow(): Promise<void> {
    this.showDeviceRegisterFlow = false;
    this.emitUpdate();

    markDeviceRegisterFlowComplete();

    return Promise.resolve();
  }
}

function constrain(
  value: IConstrainedValue | number,
  min = -Infinity,
  max = Infinity
): IConstrainedValue {
  return { value: typeof value === 'number' ? value : value.value, min, max }
}
