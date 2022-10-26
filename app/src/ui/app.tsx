import * as React from 'react'
import { TransitionGroup, CSSTransition } from 'react-transition-group'
import {
  IAppState,
  FoldoutType,
} from '../lib/app-state'
import { Dispatcher } from './dispatcher'
import { AppStore, GitHubUserStore, IssuesStore } from '../lib/stores'
import { assertNever } from '../lib/fatal-error'
import { updateStore, UpdateStatus } from './lib/update-store'
import { shouldRenderApplicationMenu } from './lib/features'
import { getDotComAPIEndpoint } from '../lib/api'
import { getVersion, getName } from './lib/app-proxy'
import { getOS } from '../lib/get-os'
import { MenuEvent } from '../main-process/menu'
import { PreferencesTab } from '../models/preferences'
import { findItemByAccessKey, itemIsSelectable } from '../models/app-menu'
import { Account } from '../models/account'

import { TitleBar, ZoomInfo, FullScreenInfo } from './window'

// import { RepositoriesList } from './repositories-list'
// import { CloningRepositoryView } from './cloning-repository'
// import { iconForRepository, OcticonSymbolType } from './octicons'
// import * as OcticonSymbol from './octicons/octicons.generated'
import {
  showCertificateTrustDialog,
  sendReady,
  isInApplicationFolder,
  selectAllWindowContents,
} from './main-process-proxy'
// import { Welcome } from './welcome'
// import { AppMenuBar } from './app-menu'
import { renderBanner } from './banners'
import { AppError } from './app-error'
// import { MissingRepository } from './missing-repository'
import { SignIn } from './sign-in'
import { InstallGit } from './install-git'
import { EditorError } from './editor'
import { About } from './about'
import { Acknowledgements } from './acknowledgements'
import { UntrustedCertificate } from './untrusted-certificate'
import { getTitleBarHeight } from './window/title-bar'
// import { NoRepositoriesView } from './no-repositories'
import { TermsAndConditions } from './terms-and-conditions'
import { CLIInstalled } from './cli-installed'
import { ShellError } from './shell'
import { ReleaseNotes } from './release-notes'
import { AppTheme } from './app-theme'
import { ApplicationTheme } from './lib/application-theme'
import { PopupType, Popup } from '../models/popup'
// import { isCurrentBranchForcePush } from '../lib/rebase'
import { Banner, BannerType } from '../models/banner'
// import { AppMenuBar } from './app-menu/app-menu-bar';
import memoizeOne from 'memoize-one'
import { AheadBehindStore } from '../lib/stores/ahead-behind-store'
// import { CommitOneLine } from '../models/commit'
import { MoveToApplicationsFolder } from './move-to-applications-folder'
import { ThankYou } from './thank-you'
import {
  getUserContributions,
  hasUserAlreadyBeenCheckedOrThanked,
  updateLastThankYou,
} from '../lib/thank-you'
import { ReleaseNote } from '../models/release-notes'
import { InvalidatedToken } from './invalidated-token/invalidated-token'
// import { MultiCommitOperationKind } from '../models/multi-commit-operation'
import { AddSSHHost } from './ssh/add-ssh-host'
import { SSHKeyPassphrase } from './ssh/ssh-key-passphrase'
// import { getMultiCommitOperationChooseBranchStep } from '../lib/multi-commit-operation'
// import { clamp } from '../lib/clamp'
// import { generateRepositoryListContextMenu } from './repositories-list/repository-list-item-context-menu'
import * as ipcRenderer from '../lib/ipc-renderer'
import { showNotification } from '../lib/notifications/show-notification'
import { generateDevReleaseSummary } from '../lib/release-notes'
import { SSHUserPassword } from './ssh/ssh-user-password'
// import { showContextualMenu } from '../lib/menu-item'
// import { createCommitURL } from '../lib/commit-url'

const MinuteInMilliseconds = 1000 * 60
const HourInMilliseconds = MinuteInMilliseconds * 60

