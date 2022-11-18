import { getBoolean, setBoolean } from './local-storage'

/** The `localStorage` key for whether we've shown the Device register flow yet. */
const HasShownDeviceRegisterFlowKey = 'has-shown-device-register-flow'

/**
 * Check if the current user has completed the device register flow.
 */
export function hasShownDeviceRegisterFlow(): boolean {
  return getBoolean(HasShownDeviceRegisterFlowKey, false)
}

/**
 * Update local storage to indicate the device register flow has been completed.
 */
export function markDeviceRegisterFlowComplete() {
  setBoolean(HasShownDeviceRegisterFlowKey, true)
}
