import { PopupType } from '../../models/popup'
import { Dispatcher } from '../../ui/dispatcher'

class TrampolineUIHelper {
  // The dispatcher must be set before this helper can do anything
  private dispatcher!: Dispatcher

  public setDispatcher(dispatcher: Dispatcher) {
    this.dispatcher = dispatcher
  }

  public promptAddingSSHHost(
    host: string,
    fingerprint: string
  ): Promise<boolean> {
    return new Promise(resolve => {
      this.dispatcher.showPopup({
        type: PopupType.AddSSHHost,
        host,
        fingerprint,
        onSubmit: resolve,
      })
    })
  }

  public promptSSHKeyPassphrase(keyPath: string): Promise<string | undefined> {
    return new Promise(resolve => {
      this.dispatcher.showPopup({
        type: PopupType.SSHKeyPassphrase,
        keyPath,
        onSubmit: resolve,
      })
    })
  }
}

export const trampolineUIHelper = new TrampolineUIHelper()