/**
 * Check for updates every 4 hours
 */
const UpdateCheckInterval = 4 * HourInMilliseconds

/**
 * Send usage stats every 4 hours
 */
const SendStatsInterval = 4 * HourInMilliseconds

interface IAppProps {
  readonly dispatcher: Dispatcher
  readonly appStore: AppStore
  readonly issuesStore: IssuesStore
  readonly gitHubUserStore: GitHubUserStore
  readonly aheadBehindStore: AheadBehindStore
  readonly startTime: number
}

export const dialogTransitionTimeout = {
  enter: 250,
  exit: 100,
}

export const bannerTransitionTimeout = { enter: 500, exit: 400 }

/**
 * The time to delay (in ms) from when we've loaded the initial state to showing
 * the window. This is try to give Chromium enough time to flush our latest DOM
 * changes. See https://github.com/desktop/desktop/issues/1398.
 */
const ReadyDelay = 100
export class App extends React.Component<IAppProps, IAppState> {
  private loading = true

  /**
   * Used on non-macOS platforms to support the Alt key behavior for
   * the custom application menu. See the event handlers for window
   * keyup and keydown.
   */
  private lastKeyPressed: string | null = null

  private updateIntervalHandle?: number

  /**
   * Gets a value indicating whether or not we're currently showing a
   * modal dialog such as the preferences, or an error dialog.
   */
  private get isShowingModal() {
    return this.state.currentPopup !== null || this.state.errors.length > 0
  }

  /**
   * Returns a memoized instance of onPopupDismissed() bound to the
   * passed popupType, so it can be used in render() without creating
   * multiple instances when the component gets re-rendered.
   */
  private getOnPopupDismissedFn = memoizeOne((popupType: PopupType) => {
    return () => this.onPopupDismissed(popupType)
  })

  public constructor(props: IAppProps) {
    super(props)

    props.dispatcher.loadInitialState().then(() => {
      this.loading = false
      this.forceUpdate()

      requestIdleCallback(
        () => {
          const now = performance.now()
          sendReady(now - props.startTime)

          requestIdleCallback(() => {
            this.performDeferredLaunchActions()
          })
        },
        { timeout: ReadyDelay }
      )
    })

    this.state = props.appStore.getState()
    props.appStore.onDidUpdate(state => {
      console.log(state);
      this.setState(state)
    })

    props.appStore.onDidError(error => {
      props.dispatcher.postError(error)
    })

    ipcRenderer.on('menu-event', (_, name) => this.onMenuEvent(name))

    updateStore.onDidChange(async state => {
      const status = state.status

      if (
        !(__RELEASE_CHANNEL__ === 'development') &&
        status === UpdateStatus.UpdateReady
      ) {
        this.props.dispatcher.setUpdateBannerVisibility(true)
      }

      if (
        status !== UpdateStatus.UpdateReady &&
        (await updateStore.isUpdateShowcase())
      ) {
        this.props.dispatcher.setUpdateShowCaseVisibility(true)
      }
    })

    updateStore.onError(error => {
      log.error(`Error checking for updates`, error)

      this.props.dispatcher.postError(error)
    })

    ipcRenderer.on('launch-timing-stats', (_, stats) => {
      console.info(`App ready time: ${stats.mainReadyTime}ms`)
      console.info(`Load time: ${stats.loadTime}ms`)
      console.info(`Renderer ready time: ${stats.rendererReadyTime}ms`)

      this.props.dispatcher.recordLaunchStats(stats)
    })

    ipcRenderer.on('certificate-error', (_, certificate, error, url) => {
      this.props.dispatcher.showPopup({
        type: PopupType.UntrustedCertificate,
        certificate,
        url,
      })
    })

  }

  public componentWillUnmount() {
    window.clearInterval(this.updateIntervalHandle)
  }

  private async performDeferredLaunchActions() {
    // Loading emoji is super important but maybe less important that loading
    // the app. So defer it until we have some breathing space.
    // this.props.appStore.loadEmoji()

    this.props.dispatcher.reportStats()
    setInterval(() => this.props.dispatcher.reportStats(), SendStatsInterval)

    this.props.dispatcher.installGlobalLFSFilters(false)

    // We only want to automatically check for updates on beta and prod
    if (
      __RELEASE_CHANNEL__ !== 'development' &&
      __RELEASE_CHANNEL__ !== 'test'
    ) {
      setInterval(() => this.checkForUpdates(true), UpdateCheckInterval)
      this.checkForUpdates(true)
    } else if (await updateStore.isUpdateShowcase()) {
      // The only purpose of this call is so we can see the showcase on dev/test
      // env. Prod and beta environment will trigger this during automatic check
      // for updates.
      this.props.dispatcher.setUpdateShowCaseVisibility(true)
    }

    log.info(`launching: ${getVersion()} (${getOS()})`)
    log.info(`execPath: '${process.execPath}'`)

    // Only show the popup in beta/production releases and mac machines
    if (
      __DEV__ === false &&
      this.state.askToMoveToApplicationsFolderSetting &&
      __DARWIN__ &&
      (await isInApplicationFolder()) === false
    ) {
      this.showPopup({ type: PopupType.MoveToApplicationsFolder })
    }

    this.checkIfThankYouIsInOrder()
  }

  private onMenuEvent(name: MenuEvent): any {
    // Don't react to menu events when an error dialog is shown.
    if (this.state.errors.length) {
      return
    }

    switch (name) {
      case 'show-preferences':
        return this.props.dispatcher.showPopup({ type: PopupType.Preferences })
      case 'show-about':
        return this.showAbout()
      case 'boomtown':
        return this.boomtown()
      case 'install-cli':
        return this.props.dispatcher.installCLI()
      case 'select-all':
        return this.selectAll()
      case 'show-release-notes-popup':
        return this.showFakeReleaseNotesPopup()
      case 'test-show-notification':
        return this.testShowNotification()
      case 'test-prune-branches':
        return this.testPruneBranches()
      case 'find-text':
        return this.findText()
      default:
        return assertNever(name as never, `Unknown menu event name: ${name}`)
    }
  }

  /**
   * Show a release notes popup for a fake release, intended only to
   * make it easier to verify changes to the popup. Has no meaning
   * about a new release being available.
   */
  private async showFakeReleaseNotesPopup() {
    if (__DEV__) {
      this.props.dispatcher.showPopup({
        type: PopupType.ReleaseNotes,
        newReleases: await generateDevReleaseSummary(),
      })
    }
  }

  private testShowNotification() {
    if (
      __RELEASE_CHANNEL__ !== 'development' &&
      __RELEASE_CHANNEL__ !== 'test'
    ) {
      return
    }

    showNotification({
      title: 'Test notification',
      body: 'Click here! This is a test notification',
      onClick: () => this.props.dispatcher.showPopup({ type: PopupType.About }),
    })
  }

  private testPruneBranches() {
    if (!__DEV__) {
      return
    }

    this.props.appStore._testPruneBranches()
  }

  /**
   * Handler for the 'select-all' menu event, dispatches
   * a custom DOM event originating from the element which
   * currently has keyboard focus. Components have a chance
   * to intercept this event and implement their own 'select
   * all' logic.
   */
  private selectAll() {
    const event = new CustomEvent('select-all', {
      bubbles: true,
      cancelable: true,
    })

    if (
      document.activeElement != null &&
      document.activeElement.dispatchEvent(event)
    ) {
      selectAllWindowContents()
    }
  }

  /**
   * Handler for the 'find-text' menu event, dispatches
   * a custom DOM event originating from the element which
   * currently has keyboard focus (or the document if no element
   * has focus). Components have a chance to intercept this
   * event and implement their own 'find-text' logic. One
   * example of this custom event is the text diff which
   * will trigger a search dialog when seeing this event.
   */
  private findText() {
    const event = new CustomEvent('find-text', {
      bubbles: true,
      cancelable: true,
    })

    if (document.activeElement != null) {
      document.activeElement.dispatchEvent(event)
    } else {
      document.dispatchEvent(event)
    }
  }

  private boomtown() {
    setImmediate(() => {
      throw new Error('Boomtown!')
    })
  }

  private checkForUpdates(
    inBackground: boolean,
    skipGuidCheck: boolean = false
  ) {
    if (__LINUX__ || __RELEASE_CHANNEL__ === 'development') {
      return
    }

    updateStore.checkForUpdates(inBackground, skipGuidCheck)
  }

  private getDotComAccount(): Account | null {
    const dotComAccount = this.state.accounts.find(
      a => a.endpoint === getDotComAPIEndpoint()
    )
    return dotComAccount || null
  }

  private showAbout() {
    this.props.dispatcher.showPopup({ type: PopupType.About })
  }

  // private getUserList = async () => {
  //   const res = await fetch('https://reqres.in/api/users?page=2');
  //   const data = await res.json();
  //   console.log(data);
  //   this.setState({ userList: data });
  // }

  public componentDidMount() {
    // this.getUserList();

    document.ondragover = e => {
      if (e.dataTransfer != null) {
        if (this.isShowingModal) {
          e.dataTransfer.dropEffect = 'none'
        } else {
          e.dataTransfer.dropEffect = 'copy'
        }
      }

      e.preventDefault()
    }

    document.ondrop = e => {
      e.preventDefault()
    }

    if (shouldRenderApplicationMenu()) {
      window.addEventListener('keydown', this.onWindowKeyDown)
      window.addEventListener('keyup', this.onWindowKeyUp)
    }
  }

  /**
   * On Windows pressing the Alt key and holding it down should
   * highlight the application menu.
   *
   * This method in conjunction with the onWindowKeyUp sets the
   * appMenuToolbarHighlight state when the Alt key (and only the
   * Alt key) is pressed.
   */
  private onWindowKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return
    }

    if (this.isShowingModal) {
      return
    }

    if (shouldRenderApplicationMenu()) {
      if (event.key === 'Shift' && event.altKey) {
        this.props.dispatcher.setAccessKeyHighlightState(false)
      } else if (event.key === 'Alt') {
        if (event.shiftKey) {
          return
        }
        // Immediately close the menu if open and the user hits Alt. This is
        // a Windows convention.
        if (
          this.state.currentFoldout &&
          this.state.currentFoldout.type === FoldoutType.AppMenu
        ) {
          // Only close it the menu when the key is pressed if there's an open
          // menu. If there isn't we should close it when the key is released
          // instead and that's taken care of in the onWindowKeyUp function.
          if (this.state.appMenuState.length > 1) {
            this.props.dispatcher.setAppMenuState(menu => menu.withReset())
            this.props.dispatcher.closeFoldout(FoldoutType.AppMenu)
          }
        }

        this.props.dispatcher.setAccessKeyHighlightState(true)
      } else if (event.altKey && !event.ctrlKey && !event.metaKey) {
        if (this.state.appMenuState.length) {
          const candidates = this.state.appMenuState[0].items
          const menuItemForAccessKey = findItemByAccessKey(
            event.key,
            candidates
          )

          if (menuItemForAccessKey && itemIsSelectable(menuItemForAccessKey)) {
            if (menuItemForAccessKey.type === 'submenuItem') {
              this.props.dispatcher.setAppMenuState(menu =>
                menu
                  .withReset()
                  .withSelectedItem(menuItemForAccessKey)
                  .withOpenedMenu(menuItemForAccessKey, true)
              )

              this.props.dispatcher.showFoldout({
                type: FoldoutType.AppMenu,
                enableAccessKeyNavigation: true,
                openedWithAccessKey: true,
              })
            } else {
              this.props.dispatcher.executeMenuItem(menuItemForAccessKey)
            }

            event.preventDefault()
          }
        }
      } else if (!event.altKey) {
        this.props.dispatcher.setAccessKeyHighlightState(false)
      }
    }

    this.lastKeyPressed = event.key
  }

  /**
   * Open the application menu foldout when the Alt key is pressed.
   *
   * See onWindowKeyDown for more information.
   */
  private onWindowKeyUp = (event: KeyboardEvent) => {
    if (event.defaultPrevented) {
      return
    }

    if (shouldRenderApplicationMenu()) {
      if (event.key === 'Alt') {
        this.props.dispatcher.setAccessKeyHighlightState(false)

        if (this.lastKeyPressed === 'Alt') {
          if (
            this.state.currentFoldout &&
            this.state.currentFoldout.type === FoldoutType.AppMenu
          ) {
            this.props.dispatcher.setAppMenuState(menu => menu.withReset())
            this.props.dispatcher.closeFoldout(FoldoutType.AppMenu)
          } else {
            this.props.dispatcher.showFoldout({
              type: FoldoutType.AppMenu,
              enableAccessKeyNavigation: true,
              openedWithAccessKey: false,
            })
          }
        }
      }
    }
  }

  /**
   * Conditionally renders a menu bar. The menu bar is currently only rendered
   * on Windows.
   */
  private renderAppMenuBar() {
    // Have we received an app menu from the main process yet?
    if (!this.state.appMenuState.length) {
      return null
    }

    // Don't render the menu bar during the welcome flow
    if (this.state.showWelcomeFlow) {
      return null
    }

    return (
      <div>App menu</div>
    )
  }

  // private onMenuBarLostFocus = () => {
  //   // Note: This event is emitted in an animation frame separate from
  //   // that of the AppStore. See onLostFocusWithin inside of the AppMenuBar
  //   // for more details. This means that it's possible that the current
  //   // app state in this component's state might be out of date so take
  //   // caution when considering app state in this method.
  //   this.props.dispatcher.closeFoldout(FoldoutType.AppMenu)
  //   this.props.dispatcher.setAppMenuState(menu => menu.withReset())
  // }

  private renderTitlebar() {
    const inFullScreen = this.state.windowState === 'full-screen'

    const menuBarActive =
      this.state.currentFoldout &&
      this.state.currentFoldout.type === FoldoutType.AppMenu

    // When we're in full-screen mode on Windows we only need to render
    // the title bar when the menu bar is active. On other platforms we
    // never render the title bar while in full-screen mode.
    if (inFullScreen) {
      if (!__WIN32__ || !menuBarActive) {
        return null
      }
    }

    const showAppIcon = !this.state.showWelcomeFlow
    const inWelcomeFlow = this.state.showWelcomeFlow

    // The light title bar style should only be used while we're in
    // the welcome flow as well as the no-repositories blank slate
    // on macOS. The latter case has to do with the application menu
    // being part of the title bar on Windows. We need to render
    // the app menu in the no-repositories blank slate on Windows but
    // the menu doesn't support the light style at the moment so we're
    // forcing it to use the dark style.
    const titleBarStyle =
      inWelcomeFlow || __DARWIN__ ? 'light' : 'dark'

    return (
      <TitleBar
        showAppIcon={showAppIcon}
        titleBarStyle={titleBarStyle}
        windowState={this.state.windowState}
        windowZoomFactor={this.state.windowZoomFactor}
      >
        <div style={{ height: '100%', display: 'flex', alignItems: 'center' }}>
          <b>Vinpearl OCR managerment</b>
        </div>
      </TitleBar>
    )
  }

  private onPopupDismissed = (popupType: PopupType) => {
    return this.props.dispatcher.closePopup(popupType)
  }

  private onContinueWithUntrustedCertificate = (
    certificate: Electron.Certificate
  ) => {
    showCertificateTrustDialog(
      certificate,
      'Could not securely connect to the server, because its certificate is not trusted. Attackers might be trying to steal your information.\n\nTo connect unsafely, which may put your data at risk, you can “Always trust” the certificate and try again.'
    )
  }

  private currentPopupContent(): JSX.Element | null {
    // Hide any dialogs while we're displaying an error
    if (this.state.errors.length) {
      return null
    }

    const popup = this.state.currentPopup

    if (!popup) {
      return null
    }

    const onPopupDismissedFn = this.getOnPopupDismissedFn(popup.type)

    switch (popup.type) {
      case PopupType.SignIn:
        return (
          <SignIn
            key="sign-in"
            signInState={this.state.signInState}
            dispatcher={this.props.dispatcher}
            onDismissed={onPopupDismissedFn}
          />
        )
      case PopupType.InstallGit:
        return (
          <InstallGit
            key="install-git"
            onDismissed={onPopupDismissedFn}
            onOpenShell={this.onOpenShellIgnoreWarning}
            path={popup.path}
          />
        )
      case PopupType.About:
        const version = __DEV__ ? __SHA__.substring(0, 10) : getVersion()

        return (
          <About
            key="about"
            onDismissed={onPopupDismissedFn}
            applicationName={getName()}
            applicationVersion={version}
            applicationArchitecture={process.arch}
          />
        )
      case PopupType.UntrustedCertificate:
        return (
          <UntrustedCertificate
            key="untrusted-certificate"
            certificate={popup.certificate}
            url={popup.url}
            onDismissed={onPopupDismissedFn}
            onContinue={this.onContinueWithUntrustedCertificate}
          />
        )
      case PopupType.Acknowledgements:
        return (
          <Acknowledgements
            key="acknowledgements"
            onDismissed={onPopupDismissedFn}
            applicationVersion={getVersion()}
          />
        )
      case PopupType.TermsAndConditions:
        return (
          <TermsAndConditions
            key="terms-and-conditions"
            onDismissed={onPopupDismissedFn}
          />
        )
      case PopupType.CLIInstalled:
        return (
          <CLIInstalled key="cli-installed" onDismissed={onPopupDismissedFn} />
        )
      case PopupType.ExternalEditorFailed:
        const openPreferences = popup.openPreferences
        const suggestDefaultEditor = popup.suggestDefaultEditor

        return (
          <EditorError
            key="editor-error"
            message={popup.message}
            onDismissed={onPopupDismissedFn}
            showPreferencesDialog={this.onShowAdvancedPreferences}
            viewPreferences={openPreferences}
            suggestDefaultEditor={suggestDefaultEditor}
          />
        )
      case PopupType.OpenShellFailed:
        return (
          <ShellError
            key="shell-error"
            message={popup.message}
            onDismissed={onPopupDismissedFn}
            showPreferencesDialog={this.onShowAdvancedPreferences}
          />
        )
      case PopupType.ReleaseNotes:
        return (
          <ReleaseNotes
            key="release-notes"
            emoji={this.state.emoji}
            newReleases={popup.newReleases}
            onDismissed={onPopupDismissedFn}
          />
        )
      case PopupType.MoveToApplicationsFolder: {
        return (
          <MoveToApplicationsFolder
            dispatcher={this.props.dispatcher}
            onDismissed={onPopupDismissedFn}
          />
        )
      }
      case PopupType.ThankYou:
        return (
          <ThankYou
            key="thank-you"
            emoji={this.state.emoji}
            userContributions={popup.userContributions}
            friendlyName={popup.friendlyName}
            latestVersion={popup.latestVersion}
            onDismissed={onPopupDismissedFn}
          />
        )
      case PopupType.InvalidatedToken: {
        return (
          <InvalidatedToken
            key="invalidated-token"
            dispatcher={this.props.dispatcher}
            account={popup.account}
            onDismissed={onPopupDismissedFn}
          />
        )
      }
      case PopupType.AddSSHHost: {
        return (
          <AddSSHHost
            key="add-ssh-host"
            host={popup.host}
            ip={popup.ip}
            keyType={popup.keyType}
            fingerprint={popup.fingerprint}
            onSubmit={popup.onSubmit}
            onDismissed={onPopupDismissedFn}
          />
        )
      }
      case PopupType.SSHKeyPassphrase: {
        return (
          <SSHKeyPassphrase
            key="ssh-key-passphrase"
            keyPath={popup.keyPath}
            onSubmit={popup.onSubmit}
            onDismissed={onPopupDismissedFn}
          />
        )
      }
      case PopupType.SSHUserPassword: {
        return (
          <SSHUserPassword
            key="ssh-user-password"
            username={popup.username}
            onSubmit={popup.onSubmit}
            onDismissed={onPopupDismissedFn}
          />
        )
      }
      default:
        return assertNever(popup as never, `Unknown popup type: ${popup}`)
    }
  }

  private onShowAdvancedPreferences = () => {
    this.props.dispatcher.showPopup({
      type: PopupType.Preferences,
      initialSelectedTab: PreferencesTab.Advanced,
    })
  }

  private onOpenShellIgnoreWarning = (path: string) => {
    this.props.dispatcher.openShell(path, true)
  }

  private renderPopup() {
    const popupContent = this.currentPopupContent()

    return (
      <TransitionGroup>
        {popupContent && (
          <CSSTransition classNames="modal" timeout={dialogTransitionTimeout}>
            {popupContent}
          </CSSTransition>
        )}
      </TransitionGroup>
    )
  }

  private renderZoomInfo() {
    return <ZoomInfo windowZoomFactor={this.state.windowZoomFactor} />
  }

  private renderFullScreenInfo() {
    return <FullScreenInfo windowState={this.state.windowState} />
  }

  private clearError = (error: Error) => this.props.dispatcher.clearError(error)

  private handle = () => {};

  private renderAppError() {
    return (
      <AppError
        errors={this.state.errors}
        onClearError={this.clearError}
        onShowPopup={this.showPopup}
        onRetryAction={this.handle}
      />
    )
  }

  private showPopup = (popup: Popup) => {
    this.props.dispatcher.showPopup(popup)
  }

  private renderApp() {
    return (
      <div
        id="desktop-app-contents"
        style={{ marginTop: getTitleBarHeight() }}
      >
        {this.renderToolbar()}
        {this.renderAppMenuBar()}
        {this.renderBanner()}
        
        {this.renderRepository()}
        {this.renderPopup()}
        {this.renderAppError()}
      </div>
    )
  }
  
  // we currently only render one banner at a time
  private renderBanner(): JSX.Element | null {
    // The inset light title bar style without the toolbar
    // can't support banners at the moment. So for the
    // no-repositories blank slate we'll have to live without
    // them.

    let banner = null
    if (this.state.currentBanner !== null) {
      banner = renderBanner(
        this.state.currentBanner,
        this.props.dispatcher,
        this.onBannerDismissed
      )
    }
    return (
      <TransitionGroup>
        {banner && (
          <CSSTransition classNames="banner" timeout={bannerTransitionTimeout}>
            {banner}
          </CSSTransition>
        )}
      </TransitionGroup>
    )
  }

  private onBannerDismissed = () => {
    this.props.dispatcher.clearBanner()
  }

  private renderToolbar() {
    return null;
  }

  private renderRepository() {
    const state = this.state;
    const userList = this.state?.userList?.data || [];
    console.log(state.userList);
    return (
      <div style={{ padding: 10 }}>
        <h3 style={{ marginBottom: 10 }}>Quản lý người dùng</h3>
        <table style={{width:'100%', border: '1px solid', borderCollapse: 'collapse'}}>
          <tr>
            <th>STT</th>
            <th>Tên</th>
            <th>Họ</th>
            <th>Email</th>
          </tr>
          {userList.map((it: any, idx: number) => (
            <tr key={idx}>
              <td>{idx}</td>
              <td>{it?.first_name}</td>
              <td>{it?.last_name}</td>
              <td>{it?.email}</td>
            </tr>
          ))}
        </table>
      </div>
    );
  }

  // private renderWelcomeFlow() {
  //   return (
  //     <Welcome
  //       dispatcher={this.props.dispatcher}
  //       optOut={this.state.optOutOfUsageTracking}
  //       accounts={this.state.accounts}
  //       signInState={this.state.signInState}
  //     />
  //   )
  // }

  public render() {
    if (this.loading) {
      return null
    }

    const className = this.state.appIsFocused ? 'focused' : 'blurred'

    const currentTheme = this.state.showWelcomeFlow
      ? ApplicationTheme.Light
      : this.state.currentTheme

    return (
      <div id="desktop-app-chrome" className={className}>
        <AppTheme
          theme={currentTheme}
          customTheme={this.state.customTheme}
          useCustomTheme={
            this.state.selectedTheme === ApplicationTheme.HighContrast
          }
        />
        {this.renderTitlebar()}
          {this.renderApp()}
        {this.renderZoomInfo()}
        {this.renderFullScreenInfo()}
      </div>
    )
  }

  /**
   * Check if the user signed into their dotCom account has been tagged in
   * our release notes or if they already have received a thank you card.
   *
   * Notes: A user signed into a GHE account should not be contributing to
   * Desktop as that account should be used for GHE repos. Tho, technically it
   * is possible through commit misattribution and we are intentionally ignoring
   * this scenario as it would be expected any misattributed commit would not
   * be able to be detected.
   */
  private async checkIfThankYouIsInOrder(): Promise<void> {
    const dotComAccount = this.getDotComAccount()
    if (dotComAccount === null) {
      // The user is not signed in or is a GHE user who should not have any.
      return
    }

    const { lastThankYou } = this.state
    const { login } = dotComAccount
    if (hasUserAlreadyBeenCheckedOrThanked(lastThankYou, login, getVersion())) {
      return
    }

    const isOnlyLastRelease =
      lastThankYou !== undefined && lastThankYou.checkedUsers.includes(login)
    const userContributions = await getUserContributions(
      isOnlyLastRelease,
      login
    )
    if (userContributions === null) {
      // This will prevent unnecessary release note retrieval on every time the
      // app is opened for a non-contributor.
      updateLastThankYou(
        this.props.dispatcher,
        lastThankYou,
        login,
        getVersion()
      )
      return
    }

    // If this is the first time user has seen the card, we want to thank them
    // for all previous versions. Thus, only specify current version if they
    // have been thanked before.
    const displayVersion = isOnlyLastRelease ? getVersion() : null
    const banner: Banner = {
      type: BannerType.OpenThankYouCard,
      // Grab emoji's by reference because we could still be loading emoji's
      emoji: this.state.emoji,
      onOpenCard: () =>
        this.openThankYouCard(userContributions, displayVersion),
      onThrowCardAway: () => {
        updateLastThankYou(
          this.props.dispatcher,
          lastThankYou,
          login,
          getVersion()
        )
      },
    }
    this.props.dispatcher.setBanner(banner)
  }

  private openThankYouCard = (
    userContributions: ReadonlyArray<ReleaseNote>,
    latestVersion: string | null = null
  ) => {
    const dotComAccount = this.getDotComAccount()

    if (dotComAccount === null) {
      // The user is not signed in or is a GHE user who should not have any.
      return
    }
    const { friendlyName } = dotComAccount

    this.props.dispatcher.showPopup({
      type: PopupType.ThankYou,
      userContributions,
      friendlyName,
      latestVersion,
    })
  }

}
